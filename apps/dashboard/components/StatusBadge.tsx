"use client";

const STATUS_META: Record<
  string,
  { label: string; color: string; icon: string; hint: string }
> = {
  working: { label: "working", color: "var(--status-good)", icon: "●", hint: "allowance healthy, under the daily cap" },
  hungry: { label: "hungry", color: "var(--status-warning)", icon: "▲", hint: "needs to earn before it can think" },
  paused: { label: "paused", color: "var(--status-critical)", icon: "■", hint: "stopped by the owner" },
  offline: { label: "offline", color: "var(--status-critical)", icon: "■", hint: "cannot reach the agent" },
};

export function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.offline!;
  return (
    <span
      title={meta.hint}
      className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium"
      style={{ borderColor: "var(--border)" }}
    >
      <span aria-hidden style={{ color: meta.color, fontSize: 10 }}>
        {meta.icon}
      </span>
      {meta.label}
    </span>
  );
}
