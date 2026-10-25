/**
 * Pricing: price each job from what the job costs kamai.
 *   price = max(floor, estimatedCost × (1 + minMargin))
 * The estimate is the recent average OG spend per job × OG_USD_RATE; for the
 * first jobs, when there is no history, it uses the bootstrap estimate.
 */
import type { Policy } from "@kamai/shared";

export type PricingOpts = {
  /** OG spent per job, as a decimal string; USD cost = value × ogUsdRate. */
  recentOgPerJob: string[]; // newest first
  ogUsdRate: number;
  /** Estimate used before the first job teaches us the real cost. */
  bootstrapCostUsd: number;
};

export class Pricing {
  private recent: string[];

  constructor(private opts: Omit<PricingOpts, "recentOgPerJob">) {
    this.recent = [];
  }

  setRecentOgPerJob(recent: string[]): void {
    this.recent = recent;
  }

  estimateCostUsd(): number {
    const recent = this.recent.slice(0, 10);
    if (recent.length === 0) return this.opts.bootstrapCostUsd;
    const avgOg = recent.reduce((s, v) => s + Number(v), 0) / recent.length;
    return avgOg * this.opts.ogUsdRate;
  }

  price(policy: Policy): { priceUsd: number; estimatedCostUsd: number; marginBps: number } {
    const estimatedCostUsd = this.estimateCostUsd();
    const marginBps = Math.max(policy.minMarginBps, 0);
    const costPlus = estimatedCostUsd * (1 + marginBps / 10_000);
    const priceUsd = Math.max(policy.priceFloorUsd, costPlus);
    // round to a clean 6-decimal USDC amount, always up so margin is preserved
    const rounded = Math.ceil(priceUsd * 1e6) / 1e6;
    return { priceUsd: rounded, estimatedCostUsd, marginBps };
  }
}
