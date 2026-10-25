/** Typed client for kamai's free routes. No secrets here — /stats and /jobs are public by design. */

const API = process.env.NEXT_PUBLIC_KAMAI_API ?? "http://localhost:3000";

export type Policy = {
  priceFloorUsd: number;
  maxDailyComputeUsd: number;
  minMarginBps: number;
};

export type Stats = {
  jobs: number;
  revenueUsd: number;
  computeCostUsd: number;
  marginUsd: number;
  allowanceUsd: number;
  todayComputeUsd: number;
  status: "working" | "hungry" | "paused";
  policy: Policy;
  ensName: string;
  hcsTopicId: string | null;
  hcsTopicUrl: string | null;
  usdcTokenId: string;
  ogProviderAddress: string;
};

export type Job = {
  id: string;
  customer: string | null;
  txId: string;
  priceUsd: number;
  costUsd: number | null;
  status: "paid" | "done" | "refund_owed";
  ogChatId: string | null;
  hcsSequence: number | null;
  hederaPaymentTxId: string;
  paymentUrl: string | null;
  createdAt: string;
};

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  stats: () => get<Stats>("/stats"),
  jobs: () => get<Job[]>("/jobs"),
};

export const usd = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return "—";
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}K`;
  return `$${v.toFixed(4).replace(/0+$/, "")}`;
};

export const compact = (v: number): string =>
  Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}K` : v < 10 ? v.toFixed(2).replace(/0+$/, "").replace(/\.$/, "") : Math.round(v).toString();
