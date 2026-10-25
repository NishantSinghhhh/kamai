/**
 * kamai — the agent that pays its own bills.
 *
 * Express pipeline for /explain: the budget gate refuses (503) BEFORE the
 * x402 paywall ever shows a price, so a hungry kamai never takes money.
 */
import express, { type Request, type Response } from "express";
import {
  loadConfig,
  hashScanTxUrl,
  hashScanTopicUrl,
  looksLikeTxId,
  normalizeTxId,
  type AuditEvent,
  type Explanation,
  type KamaiMeta,
  type Policy,
  type Stats,
} from "@kamai/shared";
import { Ledger } from "./ledger.js";
import { Pricing } from "./pricing.js";
import { Gate, type KamaiState } from "./gate.js";
import { AuditLog } from "./audit.js";
import { OgCompute, describeTx, fetchTx, minimalExplanation } from "./work.js";
import { Reporter } from "./reporter.js";
import { buildPaywall, readCorrelationKey } from "./paywall.js";

const cfg = loadConfig();

// --- services ---------------------------------------------------------------

const ledger = new Ledger({
  file: process.env.KAMAI_LEDGER_FILE ?? "data/ledger.json",
  startingFloatUsd: cfg.startingFloatUsd,
  ogUsdRate: cfg.ogUsdRate,
});

// Defaults until ENS says otherwise; ENS is the source of truth at runtime.
let policy: Policy = {
  priceFloorUsd: 0.03,
  maxDailyComputeUsd: 0.25,
  minMarginBps: 5000,
};

const pricing = new Pricing({
  ogUsdRate: cfg.ogUsdRate,
  bootstrapCostUsd: 0.01,
});

const state: KamaiState = { status: "working", pausedReason: null };
const gate = new Gate(ledger, pricing, state);
const audit = new AuditLog({
  topicId: cfg.hcsTopicId,
  accountId: cfg.kamaiAccountId,
  privateKey: cfg.kamaiPrivateKey,
});
const og = new OgCompute({
  rpcUrl: cfg.ogRpcUrl,
  privateKey: cfg.ogPrivateKey,
  providerAddress: cfg.ogProviderAddress,
});
const reporter = new Reporter({
  rpcUrl: cfg.sepoliaRpcUrl,
  ensName: cfg.kamaiEnsName,
  agentPrivateKey: cfg.ensAgentPrivateKey,
});

function refreshPricing(): void {
  const recent = ledger
    .jobs()
    .filter((j) => j.ogSpent !== null)
    .map((j) => j.ogSpent!);
  pricing.setRecentOgPerJob(recent);
}

/** jobId by client transaction bytes, so the settle hook can find its job. */
const pendingJobs = new Map<string, string>();

async function currentStats(): Promise<Stats> {
  const revenueUsd = ledger.revenueUsd();
  const computeCostUsd = ledger.computeCostUsd();
  return {
    jobs: ledger.jobs().length,
    revenueUsd,
    computeCostUsd,
    marginUsd: revenueUsd - computeCostUsd,
    allowanceUsd: ledger.allowanceUsd(),
    todayComputeUsd: ledger.todayComputeUsd(),
    status: state.status,
  };
}

// --- app ----------------------------------------------------------------------

const app = express();

/** 1. budget gate — refuse before the paywall ever shows a price. */
app.use("/explain", (req, res, next) => {
  const decision = gate.decide(policy);
  if (!decision.ok) {
    state.status = decision.status;
    res.status(503).json({
      error: "service_unavailable",
      status: decision.status,
      reason: decision.reason,
    });
    return;
  }
  next();
});

// 2. x402 paywall — 402 with the dynamic price; settles after the handler.
app.use(
  buildPaywall({
    facilitatorUrl: cfg.facilitatorUrl,
    kamaiAccountId: cfg.kamaiAccountId,
    usdcTokenId: cfg.hederaUsdcTokenId,
    getPriceUsd: () => pricing.price(policy).priceUsd,
    onSettled: (info) => {
      const jobId = pendingJobs.get(info.correlationKey);
      if (!jobId) return;
      pendingJobs.delete(info.correlationKey);
      void bookRevenue(jobId, info.paymentTxId, info.payer);
    },
  }),
);

// 3. the actual work.
app.get("/explain", async (req: Request, res: Response) => {
  const txId = normalizeTxId(String(req.query.tx ?? ""));
  if (!looksLikeTxId(txId)) {
    res.status(400).json({ error: "bad_request", reason: "tx must be a Hedera transaction id" });
    return;
  }

  const correlationKey = readCorrelationKey(req.header("payment-signature")) ?? "";
  const { priceUsd } = pricing.price(policy);

  // Revenue is committed at verify time (x402 authorization flow); the settle
  // hook fills in the payment tx id and payer.
  const job = await ledger.createJob({
    customer: null,
    txId,
    priceUsd,
    revenueAtomic: String(Math.round(priceUsd * 1e6)),
    hederaPaymentTxId: "",
  });
  if (correlationKey) pendingJobs.set(correlationKey, job.id);

  try {
    const tx = await fetchTx(cfg.mirrorNodeUrl, txId);
    if (!tx) {
      await ledger.markRefundOwed(job.id);
      res.status(404).json({ error: "tx_not_found", jobId: job.id, reason: "Mirror Node has no such transaction" });
      return;
    }

    let explanation: Explanation;
    let ogChatId: string | null = null;
    let ogSpent: string | null = null;
    let modelFailed = false;
    try {
      const result = await og.explain(txId, describeTx(tx));
      explanation = result.explanation;
      ogChatId = result.chatId;
      ogSpent = result.ogSpent;
    } catch (e) {
      // model failed after payment: serve the mirror-node fallback, owe a refund
      modelFailed = true;
      explanation = minimalExplanation(txId, tx);
      await publishAudit({
        type: "refund_owed",
        jobId: job.id,
        at: new Date().toISOString(),
        details: { error: String((e as Error).message) },
      });
    }

    const costUsd = ogSpent !== null ? Number(ogSpent) * cfg.ogUsdRate : null;
    if (ogSpent !== null && !modelFailed) {
      await ledger.recordResult(job.id, { ogChatId: ogChatId ?? "", ogSpent, costUsd: costUsd!, status: "done" });
      await publishAudit({
        type: "cost",
        jobId: job.id,
        at: new Date().toISOString(),
        amountUsd: costUsd!,
        details: { ogSpent, ogChatId },
      });
      refreshPricing();
    }

    const meta: KamaiMeta = { jobId: job.id, ogChatId, priceUsd, costUsd, hcsSequence: null };
    res.json({ ...explanation, kamai: meta });
    void reportStatus();
  } catch (e) {
    await ledger.markRefundOwed(job.id);
    res.status(500).json({ error: "job_failed", jobId: job.id, reason: String((e as Error).message) });
  }
});

// --- free routes --------------------------------------------------------------

app.get("/quote", (_req, res) => {
  const decision = gate.decide(policy);
  const { priceUsd, estimatedCostUsd } = pricing.price(policy);
  res.json({
    status: decision.ok ? "working" : decision.status,
    reason: decision.ok ? null : decision.reason,
    priceUsd,
    estimatedCostUsd,
    policy,
    ensName: cfg.kamaiEnsName,
  });
});

app.get("/stats", async (_req, res) => {
  const stats = await currentStats();
  res.json({
    ...stats,
    policy,
    ensName: cfg.kamaiEnsName,
    hcsTopicId: cfg.hcsTopicId,
    hcsTopicUrl: cfg.hcsTopicId ? hashScanTopicUrl(cfg.hcsTopicId) : null,
    usdcTokenId: cfg.hederaUsdcTokenId,
    ogProviderAddress: cfg.ogProviderAddress,
  });
});

app.get("/jobs", (_req, res) => {
  const jobs = ledger.recentJobs(50).map((j) => ({
    ...j,
    paymentUrl: j.hederaPaymentTxId ? hashScanTxUrl(j.hederaPaymentTxId) : null,
  }));
  res.json(jobs);
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// --- audit + ENS reporting ------------------------------------------------------

async function publishAudit(event: AuditEvent): Promise<void> {
  try {
    const seq = await audit.publish(event);
    if (seq !== null && event.jobId) await ledger.markHcsSequence(event.jobId, seq);
  } catch (e) {
    console.error(`audit: HCS publish failed: ${(e as Error).message}`);
  }
}

/** Revenue event: called by the settle hook once the facilitator confirms. */
async function bookRevenue(jobId: string, paymentTxId: string, payer: string | null): Promise<void> {
  await ledger.recordPayment(jobId, paymentTxId, payer);
  await publishAudit({
    type: "revenue",
    jobId,
    at: new Date().toISOString(),
    details: { paymentTxId, payer },
  });
}

let jobsSinceReport = 0;
async function reportStatus(): Promise<void> {
  jobsSinceReport++;
  if (jobsSinceReport < 3) return; // every ~3 jobs — Sepolia gas isn't free
  jobsSinceReport = 0;
  const stats = await currentStats();
  await reporter.writeStatus(stats.status);
  await reporter.writeStats(stats);
}

// --- boot -------------------------------------------------------------------------

async function main(): Promise<void> {
  await ledger.load();

  // ENS is the source of truth for the policy: read at startup, then every 5 min.
  try {
    policy = await reporter.readPolicy(policy);
    console.log(`policy from ENS: ${JSON.stringify(policy)}`);
  } catch (e) {
    console.warn(`ENS policy read failed, using defaults: ${(e as Error).message}`);
  }
  setInterval(() => {
    reporter
      .readPolicy(policy)
      .then((p) => {
        policy = p;
        console.log(`policy refreshed from ENS: ${JSON.stringify(p)}`);
      })
      .catch(() => undefined);
  }, 5 * 60 * 1000);

  // warm up the 0G broker so the first job isn't slow
  og
    .ensureReady()
    .then((r) => console.log(`0G ledger: ${r.ledgerOg} OG`))
    .catch((e) => console.error(`0G setup failed: ${(e as Error).message} — run scripts/setup-0g.ts`));

  app.listen(cfg.kamaiPort, () => {
    console.log(`kamai listening on :${cfg.kamaiPort} (${cfg.kamaiEnsName})`);
    console.log(`  facilitator: ${cfg.facilitatorUrl}`);
    console.log(`  HCS topic:   ${cfg.hcsTopicId ?? "(not set — audit log disabled)"}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
