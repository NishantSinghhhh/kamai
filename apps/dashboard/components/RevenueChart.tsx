"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { compact, usd, type Job } from "@/lib/api";

type Series = { name: string; color: string; values: number[] };

/**
 * Cumulative revenue vs compute cost, one point per job.
 * 2px lines, hairline grid, crosshair + all-series tooltip, legend,
 * end-markers with a surface ring. Y-axis in clean USD steps.
 */
export function RevenueChart({ jobs }: { jobs: Job[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 100) setWidth(Math.floor(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const height = 220;
  const pad = { top: 16, right: 88, bottom: 26, left: 48 };
  const innerW = Math.max(width - pad.left - pad.right, 10);
  const innerH = height - pad.top - pad.bottom;

  const series: Series[] = useMemo(() => {
    let rev = 0;
    let cost = 0;
    const revenue: number[] = [];
    const costs: number[] = [];
    for (const j of jobs) {
      if (j.status !== "refund_owed") rev += j.priceUsd;
      cost += j.costUsd ?? 0;
      revenue.push(rev);
      costs.push(cost);
    }
    return [
      { name: "Revenue", color: "var(--series-revenue)", values: revenue },
      { name: "Cost", color: "var(--series-cost)", values: costs },
    ];
  }, [jobs]);

  const n = series[0]?.values.length ?? 0;
  const max = Math.max(1e-6, ...series.flatMap((s) => s.values));
  const yMax = niceMax(max);
  const x = (i: number): number => (n <= 1 ? pad.left : pad.left + (i / (n - 1)) * innerW);
  const y = (v: number): number => pad.top + innerH - (v / yMax) * innerH;

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (n === 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const frac = (px - pad.left) / innerW;
      const idx = Math.round(frac * Math.max(n - 1, 0));
      setHover(Math.max(0, Math.min(n - 1, idx)));
    },
    [n, innerW],
  );

  if (n === 0) {
    return (
      <div
        ref={containerRef}
        className="flex h-[220px] items-center justify-center rounded-xl border text-sm"
        style={{ background: "var(--surface-1)", borderColor: "var(--border)", color: "var(--text-muted)" }}
      >
        No jobs yet — start the buyer bots and the P&L draws itself here.
      </div>
    );
  }

  const ticks = [0, yMax / 4, yMax / 2, (3 * yMax) / 4, yMax];
  const hovered = hover !== null && hover < n;

  return (
    <div>
      <Legend series={series} />
      <div ref={containerRef} className="relative">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label="Cumulative revenue versus compute cost per job"
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHover(null)}
          className="block"
        >
          {/* gridlines: hairline, recessive */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={pad.left + innerW} y1={y(t)} y2={y(t)} stroke="var(--gridline)" strokeWidth={1} />
              <text x={pad.left - 10} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--text-muted)" className="tabular">
                ${compact(t)}
              </text>
            </g>
          ))}
          {/* baseline */}
          <line x1={pad.left} x2={pad.left + innerW} y1={y(0)} y2={y(0)} stroke="var(--baseline)" strokeWidth={1} />

          {/* series lines: 2px, round joins */}
          {series.map((s) => (
            <path
              key={s.name}
              d={s.values.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {/* end markers with a 2px surface ring + direct labels */}
          {series.map((s) => {
            const cx = x(n - 1);
            const cy = y(s.values[n - 1]!);
            return (
              <g key={s.name}>
                <circle cx={cx} cy={cy} r={6} fill="var(--surface-1)" />
                <circle cx={cx} cy={cy} r={4} fill={s.color} />
                <text x={cx + 10} y={cy + 4} fontSize={11} fill="var(--text-secondary)">
                  {s.name}
                </text>
              </g>
            );
          })}

          {/* crosshair: vertical hairline snapped to the nearest job */}
          {hovered && hover !== null ? (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={pad.top}
              y2={pad.top + innerH}
              stroke="var(--baseline)"
              strokeWidth={1}
            />
          ) : null}
        </svg>

        {/* tooltip: values lead, labels follow; line keys, not boxes */}
        {hovered && hover !== null ? (
          <Tooltip x={x(hover)} width={width} values={series.map((s) => ({ ...s, value: s.values[hover]! }))} />
        ) : null}
      </div>
      <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
        {n} job{n === 1 ? "" : "s"} — the gap between the lines is profit
      </div>
    </div>
  );
}

function Legend({ series }: { series: Series[] }) {
  return (
    <div className="mb-2 flex items-center justify-end gap-4">
      {series.map((s) => (
        <span key={s.name} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
          <span aria-hidden className="inline-block h-0.5 w-4 rounded-full" style={{ background: s.color }} />
          {s.name}
        </span>
      ))}
    </div>
  );
}

function Tooltip({
  x,
  width,
  values,
}: {
  x: number;
  width: number;
  values: { name: string; color: string; value: number }[];
}) {
  const w = 170;
  const left = Math.min(Math.max(x - w / 2, 0), Math.max(width - w, 0));
  return (
    <div
      className="pointer-events-none absolute top-2 rounded-lg border px-3 py-2 text-xs shadow-lg"
      style={{
        left,
        width: w,
        background: "var(--surface-1)",
        borderColor: "var(--border)",
      }}
    >
      {values.map((v) => (
        <div key={v.name} className="flex items-center justify-between gap-3 py-0.5">
          <span className="flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
            <span aria-hidden className="inline-block h-0.5 w-3 rounded-full" style={{ background: v.color }} />
            {v.name}
          </span>
          <span className="font-semibold tabular">{usd(v.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Round up to a clean 1/2/5×10^k ceiling for the y-axis. */
function niceMax(max: number): number {
  if (max <= 0) return 1;
  const exp = Math.floor(Math.log10(max));
  const base = Math.pow(10, exp);
  for (const m of [1, 2, 5, 10]) {
    if (max <= m * base) return m * base;
  }
  return 10 * base;
}
