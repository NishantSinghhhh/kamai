"use client";

import { usd, type Job } from "@/lib/api";

export function JobFeed({ jobs }: { jobs: Job[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left" style={{ color: "var(--text-muted)" }}>
            <th className="py-2 pr-3 font-medium">time</th>
            <th className="py-2 pr-3 font-medium">tx explained</th>
            <th className="py-2 pr-3 font-medium">price</th>
            <th className="py-2 pr-3 font-medium">cost</th>
            <th className="py-2 pr-3 font-medium">margin</th>
            <th className="py-2 pr-3 font-medium">proof</th>
          </tr>
        </thead>
        <tbody>
          {jobs.slice(0, 12).map((j) => {
            const margin = j.costUsd === null ? null : j.priceUsd - j.costUsd;
            return (
              <tr key={j.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td className="py-2 pr-3 tabular" style={{ color: "var(--text-secondary)" }}>
                  {new Date(j.createdAt).toLocaleTimeString()}
                </td>
                <td className="max-w-[220px] truncate py-2 pr-3" title={j.txId}>
                  {j.txId}
                </td>
                <td className="py-2 pr-3 tabular">{usd(j.priceUsd)}</td>
                <td className="py-2 pr-3 tabular">{usd(j.costUsd)}</td>
                <td className="py-2 pr-3 tabular">{usd(margin)}</td>
                <td className="py-2 pr-3">
                  {j.status === "refund_owed" ? (
                    <span style={{ color: "var(--status-critical)" }}>refund owed</span>
                  ) : null}
                  {j.paymentUrl ? (
                    <a
                      href={j.paymentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline decoration-dotted underline-offset-2"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      payment
                    </a>
                  ) : null}
                  {j.ogChatId ? (
                    <span title={j.ogChatId} style={{ color: "var(--text-muted)" }}>
                      {j.paymentUrl ? " · " : ""}
                      0G chat
                    </span>
                  ) : null}
                  {j.hcsSequence !== null ? (
                    <span style={{ color: "var(--text-muted)" }}>
                      {j.paymentUrl || j.ogChatId ? " · " : ""}
                      HCS #{j.hcsSequence}
                    </span>
                  ) : null}
                  {!j.paymentUrl && !j.ogChatId && j.hcsSequence === null && j.status !== "refund_owed"
                    ? "—"
                    : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {jobs.length === 0 ? (
        <p className="py-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          No jobs yet.
        </p>
      ) : null}
    </div>
  );
}
