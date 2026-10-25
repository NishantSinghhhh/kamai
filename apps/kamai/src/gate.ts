/**
 * Gate: refuses work kamai cannot afford BEFORE taking payment.
 * Runs ahead of the x402 paywall, so a hungry kamai never sees money.
 */
import type { AgentStatus, GateDecision, Policy } from "@kamai/shared";
import type { Ledger } from "./ledger.js";
import type { Pricing } from "./pricing.js";

export type KamaiState = {
  status: AgentStatus;
  pausedReason: string | null;
};

export class Gate {
  constructor(
    private ledger: Ledger,
    private pricing: Pricing,
    private state: KamaiState,
  ) {}

  get status(): AgentStatus {
    return this.state.status;
  }

  decide(policy: Policy): GateDecision {
    if (this.state.status === "paused") {
      return { ok: false, status: "paused", reason: this.state.pausedReason ?? "paused by owner" };
    }

    const { priceUsd, estimatedCostUsd } = this.pricing.price(policy);

    // Daily compute cap: enforced in kamai's own code; the limit itself is
    // published in ENS where only the owner can change it.
    if (this.ledger.todayComputeUsd() + estimatedCostUsd > policy.maxDailyComputeUsd) {
      return {
        ok: false,
        status: "hungry",
        reason: "hungry: daily compute cap reached",
      };
    }

    // Allowance rule: after this job is paid, can kamai afford the inference?
    if (this.ledger.allowanceUsd() + priceUsd < estimatedCostUsd) {
      return {
        ok: false,
        status: "hungry",
        reason: "hungry: allowance exhausted — kamai must earn before it can think",
      };
    }

    return { ok: true, priceUsd, estimatedCostUsd };
  }
}
