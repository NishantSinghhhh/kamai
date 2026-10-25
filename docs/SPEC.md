# Kamai: Build Plan

**The agent that pays its own bills.**

ETHGlobal Mumbai, solo build. This is the spec to follow at the event. Write the project code from kickoff onward: the main track is "From Scratch", and code that exists before the event loses partner-prize and Finalist eligibility. Copying code from the Sangam practice build counts as pre-existing work, so write it fresh using this plan and what you learned.

> Commit this file on day 1 as `docs/SPEC.md`. ETHGlobal allows AI tools if you attribute them and include spec files and prompts.

---

## 1. The idea in one paragraph

Every AI agent today runs on somebody's API key and credit card. Kamai runs on its own income. It sells a useful service to other agents over **x402 on Hedera** and gets paid per request in USDC. It does the work with inference on **0G Compute**, and it keeps a profit-and-loss ledger: it prices each job from what the job costs it, refuses work that would lose money, and only spends the compute its earnings cover. Its identity and spending policy live in an **ENSv2** name: you (the owner) set the policy, and the agent can update its own status but can't change its own limits. Every rupee in and out goes to a tamper-evident log on **Hedera Consensus Service (HCS)**.

**Pitch line:** "Every agent here runs on someone's API key. Kamai runs on its own income. If it doesn't earn, it doesn't think."

---

## 2. What Kamai sells

The product has to be something agents would actually pay for, use 0G inference for every job (so the cost is real), and not look like a chat wrapper (0G rejects those).

**Service: "Explain this transaction."** Another agent sends a Hedera transaction ID. Kamai fetches it from the Mirror Node, asks the 0G model to explain it, and returns structured JSON:

```json
{
  "txId": "0.0.123@1700000000.123",
  "summary": "0.0.123 paid 0.52 USDC to 0.0.456",
  "kind": "token_transfer",
  "parties": [{ "account": "0.0.123", "role": "payer" }, { "account": "0.0.456", "role": "payee" }],
  "risk": "low",
  "riskReason": "Single transfer between two existing accounts"
}
```

Why this one:
- **Agents need it.** Payment agents (like Sangam's) need to audit what they paid for.
- **Every job costs real 0G inference**, so the P&L is real.
- **It's demoable in seconds**, and it fits Hedera: the agent explains Hedera to other agents.

Price: dynamic, about $0.03–0.10 per job (see §5.2).

---

## 3. Design decisions (read before building)

### 3.1 Earn in USDC, spend in OG: the budget rule

Kamai earns USDC on Hedera and pays 0G in OG on a different chain. There's no testnet exchange between them, so the money can't literally move from one to the other inside a hackathon.

**What Kamai does instead (and says so in the README):**
- It keeps a ledger in USD terms. Revenue is real USDC settled on Hedera. Cost is real OG spent on 0G, converted at `OG_USD_RATE`.
- **Compute allowance** = total revenue − total compute cost, plus a small starting float you give it.
- Before taking a job, Kamai checks: *after I'm paid for this job, can I afford the inference?* If not, it refuses before taking payment.
- Its price is set from its cost, so in normal operation every job is profitable and the allowance grows.

The real swap (USDC → OG through a bridge or DEX) goes in "What's next". Judges respect a stated trade-off. Faking a swap would be worse.

### 3.2 ENSv2: identity and a policy the agent can't change

ENSv2's Enhanced Access Control (EAC) gives roles **per record key** on the resolver. Kamai uses that:

| Record key | Who can write it | What it holds |
|---|---|---|
| `url` | owner (you) | the service endpoint |
| `kamai.price.floor` | owner | minimum price per job (USD) |
| `kamai.policy.maxDailyComputeUsd` | owner | daily compute spending cap |
| `kamai.policy.minMarginBps` | owner | minimum profit margin |
| `kamai.status` | **agent key** (delegated) | `working`, `hungry`, `paused` |
| `kamai.stats` | **agent key** (delegated) | JSON: jobs, revenue, cost, margin |

- Kamai reads its policy from ENS at startup and every few minutes. ENS is the source of truth for its limits.
- The agent's key is authorized only for `kamai.status` and `kamai.stats` (via the resolver's `authorize*Roles` functions). In the demo, show the agent **trying to raise its own spending cap and failing** with `EACUnauthorizedAccountRoles`. That's the ENS moment.
- Customers find Kamai by name (`kamai.<you>.eth`) with no hard-coded URL. The ENS prize explicitly rejects hard-coded values.

Spending limits are **enforced in Kamai's own code**. ENS publishes them and makes sure only you can change them. Say exactly that in the README.

### 3.3 Why there's no Uniswap step

The earlier pitch had Kamai moving profit into Uniswap. Uniswap isn't on Hedera, and Kamai's money is on Hedera, so this would mean a bridge and a second chain. That's too much for a solo build and earns nothing for the three main prizes. **Drop it.** If you finish early, a better extra is an 0G Storage log (see §11).

---

## 4. Prize targets and the proof each one needs

Pick these three on the final submission step.

### Hedera: AI Agents That Pay: x402 ($6.5K: 3K / 2K / 1.5K)
- [ ] x402-protected endpoint (`GET /explain`) settling on `hedera:testnet` through a documented facilitator
- [ ] A customer agent completes a paid request **end to end with no human approval**
- [ ] README: setup, architecture, payment flow, **one settled tx ID** (HashScan link)
- [ ] Demo video ≤5 min showing a payment settle, linked on HashScan
- Bonus points this design covers: **agent spending controls** (Kamai's budget rule and the buyer's caps), **HCS topic as a tamper-evident spending audit log** (every revenue and cost event), and multiple agents paying autonomously

### 0G: Build with iAI ($5K: 2.5K / 1.5K / 1K)
Their wording describes Kamai exactly: "agents holding staked iAI, paying for their own inference, and earning on top."
- [ ] Credits visibly spent by the agent (compute balance in the dashboard, going down per job)
- [ ] Inference on 0G Compute, **a request/chat ID per job** in the log
- [ ] README answers "why come back tomorrow": the agent has to keep earning to keep thinking, and 0G's daily credits expire
- [ ] Not a chat wrapper: structured output, the model is a worker inside a business loop
- [ ] Submit: repo, demo video **under 3 min**, live demo link, contract/account addresses, team contact
- ⚠️ **Ask at the 0G booth in the first hour** whether broker-funded 0G Compute qualifies, or only staked-iAI credits (each staked iAI gets ~1.271 credits/day, expiring daily). If only iAI counts, get iAI and use the credits. **Fallback:** 0G Wildcard ($2K), which also needs a 0G Storage root hash and a 0G Chain contract address (see §11).
- ⚠️ 0G's Privy app ID only allows localhost on ports **3000, 3001, 5173**. Use those ports.

### ENS: Best Use of ENSv2 ($7K: 3K / 2K / 1K × 2)
"Bonus for AI agents as namespaces with their own identity and permissions" describes Kamai exactly.
- [ ] Kamai is `kamai.<you>.eth` on **ENSv2 Sepolia**
- [ ] Customers find Kamai **only** through ENS, with no hard-coded URL or account
- [ ] EAC per-record roles: the agent can write `kamai.status` / `kamai.stats`, but not its policy
- [ ] Live demo link, open-source repo

---

## 5. How it works

### 5.1 Architecture

```
customer agents (2–3 bots)
   │  resolve kamai.you.eth → url, price floor
   │  GET /explain?tx=…  →  402  →  signed USDC transfer (x402, Hedera)
   ▼
┌──────────────────────── kamai (one Node service, :3000) ────────────────────────┐
│ budget gate → x402 paywall → job runner → ledger                                │
│                                                                                 │
│ budget gate   reads policy from ENS; refuses (503) if the job can't be afforded │
│ x402 paywall  price = estimated cost × (1 + margin), never below the floor      │
│ job runner    Mirror Node fetch → 0G Compute inference → JSON answer            │
│ ledger        revenue (USDC) and cost (OG→USD) per job; allowance; daily cap    │
│ status writer every N jobs: ENS kamai.status / kamai.stats (agent key)          │
│ audit log     every revenue/cost event → HCS topic                              │
└─────────────────────────────────────────────────────────────────────────────────┘
   │
   ▼
dashboard (:5173): live P&L, status, job feed, proof links
```

### 5.2 One job, step by step

1. **Quote.** A customer calls `GET /explain?tx=…`. The budget gate estimates cost (recent average OG per job × `OG_USD_RATE`) and sets the price: `max(floor, cost × (1 + minMargin))`.
2. **Gate.** If today's compute spend plus this job would pass `maxDailyComputeUsd`, or the allowance after payment can't cover the cost, return **503** with a reason (`"hungry: daily compute cap reached"`). No payment is taken.
3. **Paywall.** Otherwise the x402 middleware returns **402** with that price. The customer pays and retries.
4. **Work.** After the payment settles, fetch the tx from the Mirror Node, run inference on 0G, and validate the JSON.
5. **Book it.** Revenue = settled USDC. Cost = OG spent on this job (from the provider's price × token usage, or the ledger balance before/after) × `OG_USD_RATE`. Write both to the ledger and the HCS topic.
6. **Respond** with the explanation plus `kamai` metadata: `{ jobId, ogChatId, priceUsd, costUsd }`.
7. **Report.** Every N jobs (or every minute), write `kamai.status` and `kamai.stats` to ENS.

If inference fails after payment, mark the job `refund_owed` in the ledger and show it on the dashboard. Automatic refunds are in "What's next".

### 5.3 Statuses

| Status | When | What customers see |
|---|---|---|
| `working` | allowance healthy, under the daily cap | normal 402 → paid → answer |
| `hungry` | allowance low or daily cap reached | 503 with the reason; ENS status updated |
| `paused` | owner set `kamai.status` or the policy to stop | 503 "paused by owner" |

---

## 6. Stack

| Layer | Choice |
|---|---|
| Language | TypeScript everywhere, Node 22, npm workspaces |
| Server | Express |
| x402 server | `@x402/express`, `@x402/core`, `@x402/hedera` (`ExactHederaScheme` from `@x402/hedera/exact/server`). Dynamic price function and `onAfterSettle` hook. |
| x402 client | `@x402/fetch`, `@x402/core/client`, `@x402/hedera` (`createClientHederaSigner`, `ExactHederaScheme` from `/exact/client`), `spendControls` |
| Facilitator | Blocky402 testnet `https://api.testnet.blocky402.com`. Backups: `https://x402.org/facilitator`, `https://testnet.facilitator.ax402.io` |
| Hedera | `@hiero-ledger/sdk` (HCS, token association), Mirror Node REST |
| Testnet USDC | `0.0.429274`, 6 decimals (`HEDERA_TESTNET_USDC` in `@x402/hedera`) |
| 0G Compute | `@0gfoundation/0g-compute-ts-sdk` (the old `@0glabs/0g-serving-broker` is deprecated), `ethers@6`, `openai@4` |
| 0G testnet | RPC `https://evmrpc-testnet.0g.ai`, chain 16602. Ledger minimum 0.1 OG, 0.01 OG per provider transfer. |
| ENS | `viem` on Sepolia (ENSv2 is live there): `getEnsText` to read, resolver `setText` to write, `authorize*Roles` for EAC |
| Storage | One JSON file for the ledger. No database. |
| Dashboard | Vite + vanilla TS, one page |

These were checked against the real packages during the Sangam practice build.

---

## 7. Repo layout

```
kamai/
├── package.json                 # npm workspaces
├── .env.example
├── README.md
├── docs/
│   ├── SPEC.md                  # this file
│   └── architecture.png
├── packages/shared/src/
│   ├── types.ts                 # Job, LedgerEntry, Policy, Status
│   ├── config.ts                # env loading
│   ├── ens.ts                   # read policy/records, write status/stats
│   └── hedera.ts                # tx-id formats, HashScan links
├── apps/
│   ├── kamai/                   # the agent                 :3000
│   │   └── src/
│   │       ├── server.ts        # Express: gate → paywall → /explain
│   │       ├── pricing.ts       # cost estimate → price
│   │       ├── gate.ts          # allowance + daily cap + status
│   │       ├── work.ts          # Mirror Node fetch + 0G inference
│   │       ├── ledger.ts        # JSON store, P&L, allowance
│   │       ├── audit.ts         # HCS writer
│   │       └── reporter.ts      # ENS status/stats writer
│   ├── customers/               # 2–3 buyer bots (CLI, loop mode)
│   │   └── src/buyer.ts
│   └── dashboard/               # P&L page                  :5173
└── scripts/
    ├── gen-keys.ts
    ├── setup-hedera.ts          # associate USDC, balances
    ├── create-topic.ts          # HCS audit topic
    ├── setup-0g.ts              # list providers, fund
    ├── ens-publish.ts           # write owner records
    └── ens-delegate.ts          # grant the agent key roles on status/stats only
```

---

## 8. Interfaces

### 8.1 Types

```ts
type Policy = {
  priceFloorUsd: number;          // kamai.price.floor
  maxDailyComputeUsd: number;     // kamai.policy.maxDailyComputeUsd
  minMarginBps: number;           // kamai.policy.minMarginBps
};

type Job = {
  id: string;
  customer: string | null;        // payer account from the settle response
  txId: string;                   // the transaction being explained
  priceUsd: number;
  revenueAtomic: string;          // USDC settled, 6 decimals
  hederaPaymentTxId: string;
  ogChatId: string | null;
  ogSpent: string | null;         // OG, as a decimal string
  costUsd: number | null;
  status: "paid" | "done" | "refund_owed";
  hcsSequence: number | null;
  createdAt: string;
};

type Stats = {
  jobs: number;
  revenueUsd: number;
  computeCostUsd: number;
  marginUsd: number;
  allowanceUsd: number;
  todayComputeUsd: number;
  status: "working" | "hungry" | "paused";
};
```

### 8.2 Routes (`apps/kamai`, :3000)

| Route | Paid | Does |
|---|---|---|
| `GET /explain?tx=<id>` | x402 | The service (§5.2) |
| `GET /quote` | no | Current price, status, policy. Lets agents decide before paying. |
| `GET /stats` | no | `Stats` + 0G balance + HCS topic ID (the dashboard reads this) |
| `GET /jobs` | no | Recent jobs, newest first |
| `GET /health` | no | `{ ok: true }` |

Middleware order matters: **gate first, then paywall**, so a hungry Kamai never takes money.

### 8.3 Customer bots

```
npm run customers -- --bots 3 --interval 8 --budget 1
```
Each bot resolves `kamai.<you>.eth`, picks a recent real Hedera transaction (from the Mirror Node), checks `/quote`, pays through x402, prints the explanation and the HashScan link, and stops at its own budget. Three bots with different budgets make the dashboard look like a market, with no human clicking.

### 8.4 Dashboard

- **Header:** Kamai + tagline + status badge (`working` / `hungry` / `paused`)
- **P&L cards:** revenue, compute cost, profit, allowance, today's compute vs the cap
- **Live chart:** revenue line vs cost line over time. The gap between them is the story.
- **Job feed:** customer, tx explained, price, cost, margin, proof links (payment on HashScan, 0G chat ID, HCS sequence)
- **Policy panel:** the ENS records, marked "set by owner" and "set by agent"

---

## 9. Environment variables

```
# Hedera
HEDERA_USDC_TOKEN_ID=0.0.429274
FACILITATOR_URL=https://api.testnet.blocky402.com
MIRROR_NODE_URL=https://testnet.mirrornode.hedera.com
KAMAI_ACCOUNT_ID=            # Kamai's treasury: receives USDC
KAMAI_PRIVATE_KEY=           # used for HCS writes and USDC association
CUSTOMER_1_ACCOUNT_ID=       # buyer bots (1–3 accounts)
CUSTOMER_1_PRIVATE_KEY=
HCS_TOPIC_ID=                # from create-topic

# 0G
OG_RPC_URL=https://evmrpc-testnet.0g.ai
OG_PRIVATE_KEY=
OG_PROVIDER_ADDRESS=         # from setup-0g
OG_USD_RATE=0.10             # used to convert OG cost to USD; state it in the README

# ENS (Sepolia, ENSv2)
SEPOLIA_RPC_URL=
KAMAI_ENS_NAME=kamai.you.eth
ENS_OWNER_PRIVATE_KEY=       # you: sets url and policy
ENS_AGENT_PRIVATE_KEY=       # the agent: may only write kamai.status / kamai.stats

# Ledger
STARTING_FLOAT_USD=0.25      # the agent's first "meal" before it has earned anything

# Ports (0G Privy allows 3000/3001/5173)
KAMAI_PORT=3000
```

Use three throwaway keys at most: Kamai (Hedera), one EVM key for 0G and the ENS owner, and one EVM key for the ENS agent role. The agent's ENS key **must differ** from the owner's, or the permission demo proves nothing.

---

## 10. Before kickoff (setup only, no code)

- [ ] **Hedera:** 2–4 testnet ECDSA accounts at portal.hedera.com (Kamai + 1–3 customers). Associate USDC `0.0.429274` on all of them, and fund the customers from faucet.circle.com (Hedera Testnet). Association needs a small script or wallet, so do it at H+0 if you can't do it without code.
- [ ] **0G:** ~2 OG from faucet.0g.ai on your EVM address. Find 0G's Discord in case the faucet gives too little.
- [ ] **Sepolia ETH:** ~0.05 on the owner address and a little on the agent address (it pays gas for status writes).
- [ ] **ENS:** read docs.ens.domains `/ensv2/overview`, `/ensv2/enhanced-access-control` and `/ensv2/permissioned-resolver`. Know which `authorize*Roles` function and role bits you'll call before kickoff.
- [ ] **Read once:** Hedera's x402 merchant guide, the x402 buyer quickstart, the 0G compute TS starter kit README.
- [ ] Node 22 installed. Practice the Sangam build once end to end with real keys, since most of the plumbing is the same.

---

## 11. Timeline (hours from kickoff)

Commit at least hourly with real messages.

| Hours | Goal | Done when |
|---|---|---|
| H+0–1 | Booths: 0G (the iAI-credit question), Hedera (facilitator + USDC), ENS (EAC per-record roles help). Scaffold the repo, commit SPEC.md. | Questions answered, repo pushed |
| H+1–4 | **x402:** `/explain` (stub answer) behind a paywall; one customer pays it | 1 settled tx on HashScan |
| H+4–7 | **0G:** real explanations from the Mirror Node + inference, JSON validated, chat ID logged | A real explanation for a real tx |
| H+7–10 | **Ledger + pricing + gate:** revenue/cost per job, dynamic price, 503 when hungry | Cost and margin per job printed |
| H+10–13 | **ENS:** publish owner records, read the policy, delegate the agent key, write status/stats | Agent's status write succeeds; its policy write fails |
| H+13–15 | **HCS audit log** | Every job has an HCS sequence number |
| H+15–19 | **Sleep.** | |
| H+19–23 | Dashboard with the live P&L chart | Video backdrop looks right |
| H+23–25 | Customer bots in loop mode (2–3 bots) | 20 jobs in a row with no crash |
| H+25–28 | Deploy; ENS `url` points to the public service | Live demo link works from your phone |
| H+28–30 | Hardening: `refund_owed` path, hungry path, ENS read failures | Each failure shows on the dashboard |
| H+30–33 | README + architecture diagram + video | Video under 3 min, own voice, 720p+ |
| H+33–35 | Submit; pick 3 partner prizes | Submitted with ~1h spare |

**Stretch, only if ahead:** write each day's ledger snapshot to **0G Storage** and show the root hash. That's also what the 0G Wildcard fallback needs.

**Cut order if behind** (cut from the top): live chart (keep the cards) → customer bot loop (one manual run) → ENS stats writing (keep status) → dynamic pricing (fixed price, keep the gate) → HCS log.
**Never cut:** a settled x402 payment, a 0G chat ID per job, ENS lookup, and the agent's failed policy write.

---

## 12. Demo script (under 3 min, own voice, screen capture)

1. **0:00** "Every agent here runs on someone's API key. This one runs on its own income."
2. **0:15** Dashboard: Kamai is `working`, revenue $0, allowance = its $0.25 starting float.
3. **0:25** Start three customer bots. Payments arrive: each row shows price, cost, margin. The revenue line pulls above the cost line.
4. **1:00** Click a payment → HashScan USDC transfer. Click a job → its 0G chat ID. Click → HCS audit message.
5. **1:25** "Kamai prices its own work." Raise `OG_USD_RATE` (compute just got pricier). The quote goes up by itself.
6. **1:45** Hit the daily cap: Kamai goes `hungry`, returns 503, takes no money, and its ENS status changes on Sepolia.
7. **2:10** "Can it raise its own limit?" The agent tries to write `kamai.policy.maxDailyComputeUsd` → **EACUnauthorizedAccountRoles**. Only the owner can.
8. **2:35** "Kamai earned more than it spent, never took money it couldn't serve, and can't overspend its owner's limit. Next: swapping its USDC for compute on its own."

---

## 13. Risks

| Risk | Plan |
|---|---|
| 0G iAI prize needs staked iAI, not broker credits | Ask in hour 1. Get iAI, or switch to Wildcard (add 0G Storage + a 0G Chain contract) |
| Measuring per-job OG cost is fiddly | Start with ledger balance before/after each job; refine with provider pricing × token usage if time |
| ENSv2 EAC role calls are new and thinly documented | Ask the ENS booth early (H+0). Fallback: the agent writes status to a separate subname it owns, and the policy lives on your name. That keeps the "can't change its own limits" story. |
| Facilitator down or slow | Switch `FACILITATOR_URL` to a backup |
| The model returns bad JSON | Validate with a schema; retry once; then return a minimal explanation built from the Mirror Node data and mark it in the ledger |
| Testnet USDC runs out | Price jobs at $0.03–0.05 and recycle USDC from Kamai back to the customers |

---

## 14. Submission checklist

- [ ] Public repo, MIT license, steady commit history from kickoff
- [ ] README: problem, architecture diagram, setup, `.env.example`, one HashScan tx ID, HCS topic ID, ENS name, 0G provider + sample chat ID, **the USDC→OG accounting trade-off stated plainly**, how EAC limits the agent, AI-tool attribution, link to `docs/SPEC.md`
- [ ] Video under 3 min (0G's limit), 720p+, own voice, not sped up, not filmed on a phone
- [ ] Live demo link
- [ ] Partner prizes: Hedera x402, 0G (iAI or Wildcard), ENS ENSv2
- [ ] Submitted before the deadline

---

## 15. Kamai or Sangam?

You can only enter one project. Both target the same three sponsors.

| | Kamai | Sangam |
|---|---|---|
| Story | An agent that runs its own business | Agents pay Indian merchants, who get rupees |
| Strongest prize fit | 0G iAI (their wording describes it) and ENS (agents with permissions) | Hedera x402 (payments) |
| Real-world hook | Agent economy | UPI and India; very relatable for Mumbai judges |
| Weak spot | USDC→OG is accounting, not a real swap | UPI payout is sandbox only |
| Practice you already have | Most plumbing is the same as Sangam | A working practice build |

**Pick Kamai** for the stronger technical story and the closer fit to the 0G and ENS prize wording. **Pick Sangam** for the more emotional demo and a lower-risk build you've already rehearsed.
