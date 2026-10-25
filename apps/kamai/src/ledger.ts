/**
 * Ledger: one JSON file. Tracks every job, cumulative revenue/cost, and the
 * daily compute spend that backs the `maxDailyComputeUsd` cap.
 *
 * Kamai earns real USDC on Hedera and spends real OG on 0G. The ledger keeps
 * everything in USD terms: revenue is settled USDC, cost is OG × OG_USD_RATE.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Job, LedgerData, JobStatus } from "@kamai/shared";

export type LedgerOpts = {
  file: string;
  startingFloatUsd: number;
  ogUsdRate: number;
};

export class Ledger {
  private data: LedgerData;
  private writing: Promise<void> = Promise.resolve();

  constructor(private opts: LedgerOpts) {
    this.data = { floatUsd: opts.startingFloatUsd, jobs: [], totalOgSpent: "0", dailyComputeUsd: {} };
  }

  async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.opts.file, "utf8");
      const parsed = JSON.parse(raw) as LedgerData;
      this.data = {
        floatUsd: parsed.floatUsd ?? this.opts.startingFloatUsd,
        jobs: parsed.jobs ?? [],
        totalOgSpent: parsed.totalOgSpent ?? "0",
        dailyComputeUsd: parsed.dailyComputeUsd ?? {},
      };
    } catch (e: unknown) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") throw e;
      await this.flush();
    }
  }

  private async flush(): Promise<void> {
    const dir = path.dirname(this.opts.file);
    await fs.mkdir(dir, { recursive: true });
    const tmp = `${this.opts.file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(this.data, null, 2));
    await fs.rename(tmp, this.opts.file);
  }

  /** Serialize mutations so concurrent jobs never interleave ledger writes. */
  private mutate<T>(fn: () => T): Promise<T> {
    const next = this.writing.then(() => {
      const out = fn();
      return this.flush().then(() => out);
    });
    this.writing = next.then(() => undefined, () => undefined);
    return next;
  }

  todayKey(): string {
    return new Date().toISOString().slice(0, 10);
  }

  todayComputeUsd(): number {
    return this.data.dailyComputeUsd[this.todayKey()] ?? 0;
  }

  /**
   * The compute allowance: everything kamai has earned minus everything it has
   * spent on compute, plus the starting float. If this is ≤ 0, kamai cannot
   * afford its next inference.
   */
  allowanceUsd(): number {
    const revenue = this.data.jobs
      .filter((j) => j.status !== "refund_owed")
      .reduce((s, j) => s + j.priceUsd, 0);
    const cost = this.data.jobs.reduce((s, j) => s + (j.costUsd ?? 0), 0);
    return revenue + this.data.floatUsd - cost;
  }

  revenueUsd(): number {
    return this.data.jobs
      .filter((j) => j.status !== "refund_owed")
      .reduce((s, j) => s + j.priceUsd, 0);
  }

  computeCostUsd(): number {
    return this.data.jobs.reduce((s, j) => s + (j.costUsd ?? 0), 0);
  }

  jobs(): Job[] {
    return [...this.data.jobs].reverse(); // newest first
  }

  recentJobs(n: number): Job[] {
    return this.jobs().slice(0, n);
  }

  createJob(input: {
    customer: string | null;
    txId: string;
    priceUsd: number;
    revenueAtomic: string;
    hederaPaymentTxId: string;
  }): Promise<Job> {
    return this.mutate(() => {
      const job: Job = {
        id: crypto.randomUUID(),
        ...input,
        ogChatId: null,
        ogSpent: null,
        costUsd: null,
        status: "paid",
        hcsSequence: null,
        createdAt: new Date().toISOString(),
      };
      this.data.jobs.push(job);
      return job;
    });
  }

  recordResult(jobId: string, result: { ogChatId: string; ogSpent: string; costUsd: number; status?: JobStatus }): Promise<Job | null> {
    return this.mutate(() => {
      const job = this.data.jobs.find((j) => j.id === jobId);
      if (!job) return null;
      job.ogChatId = result.ogChatId;
      job.ogSpent = result.ogSpent;
      job.costUsd = result.costUsd;
      if (result.status) job.status = result.status;
      if (job.status === "done") {
        this.data.totalOgSpent = addOg(this.data.totalOgSpent, result.ogSpent);
        this.data.dailyComputeUsd[this.todayKey()] =
          (this.data.dailyComputeUsd[this.todayKey()] ?? 0) + result.costUsd;
      }
      return { ...job };
    });
  }

  markRefundOwed(jobId: string): Promise<Job | null> {
    return this.mutate(() => {
      const job = this.data.jobs.find((j) => j.id === jobId);
      if (!job) return null;
      job.status = "refund_owed";
      return { ...job };
    });
  }

  markHcsSequence(jobId: string, sequence: number): Promise<void> {
    return this.mutate(() => {
      const job = this.data.jobs.find((j) => j.id === jobId);
      if (job) job.hcsSequence = sequence;
    });
  }

  /** Fill in the settled payment details once the facilitator confirms. */
  recordPayment(jobId: string, paymentTxId: string, payer: string | null): Promise<Job | null> {
    return this.mutate(() => {
      const job = this.data.jobs.find((j) => j.id === jobId);
      if (!job) return null;
      if (paymentTxId) job.hederaPaymentTxId = paymentTxId;
      if (payer) job.customer = payer;
      return { ...job };
    });
  }
}

/** Decimal-string addition for OG amounts (18 "decimals" worth of precision). */
export function addOg(a: string, b: string): string {
  const scale = 1e9; // keep 9 decimals; OG amounts never need more precision here
  const sum = Math.round(Number(a) * scale) + Math.round(Number(b) * scale);
  return (sum / scale).toFixed(9).replace(/0+$/, "").replace(/\.$/, "");
}
