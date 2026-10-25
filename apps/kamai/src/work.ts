/**
 * The actual work: fetch the Hedera transaction from the Mirror Node, explain
 * it with 0G Compute inference, and validate the JSON the model returns.
 * If the model returns unusable JSON we fall back to a minimal explanation
 * built from the Mirror Node data and the caller marks it in the ledger.
 */
import type { Explanation } from "@kamai/shared";

// ---------------------------------------------------------------------------
// Mirror Node
// ---------------------------------------------------------------------------

export type MirrorTx = {
  transactionId: string;
  memo: string;
  type: string;
  result: string;
  consensusTimestamp: string;
  transfers: { account: string; amount: number }[];
  tokenTransfers: { tokenId: string; account: string; amount: number; decimals?: number }[];
  fee: number;
};

export async function fetchTx(mirrorNodeUrl: string, txId: string): Promise<MirrorTx | null> {
  const base = mirrorNodeUrl.replace(/\/+$/, "");
  const mirrorId = txId.replace("@", "-").replace(".", "-");
  const res = await fetch(`${base}/api/v1/transactions/${mirrorId}`);
  if (!res.ok) return null;
  const body = (await res.json()) as { transactions?: unknown[] };
  const tx = body.transactions?.[0] as MirrorTx | undefined;
  return tx ?? null;
}

export function describeTx(tx: MirrorTx): string {
  const lines = [
    `Transaction ID: ${tx.transactionId}`,
    `Type: ${tx.type}`,
    `Result: ${tx.result}`,
    `Consensus timestamp: ${tx.consensusTimestamp}`,
    `Memo: ${tx.memo || "(none)"}`,
    `Fee: ${tx.fee} tinybars`,
  ];
  if (tx.transfers?.length) {
    lines.push("Hbar transfers:");
    for (const t of tx.transfers) lines.push(`  ${t.account}: ${t.amount}`);
  }
  if (tx.tokenTransfers?.length) {
    lines.push("Token transfers:");
    for (const t of tx.tokenTransfers) lines.push(`  ${t.account}: ${t.amount} of ${t.tokenId}`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// 0G Compute — @0gfoundation/0g-compute-ts-sdk
//
// Real API (from the SDK's .d.ts):
//   createZGComputeNetworkBroker(signer) → broker
//   broker.ledger.getLedger()            → { totalBalance: bigint, … }
//   broker.inference.acknowledgeProviderSigner(provider)
//   broker.inference.getServiceMetadata(provider, model?) → { endpoint, model }
//   broker.inference.getRequestHeaders(provider, content) → billing headers
// then call the endpoint with the OpenAI client, passing the headers.
// ---------------------------------------------------------------------------

export type OgJobResult = {
  chatId: string | null;
  ogSpent: string; // decimal OG
  explanation: Explanation;
};

type Broker = {
  ledger: { getLedger(): Promise<{ totalBalance: bigint; availableBalance: bigint }> };
  inference: {
    getServiceMetadata(provider: string, model?: string): Promise<{ endpoint: string; model: string }>;
    getRequestHeaders(provider: string, content?: string): Promise<Record<string, string>>;
    acknowledgeProviderSigner(provider: string): Promise<void>;
  };
};

export class OgCompute {
  private broker: Broker | null = null;

  constructor(
    private opts: { rpcUrl: string; privateKey: string; providerAddress: string; model?: string },
  ) {}

  private async getBroker(): Promise<Broker> {
    if (this.broker) return this.broker;
    const { createZGComputeNetworkBroker } = await import("@0gfoundation/0g-compute-ts-sdk");
    const { ethers } = await import("ethers");
    const provider = new ethers.JsonRpcProvider(this.opts.rpcUrl);
    const signer = new ethers.Wallet(this.opts.privateKey, provider);
    this.broker = (await createZGComputeNetworkBroker(signer as never)) as unknown as Broker;
    return this.broker;
  }

  /** One-time setup (scripts/setup-0g.ts also uses this): fund check + acknowledge. */
  async ensureReady(): Promise<{ ledgerOg: string }> {
    const broker = await this.getBroker();
    const ledger = await broker.ledger.getLedger();
    const ledgerOg = formatOg(ledger.totalBalance);
    if (ledgerOg === "0") {
      throw new Error("0G ledger is empty — fund it via scripts/setup-0g.ts first");
    }
    try {
      await broker.inference.acknowledgeProviderSigner(this.opts.providerAddress);
    } catch {
      // already acknowledged — the contract reverts; safe to ignore here
    }
    return { ledgerOg };
  }

  async explain(txId: string, txDescription: string): Promise<OgJobResult> {
    const broker = await this.getBroker();
    const { endpoint, model } = await broker.inference.getServiceMetadata(this.opts.providerAddress, this.opts.model);

    const user = `Explain this Hedera transaction.\n\nTransaction ID: ${txId}\n\nRaw mirror-node data:\n${txDescription}`;
    // billing headers are per-request; content is what the provider settles on
    const headers = await broker.inference.getRequestHeaders(this.opts.providerAddress, user);

    const balanceBefore = (await broker.ledger.getLedger()).totalBalance;

    const openai = new (await import("openai")).default({ baseURL: endpoint, apiKey: "" });
    const completion = await openai.chat.completions.create(
      {
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: user },
        ],
      },
      { headers },
    );

    const chatId = completion.id ?? null;
    const raw = completion.choices[0]?.message?.content ?? "";

    // ledger balance before/after is the honest cost measure (see SPEC §13);
    // settlement can lag, so if the balance hasn't moved yet we bill the
    // provider's quoted fee path later — for now record what moved
    const balanceAfter = (await broker.ledger.getLedger()).totalBalance;
    const delta = balanceBefore > balanceAfter ? balanceBefore - balanceAfter : 0n;
    const ogSpent = formatOg(delta);

    return { chatId, ogSpent, explanation: parseExplanation(txId, raw, null) };
  }

  /** Read the current ledger balance (dashboard + setup script). */
  async ledgerBalanceOg(): Promise<string> {
    const broker = await this.getBroker();
    return formatOg((await broker.ledger.getLedger()).totalBalance);
  }
}

const SYSTEM_PROMPT =
  "You explain Hedera transactions for automated agents. " +
  'Answer ONLY with a JSON object of shape {"txId": string, "summary": string, ' +
  '"kind": string, "parties": [{"account": string, "role": string}], ' +
  '"risk": "low"|"medium"|"high", "riskReason": string}. ' +
  "kind is one of: token_transfer, hbar_transfer, contract_call, topic_message, " +
  "account_create, token_create, other.";

export function formatOg(wei: bigint): string {
  // 0G uses 18 decimals like ETH; keep 9 decimals of precision
  const whole = wei / 10n ** 18n;
  const frac = (wei % 10n ** 18n).toString().padStart(18, "0").slice(0, 9).replace(/0+$/, "");
  return frac === "" ? whole.toString() : `${whole}.${frac}`;
}

// ---------------------------------------------------------------------------
// Answer validation + fallback
// ---------------------------------------------------------------------------

const KINDS = new Set([
  "token_transfer",
  "hbar_transfer",
  "contract_call",
  "topic_message",
  "account_create",
  "token_create",
  "other",
]);

export function parseExplanation(txId: string, raw: string, fallback: MirrorTx | null): Explanation {
  const json = extractJson(raw);
  if (json) {
    const risk = json.risk === "medium" || json.risk === "high" ? json.risk : "low";
    const kind = typeof json.kind === "string" && KINDS.has(json.kind) ? json.kind : "other";
    if (typeof json.summary === "string" && json.summary.length > 0) {
      const parties = Array.isArray(json.parties)
        ? json.parties
            .filter((p: unknown) => typeof p === "object" && p !== null)
            .map((p: { account?: unknown; role?: unknown }) => ({
              account: String((p as { account?: unknown }).account ?? ""),
              role: String((p as { role?: unknown }).role ?? "party"),
            }))
        : [];
      return {
        txId,
        summary: json.summary,
        kind,
        parties,
        risk,
        riskReason: typeof json.riskReason === "string" ? json.riskReason : "",
      };
    }
  }
  if (fallback) return minimalExplanation(txId, fallback);
  throw new Error("model returned unusable JSON and no mirror-node fallback was available");
}

function extractJson(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim().replace(/^```(?:json)?/m, "").replace(/```$/m, "").trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** Built from mirror-node data alone — what kamai serves if the model fails. */
export function minimalExplanation(txId: string, tx: MirrorTx): Explanation {
  const parties: Explanation["parties"] = [];
  for (const t of tx.tokenTransfers ?? []) {
    parties.push({ account: t.account, role: t.amount >= 0 ? "payee" : "payer" });
  }
  for (const t of tx.transfers ?? []) {
    if (!parties.some((p) => p.account === t.account)) {
      parties.push({ account: t.account, role: t.amount >= 0 ? "payee" : "payer" });
    }
  }
  const kind = (tx.tokenTransfers?.length ?? 0) > 0 ? "token_transfer" : "other";
  return {
    txId,
    summary: `${tx.type} transaction ${txId} with result ${tx.result}`,
    kind,
    parties,
    risk: "low",
    riskReason: "Derived from mirror-node data without model inference (fallback)",
  };
}
