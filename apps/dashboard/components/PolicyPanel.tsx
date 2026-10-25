"use client";

import { usd, type Stats } from "@/lib/api";

export function PolicyPanel({ stats }: { stats: Stats }) {
  const rows: [string, string, string][] = [
    ["kamai.price.floor", usd(stats.policy.priceFloorUsd), "owner"],
    ["kamai.policy.maxDailyComputeUsd", usd(stats.policy.maxDailyComputeUsd), "owner"],
    ["kamai.policy.minMarginBps", `${stats.policy.minMarginBps} bps`, "owner"],
    ["kamai.status", stats.status, "agent"],
    ["kamai.stats", `${stats.jobs} jobs`, "agent"],
  ];
  return (
    <div>
      <ul className="text-[13px]">
        {rows.map(([k, v, who]) => (
          <li key={k} className="flex items-center justify-between gap-4 py-2" style={{ borderTop: "1px dashed var(--border)" }}>
            <span style={{ color: "var(--text-secondary)" }}>{k}</span>
            <span className="flex items-center gap-2">
              <span className="tabular">{v}</span>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide"
                style={{
                  border: "1px solid var(--border)",
                  color: "var(--text-muted)",
                }}
              >
                {who}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
        Policy records are written by the owner. The agent key can only write
        status/stats — trying to raise its own cap reverts with
        EACUnauthorizedAccountRoles.
      </p>
    </div>
  );
}
