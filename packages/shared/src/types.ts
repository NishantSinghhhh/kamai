/** Core types shared across the kamai service, customer bots and dashboard. */

export type AgentStatus = "working" | "hungry" | "paused";

/** Policy the OWNER publishes to ENS. The agent can read it, never write it. */
export type Policy = {
  priceFloorUsd: number; // kamai.price.floor
  maxDailyComputeUsd: number; // kamai.policy.maxDailyComputeUsd
  minMarginBps: number; // kamai.policy.minMarginBps
};

export type JobStatus = "paid" | "done" | "refund_owed";

export type Job = {
  id: string;
  customer: string | null; // payer account from the settle response
  txId: string; // the transaction being explained
  priceUsd: number;
  revenueAtomic: string; // USDC settled, 6 decimals
  hederaPaymentTxId: string;
  ogChatId: string | null;
  ogSpent: string | null; // OG, as a decimal string
  costUsd: number | null;
  status: JobStatus;
  hcsSequence: number | null;
  createdAt: string;
};

export type Stats = {
  jobs: number;
  revenueUsd: number;
  computeCostUsd: number;
  marginUsd: number;
  allowanceUsd: number;
  todayComputeUsd: number;
  status: AgentStatus;
};

/** Why the gate refused a job (or why it is in a given status). */
export type GateDecision =
  | { ok: true; priceUsd: number; estimatedCostUsd: number }
  | { ok: false; status: AgentStatus; reason: string };

/** The structured answer kamai sells. */
export type Explanation = {
  txId: string;
  summary: string;
  kind: string;
  parties: { account: string; role: string }[];
  risk: "low" | "medium" | "high";
  riskReason: string;
};

/** Metadata kamai attaches to every successful answer. */
export type KamaiMeta = {
  jobId: string;
  ogChatId: string | null;
  priceUsd: number;
  costUsd: number | null;
  hcsSequence: number | null;
};

export type LedgerData = {
  floatUsd: number;
  jobs: Job[];
  /** Cumulative OG spent, as a decimal string. */
  totalOgSpent: string;
  /** Daily compute spend, keyed by UTC date (YYYY-MM-DD), in USD. */
  dailyComputeUsd: Record<string, number>;
};

/** One audit event on the HCS topic. */
export type AuditEvent = {
  type: "revenue" | "cost" | "refund_owed" | "status";
  jobId: string;
  at: string;
  amountUsd?: number;
  details?: Record<string, unknown>;
};
