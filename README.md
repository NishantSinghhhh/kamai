# kamai — the agent that pays its own bills

Every AI agent today runs on somebody's API key and credit card. Kamai runs on its own income. It sells **"explain this Hedera transaction"** to other agents over **x402** and gets paid per request in USDC. It does the work with inference on **0G Compute**, prices every job from what the job costs it, and refuses work that would lose money. Its identity and spending policy live in an **ENSv2** name where only the owner can set the limits — the agent can't change them. Every rupee in and out goes to a tamper-evident log on **Hedera Consensus Service**.

> "If it doesn't earn, it doesn't think."

## Setup

```bash
npm install
cp .env.example .env   # fill in keys (see .env.example comments)

npm run gen-keys       # EVM keys for ENS owner + agent roles
npm run setup-hedera   # associate USDC, print balances
npm run create-topic   # HCS audit topic → HCS_TOPIC_ID
npm run setup-0g       # fund check + provider acknowledge
npm run ens-publish    # owner records → ENSV2_RESOLVER_ADDRESS + url/policy
npm run ens-delegate   # grant the agent key status/stats writes only

npm run kamai          # the agent on :3000
npm run customers -- --bots 3 --interval 8 --budget 1
npm run dashboard      # P&L on :5173
```

## Architecture

See [`docs/SPEC.md`](docs/SPEC.md) §5 for the full description (architecture diagram to follow).

```
customer bots ──resolve kamai.you.eth──▶ GET /explain ──402──▶ signed USDC transfer (x402, Hedera)
                                              │
kamai: budget gate → x402 paywall → Mirror Node → 0G inference → JSON answer
                                              │
              ledger (P&L, allowance, daily cap) ──▶ HCS audit topic
```

## The honest trade-off: USDC in, OG out

Kamai earns USDC on Hedera and pays OG on 0G — different chains, no testnet exchange. The ledger keeps everything in USD terms: revenue is real USDC settled on Hedera, cost is real OG spent on 0G converted at `OG_USD_RATE` (stated, not hidden). The compute allowance is `revenue − cost + starting float`; before taking a job kamai checks it can afford the inference. A real USDC→OG swap is future work, stated as such — not faked.

## How ENSv2 limits the agent

- Policy (`price floor`, `maxDailyComputeUsd`, `minMarginBps`) is published by the **owner** on the resolver and enforced in kamai's own code. ENS is the source of truth; only the owner's key can change it.
- The agent's key is authorized via EAC for exactly two record keys: `kamai.status` and `kamai.stats`. Attempting to write its own cap reverts with `EACUnauthorizedAccountRoles` (`npx tsx scripts/ens-demo-fail.ts`).
- Customers resolve `kamai.you.eth` → service url; nothing is hard-coded.

## AI-tool attribution

This project was built with AI assistance (Claude Code). Prompts and the spec are in `docs/SPEC.md` and the commit history.
