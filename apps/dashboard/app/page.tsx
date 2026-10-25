"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, type Job, type Stats } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { StatTiles } from "@/components/StatTiles";
import { RevenueChart } from "@/components/RevenueChart";
import { JobFeed } from "@/components/JobFeed";
import { PolicyPanel } from "@/components/PolicyPanel";

/**
 * Live view over kamai's free routes. Polls every 3s; while a refetch is in
 * flight the previous render holds at reduced opacity — no skeletons, no jump.
 */
export default function Page() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [status, setStatus] = useState<"online" | "offline" | "loading">("loading");
  const refreshing = useRef(false);

  const tick = useCallback(async () => {
    refreshing.current = true;
    try {
      const [s, j] = await Promise.all([api.stats(), api.jobs()]);
      setStats(s);
      setJobs(j);
      setStatus("online");
    } catch {
      setStatus("offline");
    } finally {
      refreshing.current = false;
    }
  }, []);

  useEffect(() => {
    void tick();
    const id = setInterval(tick, 3000);
    return () => clearInterval(id);
  }, [tick]);

  const live = status === "online";
  const badgeStatus = status === "online" && stats ? stats.status : status === "loading" ? "…" : "offline";

  return (
    <main
      className="mx-auto min-h-screen max-w-5xl px-4 py-8 transition-opacity sm:px-6"
      style={{ opacity: refreshing.current && live ? 0.85 : 1 }}
    >
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">kamai</h1>
          <p className="mt-0.5 text-sm" style={{ color: "var(--text-muted)" }}>
            the agent that pays its own bills
          </p>
        </div>
        <div className="flex items-center gap-3">
          {stats ? (
            <span className="hidden text-xs sm:inline" style={{ color: "var(--text-muted)" }}>
              {stats.ensName}
            </span>
          ) : null}
          <StatusBadge status={badgeStatus} />
        </div>
      </header>

      {stats ? (
        <>
          <StatTiles stats={stats} />

          <section
            className="mt-4 rounded-xl border p-4"
            style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
          >
            <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.06em]" style={{ color: "var(--text-muted)" }}>
              Revenue vs compute cost
            </h2>
            <RevenueChart jobs={jobs} />
          </section>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <section
              className="rounded-xl border p-4"
              style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
            >
              <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.06em]" style={{ color: "var(--text-muted)" }}>
                Job feed
              </h2>
              <JobFeed jobs={jobs} />
            </section>

            <section
              className="rounded-xl border p-4"
              style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
            >
              <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.06em]" style={{ color: "var(--text-muted)" }}>
                Policy (from ENS)
              </h2>
              <PolicyPanel stats={stats} />
            </section>
          </div>
        </>
      ) : (
        <div
          className="flex h-48 items-center justify-center rounded-xl border text-sm"
          style={{ background: "var(--surface-1)", borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          {status === "loading"
            ? "connecting to kamai…"
            : "cannot reach kamai on :3000 — is the agent running?"}
        </div>
      )}
    </main>
  );
}
