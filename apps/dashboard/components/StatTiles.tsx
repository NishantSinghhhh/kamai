"use client";

import { usd, type Stats } from "@/lib/api";

export function StatTiles({ stats }: { stats: Stats }) {
  const cap = Math.max(stats.policy.maxDailyComputeUsd, 1e-9);
  const ratio = Math.min(1, stats.todayComputeUsd / cap);
  // meter fill carries severity: accent -> warning -> danger
  const fill = ratio > 0.9 ? "var(--status-critical)" : ratio > 0.75 ? "var(--status-warning)" : "var(--series-revenue)";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Tile label="Revenue" value={usd(stats.revenueUsd)} />
      <Tile label="Compute cost" value={usd(stats.computeCostUsd)} />
      <Tile
        label="Profit"
        value={usd(stats.marginUsd)}
        accent={stats.marginUsd > 0 ? "var(--delta-good)" : undefined}
      />
      <Tile label="Allowance" value={usd(stats.allowanceUsd)} />
      <div
        className="rounded-xl border p-4"
        style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
      >
        <div className="text-xs" style={{ color: "var(--text-muted)" }}>
          Today's compute vs cap
        </div>
        <div className="mt-1 text-[22px] font-semibold leading-tight">
          {usd(stats.todayComputeUsd)}
          <span className="text-sm font-normal" style={{ color: "var(--text-muted)" }}>
            {" "}
            / {usd(cap)}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: "color-mix(in srgb, var(--series-revenue) 18%, transparent)" }}>
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${ratio * 100}%`, background: fill }}
          />
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
    >
      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className="mt-1 text-[22px] font-semibold leading-tight" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
    </div>
  );
}
