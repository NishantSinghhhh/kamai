/**
 * Customer bots: autonomous buyers. Each bot
 *   1. resolves kamai.<you>.eth → url (and the policy records) — ENS only,
 *   2. picks a recent real Hedera transaction from the Mirror Node,
 *   3. checks /quote,
 *   4. pays through x402 (Hedera exact scheme) and prints the explanation
 *      and proof links,
 *   5. stops at its own budget.
 * No human approval anywhere in the loop.
 *
 *   npm run customers -- --bots 3 --interval 8 --budget 1
 */
import { PrivateKey } from "@hiero-ledger/sdk";
import { createClientHederaSigner } from "@x402/hedera";
import { ExactHederaScheme } from "@x402/hedera/exact/client";
import { x402Client } from "@x402/fetch";
import { wrapFetchWithPayment } from "@x402/fetch";
import { createEnsClients, readRecord, ENS_RECORD_KEYS, loadConfig, type CustomerAccount } from "@kamai/shared";

type BuyerOptions = {
  bots: number;
  intervalSec: number;
  budgetUsd: number;
};

function parseArgs(argv: string[]): BuyerOptions {
  const opts: BuyerOptions = { bots: 1, intervalSec: 8, budgetUsd: 1 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--bots") opts.bots = Number(argv[++i]);
    else if (argv[i] === "--interval") opts.intervalSec = Number(argv[++i]);
    else if (argv[i] === "--budget") opts.budgetUsd = Number(argv[++i]);
  }
  return opts;
}

type ExplanationRes = {
  txId: string;
  summary: string;
  kind: string;
  risk: string;
  riskReason: string;
  kamai: {
    jobId: string;
    ogChatId: string | null;
    priceUsd: number;
    costUsd: number | null;
    hcsSequence: number | null;
  };
};

async function main(): Promise<void> {
  const cfg = loadConfig();
  const opts = parseArgs(process.argv.slice(2));
  console.log(`${opts.bots} customer bot(s), interval ${opts.intervalSec}s, budget $${opts.budgetUsd} each`);

  // 1. the service URL comes from ENS — no hard-coded endpoint
  const clients = createEnsClients({
    rpcUrl: cfg.sepoliaRpcUrl,
    ensName: cfg.kamaiEnsName,
    ownerPrivateKey: cfg.ensOwnerPrivateKey,
    agentPrivateKey: cfg.ensAgentPrivateKey,
  });
  const serviceUrl = await readRecord(clients, cfg.kamaiEnsName, ENS_RECORD_KEYS.url);
  if (!serviceUrl) throw new Error(`no url record on ${cfg.kamaiEnsName} — run scripts/ens-publish.ts`);
  console.log(`resolved ${cfg.kamaiEnsName} → ${serviceUrl}`);

  const bots = cfg.customers.slice(0, opts.bots);
  if (bots.length < opts.bots) {
    console.warn(`only ${bots.length} customer accounts in .env, running ${bots.length}`);
  }
  await Promise.all(bots.map((acct, i) => runBot(i + 1, acct, serviceUrl, opts)));
}

async function runBot(botNumber: number, account: CustomerAccount, serviceUrl: string, opts: BuyerOptions): Promise<void> {
  const log = (msg: string) => console.log(`[bot-${botNumber}] ${new Date().toISOString()} ${msg}`);
  let spentUsd = 0;

  const signer = createClientHederaSigner(account.accountId, PrivateKey.fromString(account.privateKey));
  const client = new x402Client().register("hedera:testnet", new ExactHederaScheme(signer));
  const fetchWithPay = wrapFetchWithPayment(globalThis.fetch, client);

  while (spentUsd < opts.budgetUsd) {
    try {
      const txId = await pickRandomRecentTx();
      const quoteRes = await fetch(`${serviceUrl}/quote`);
      const quote = (await quoteRes.json()) as { priceUsd?: number; status?: string; reason?: string | null };
      if (quote.status !== "working") {
        log(`kamai is ${quote.status}: ${quote.reason ?? ""}`);
        await sleep(opts.intervalSec * 1000);
        continue;
      }
      const price = quote.priceUsd ?? 0;
      if (spentUsd + price > opts.budgetUsd) {
        log(`budget exhausted (spent $${spentUsd.toFixed(4)})`);
        break;
      }

      log(`paying $${price} to explain ${txId} …`);
      const res = await fetchWithPay(`${serviceUrl}/explain?tx=${encodeURIComponent(txId)}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { reason?: string };
        log(`failed: ${res.status} ${body.reason ?? ""}`);
        await sleep(opts.intervalSec * 1000);
        continue;
      }
      const body = (await res.json()) as ExplanationRes;
      spentUsd += body.kamai.priceUsd;
      log(`✔ ${body.summary}`);
      log(`  risk=${body.risk} kind=${body.kind} paid=$${body.kamai.priceUsd} cost=$${body.kamai.costUsd ?? "?"}`);
      log(`  job=${body.kamai.jobId} ogChat=${body.kamai.ogChatId ?? "-"} hcsSeq=${body.kamai.hcsSequence ?? "-"}`);
    } catch (e) {
      log(`error: ${(e as Error).message}`);
      await sleep(opts.intervalSec * 1000);
    }
  }
  log(`done, spent $${spentUsd.toFixed(4)}`);
}

/** Pick a recent, successful transaction from the Mirror Node so the demo explains real chains. */
async function pickRandomRecentTx(): Promise<string> {
  const res = await fetch(
    "https://testnet.mirrornode.hedera.com/api/v1/transactions?limit=25&order=desc&result=success",
  );
  const body = (await res.json()) as { transactions?: { transaction_id: string }[] };
  const txs = body.transactions ?? [];
  if (txs.length === 0) throw new Error("mirror node returned no transactions");
  const pick = txs[Math.floor(Math.random() * txs.length)]!;
  return pick.transaction_id;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
