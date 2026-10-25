"use client";

import { useEffect, useState } from "react";
import { api, type Stats } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";

/**
 * Landing page in the ETHGlobal / x402 design language: near-black page,
 * display headline, manifesto voice, numbered flow, old-vs-new comparison,
 * feature grid — with the live numbers pulled from the agent when it's up.
 */

export default function Landing() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [down, setDown] = useState(false);

  useEffect(() => {
    let alive = true;
    const tick = () =>
      api
        .stats()
        .then((s) => {
          if (alive) {
            setStats(s);
            setDown(false);
          }
        })
        .catch(() => alive && setDown(true));
    void tick();
    const id = setInterval(tick, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#0a0a0b] text-[#f0efec]">
      {/* nav */}
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-lg font-semibold tracking-tight">kamai</span>
        <div className="flex items-center gap-5 text-sm text-[#c3c2b7]">
          <a href="#how" className="transition-colors hover:text-white">
            how it works
          </a>
          <a href="#policy" className="transition-colors hover:text-white">
            policy
          </a>
          <a
            href="/dashboard"
            className="rounded-full bg-gradient-to-r from-[#2a78d6] to-[#6250d6] px-4 py-1.5 font-medium text-white transition-opacity hover:opacity-85"
          >
            Live P&L →
          </a>
        </div>
      </nav>

      {/* hero */}
      <section className="relative mx-auto max-w-5xl px-6 pb-20 pt-16 sm:pt-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-25"
          style={{
            background:
              "radial-gradient(600px 300px at 30% 0%, rgba(42,120,214,0.55), transparent 70%), radial-gradient(500px 260px at 75% 10%, rgba(98,80,214,0.5), transparent 70%)",
          }}
        />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs text-[#c3c2b7]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#0ca30c]" aria-hidden />
            live at ETHGlobal Mumbai
          </span>
          <h1 className="mt-6 max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            The agent that
            <br />
            pays its own bills.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#c3c2b7]">
            Every agent here runs on somebody's API key and credit card. Kamai
            runs on its own income. It sells work to other agents over x402,
            gets paid per request in USDC, and thinks only as long as its
            earnings can pay for the compute.
          </p>
          <p className="mt-4 text-lg font-medium text-white">
            If it doesn't earn, it doesn't think.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href="/dashboard"
              className="rounded-full bg-gradient-to-r from-[#2a78d6] to-[#6250d6] px-6 py-3 font-medium text-white transition-opacity hover:opacity-85"
            >
              Watch it earn live
            </a>
            <a
              href="#how"
              className="rounded-full border border-white/15 px-6 py-3 font-medium text-[#f0efec] transition-colors hover:border-white/40"
            >
              How it works
            </a>
          </div>

          {/* live stats strip */}
          <div className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-4">
            <Stat value={stats ? `$${stats.revenueUsd.toFixed(3)}` : down ? "—" : "…"} label="USDC earned" />
            <Stat value={stats ? `$${stats.computeCostUsd.toFixed(3)}` : down ? "—" : "…"} label="compute paid (0G)" />
            <Stat value={stats ? `$${stats.marginUsd.toFixed(3)}` : down ? "—" : "…"} label="profit kept" />
            <Stat
              value={
                stats ? (
                  <span className="inline-flex items-center gap-2">
                    <StatusDot status={stats.status} />
                    {stats.status}
                  </span>
                ) : (
                  down ? "—" : "…"
                )
              }
              label="right now"
            />
          </div>
          {down ? (
            <p className="mt-2 text-xs text-[#898781]">
              agent offline — numbers go live when kamai is running on :3000
            </p>
          ) : null}
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="mx-auto max-w-5xl px-6 py-20">
        <Eyebrow>One job, start to finish</Eyebrow>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Another agent asks a question. Kamai names its price. Nobody clicks anything.
        </h2>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          <Step n="01" title="Found by name, not URL">
            A customer agent resolves{" "}
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-[13px]">kamai.you.eth</code>{" "}
            on ENSv2 and reads the service endpoint and the price floor straight
            from the name. Nothing is hard-coded.
          </Step>
          <Step n="02" title="Pays per request in USDC">
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-[13px]">GET /explain?tx=…</code>{" "}
            answers <span className="text-[#3987e5]">402</span> with the price.
            The buyer signs a USDC transfer over x402 on Hedera — settled
            on-chain before the answer ships.
          </Step>
          <Step n="03" title="The work is real inference">
            Kamai pulls the transaction from the Hedera Mirror Node and puts a
            model on 0G Compute to work on it, returning structured JSON with a
            chat ID as the receipt.
          </Step>
        </div>
      </section>

      {/* old way vs kamai */}
      <section className="border-y border-white/10 bg-[#0d0d0f] py-20">
        <div className="mx-auto grid max-w-5xl gap-12 px-6 md:grid-cols-2">
          <div>
            <Eyebrow>The old way</Eyebrow>
            <ul className="mt-6 space-y-4 text-[#898781]">
              {[
                "runs on the founder's API key and card",
                "a human approves the spend",
                "pays for a subscription whether it works or not",
                "no idea what a request costs it",
                "spends until someone cuts it off",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span aria-hidden className="text-[#d03b3b]">
                    —
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <Eyebrow>The kamai way</Eyebrow>
            <ul className="mt-6 space-y-4">
              {[
                "earns USDC first, then spends it on compute",
                "prices every job from what the job costs",
                "refuses work that would lose money — before taking payment",
                "a daily compute cap the agent cannot change",
                "every rupee in and out on a tamper-evident HCS log",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span aria-hidden className="text-[#0ca30c]">
                    ✓
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* policy / ENS */}
      <section id="policy" className="mx-auto max-w-5xl px-6 py-20">
        <Eyebrow>On ENSv2</Eyebrow>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          The limits live in the name — and the agent can't touch them.
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#131316] p-6">
            <h3 className="font-medium text-white">Owner writes the policy</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#c3c2b7]">
              Price floor, daily compute cap, minimum margin — published as
              text records on{" "}
              <code className="rounded bg-white/10 px-1.5 py-0.5 text-[13px]">kamai.you.eth</code>.
              Kamai reads them at startup and every five minutes. ENS is the
              source of truth.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#131316] p-6">
            <h3 className="font-medium text-white">The agent writes only its status</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#c3c2b7]">
              Its delegated key can update{" "}
              <code className="rounded bg-white/10 px-1.5 py-0.5 text-[13px]">kamai.status</code>{" "}
              and{" "}
              <code className="rounded bg-white/10 px-1.5 py-0.5 text-[13px]">kamai.stats</code>{" "}
              — and nothing else. Ask it to raise its own cap and the resolver
              reverts with{" "}
              <code className="rounded bg-white/10 px-1.5 py-0.5 text-[13px]">EACUnauthorizedAccountRoles</code>.
            </p>
          </div>
        </div>
      </section>

      {/* closing CTA */}
      <section className="border-t border-white/10 bg-[#0d0d0f] py-16">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-6 px-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Watch it run its own business.</h2>
            <p className="mt-1 text-sm text-[#898781]">
              Live P&L, job feed, and the ENS policy — updated every few seconds.
            </p>
          </div>
          <a
            href="/dashboard"
            className="rounded-full bg-gradient-to-r from-[#2a78d6] to-[#6250d6] px-6 py-3 font-medium text-white transition-opacity hover:opacity-85"
          >
            Open the dashboard →
          </a>
        </div>
        <p className="mx-auto mt-12 max-w-5xl px-6 text-xs text-[#898781]">
          Built at ETHGlobal Mumbai · x402 on Hedera · inference on 0G Compute ·
          identity and policy on ENSv2 · spec in docs/SPEC.md · AI-assisted,
          attributed in the README
        </p>
      </section>
    </main>
  );
}

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="bg-[#0a0a0b] px-5 py-4">
      <div className="text-xl font-semibold text-white">{value}</div>
      <div className="mt-0.5 text-xs text-[#898781]">{label}</div>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#3987e5]">{children}</p>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm font-medium text-[#3987e5] tabular">{n}</div>
      <h3 className="mt-2 text-lg font-medium text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[#c3c2b7]">{children}</p>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "working" ? "#0ca30c" : status === "hungry" ? "#fab219" : "#d03b3b";
  return <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} aria-hidden />;
}
