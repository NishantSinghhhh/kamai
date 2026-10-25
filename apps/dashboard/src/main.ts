/** Dashboard: live P&L, status, job feed, policy panel. Reads kamai's free routes. */

const API = (import.meta.env.VITE_KAMAI_API as string | undefined) ?? "http://localhost:3000";

type StatsRes = {
  jobs: number;
  revenueUsd: number;
  computeCostUsd: number;
  marginUsd: number;
  allowanceUsd: number;
  todayComputeUsd: number;
  status: "working" | "hungry" | "paused";
  policy: { priceFloorUsd: number; maxDailyComputeUsd: number; minMarginBps: number };
  ensName: string;
  hcsTopicId: string | null;
  hcsTopicUrl: string | null;
};

type JobRes = {
  id: string;
  customer: string | null;
  txId: string;
  priceUsd: number;
  costUsd: number | null;
  status: string;
  ogChatId: string | null;
  hcsSequence: number | null;
  hederaPaymentTxId: string;
  paymentUrl: string | null;
  createdAt: string;
};

const usd = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : `$${v.toFixed(4).replace(/0+$/, "")}`;

function badgeEl(): HTMLElement {
  const el = document.getElementById("status-badge")!;
  return el;
}

function renderStats(s: StatsRes): void {
  const badge = badgeEl();
  badge.textContent = s.status;
  badge.className = `badge ${s.status}`;

  document.getElementById("revenue")!.textContent = usd(s.revenueUsd);
  document.getElementById("cost")!.textContent = usd(s.computeCostUsd);
  document.getElementById("profit")!.textContent = usd(s.marginUsd);
  document.getElementById("allowance")!.textContent = usd(s.allowanceUsd);

  const pct = Math.min(100, (s.todayComputeUsd / Math.max(s.policy.maxDailyComputeUsd, 1e-9)) * 100);
  document.getElementById("daily")!.textContent = `${usd(s.todayComputeUsd)} / ${usd(s.policy.maxDailyComputeUsd)}`;
  document.getElementById("daily-meter")!.style.width = `${pct}%`;

  const policyEl = document.getElementById("policy")!;
  policyEl.innerHTML = "";
  for (const [k, v] of [
    ["kamai.price.floor", usd(s.policy.priceFloorUsd)],
    ["kamai.policy.maxDailyComputeUsd", usd(s.policy.maxDailyComputeUsd)],
    ["kamai.policy.minMarginBps", `${s.policy.minMarginBps} bps`],
    ["kamai.status (agent-written)", s.status],
    ["ENS name", s.ensName],
    ["HCS topic", s.hcsTopicId ?? "—"],
  ] as [string, string][]) {
    const li = document.createElement("li");
    li.innerHTML = `<span>${k}</span><span>${escapeHtml(v)}</span>`;
    policyEl.appendChild(li);
  }
}

function renderJobs(jobs: JobRes[]): void {
  const tbody = document.querySelector("#jobs tbody")!;
  tbody.innerHTML = "";
  for (const j of jobs.slice(0, 15)) {
    const tr = document.createElement("tr");
    const margin = j.costUsd === null ? null : j.priceUsd - j.costUsd;
    const proofs: string[] = [];
    if (j.paymentUrl) proofs.push(`<a href="${j.paymentUrl}" target="_blank">payment</a>`);
    if (j.ogChatId) proofs.push(`<span title="${escapeHtml(j.ogChatId)}">0G chat</span>`);
    if (j.hcsSequence !== null) proofs.push(`<span>HCS #${j.hcsSequence}</span>`);
    tr.innerHTML = `
      <td>${new Date(j.createdAt).toLocaleTimeString()}</td>
      <td title="${escapeHtml(j.txId)}">${escapeHtml(j.txId.slice(0, 24))}…</td>
      <td>${usd(j.priceUsd)}</td>
      <td>${usd(j.costUsd)}</td>
      <td>${usd(margin)}</td>
      <td>${j.status === "refund_owed" ? '<span style="color:var(--danger)">refund owed</span> ' : ""}${proofs.join(" · ") || "—"}</td>`;
    tbody.appendChild(tr);
  }
}

/** Cumulative revenue and cost curves, newest right. */
function renderChart(jobs: JobRes[]): void {
  const svg = document.getElementById("chart")!;
  const oldestFirst = [...jobs].reverse();
  let rev = 0;
  let cost = 0;
  const revPts: number[] = [];
  const costPts: number[] = [];
  for (const j of oldestFirst) {
    if (j.status !== "refund_owed") rev += j.priceUsd;
    cost += j.costUsd ?? 0;
    revPts.push(rev);
    costPts.push(cost);
  }
  const max = Math.max(1e-6, ...revPts, ...costPts);
  const n = Math.max(revPts.length - 1, 1);
  const toPath = (pts: number[]): string =>
    pts.map((v, i) => `${i === 0 ? "M" : "L"} ${(i / n) * 600} ${150 - (v / max) * 140}`).join(" ") ||
    "M 0 150 L 600 150";

  svg.innerHTML = `
    <path d="${toPath(revPts)}" fill="none" stroke="var(--accent)" stroke-width="2"/>
    <path d="${toPath(costPts)}" fill="none" stroke="var(--cost)" stroke-width="2" stroke-dasharray="4 3"/>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

async function tick(): Promise<void> {
  try {
    const [stats, jobs] = await Promise.all([
      fetch(`${API}/stats`).then((r) => r.json() as Promise<StatsRes>),
      fetch(`${API}/jobs`).then((r) => r.json() as Promise<JobRes[]>),
    ]);
    renderStats(stats);
    renderJobs(jobs);
    renderChart(jobs);
  } catch {
    badgeEl().textContent = "offline";
    badgeEl().className = "badge paused";
  }
}

void tick();
setInterval(tick, 3000);
