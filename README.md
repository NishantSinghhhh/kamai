# Kamai

**The agent that pays its own bills.**

Kamai is an AI agent that runs its own business. It sells a service — explaining Hedera transactions — to other agents, and gets paid per request in USDC over x402 on Hedera. It does the work with inference on 0G Compute, prices every job from what the job costs it, and refuses work it can't afford. Its identity and spending policy live in an ENSv2 name: the owner sets the limits, and the agent can report its status but can't change its own policy. Every payment in and out goes to a Hedera Consensus Service (HCS) topic.

This guide takes you from a fresh machine to a live, paying agent. Do the parts in order.

- [How it works](#how-it-works)
- [Part 1: Install](#part-1-install) (macOS, Linux, Windows)
- [Part 2: Run it with mocks (no keys)](#part-2-run-it-with-mocks-no-keys)
- [Part 3: Create accounts and keys](#part-3-create-accounts-and-keys)
- [Part 4: Turn on the real services](#part-4-turn-on-the-real-services)
- [Part 5: Run kamai live](#part-5-run-kamai-live)
- [Part 6: Deploy](#part-6-deploy)
- [Running on Windows](#running-on-windows)
- [Reference](#reference): commands, env variables, layout
- [Troubleshooting](#troubleshooting)
- [What's verified](#whats-verified)

---

## How it works

The customer is an AI agent, not a person, so there's no checkout page. Kamai's server answers with **HTTP 402 Payment Required**, a machine-readable invoice. The customer reads it, signs a USDC transfer, and retries.

```
1  customer-bot resolves kamai.you.eth on ENSv2 → service URL + price floor
2  customer-bot: GET /quote          → kamai's current price (cost × margin, floored)
3  customer-bot: GET /explain?tx=…   → 402 with the price → signs a USDC transfer
4  x402 facilitator settles the transfer on Hedera (testnet USDC)
5  kamai: fetch the tx from the Mirror Node → 0G Compute explains it
         write revenue + cost to the ledger and the HCS topic
6  dashboard shows the live P&L; every few jobs kamai updates kamai.status/stats on ENS
```

| Service | Port | What it does |
|---|---|---|
| `kamai` | 3000 | The agent: budget gate → x402 paywall → Mirror Node + 0G inference → ledger + HCS |
| `dashboard` | 3001 | Landing page (`/`) and live P&L (`/dashboard`) |
| `customers` | (CLI) | 1–3 buyer bots; no human approval anywhere in the loop |
| `mock` | 3000 | Fake `/stats` + `/jobs` for frontend work without keys |

**The money flow in one sentence:** kamai earns USDC on Hedera and spends OG on 0G — different chains with no testnet exchange, so the ledger is kept in USD terms (OG cost × `OG_USD_RATE`), and before taking a job kamai checks its allowance can cover the inference. A real USDC→OG swap is future work, stated as such — not faked.

---

## Part 1: Install

**You need:** Node.js 22 and npm, on macOS, Linux or Windows.

**1. Install Node 22**

| OS | How |
|---|---|
| macOS | `brew install node@22`, then `export PATH="/opt/homebrew/opt/node@22/bin:$PATH"` (add that line to `~/.zshrc` to keep it) |
| Linux | your package manager, or https://nodejs.org |
| Windows | `winget install OpenJS.NodeJS.LTS`, or the installer from https://nodejs.org. Open a **new** terminal afterwards. |

**2. Install the project**

```bash
node -v             # should print v22.x
cd kamai
npm install
npm run typecheck   # should print nothing and exit cleanly
```

**3. Create `.env`** (skip if the folder already has one)

```bash
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
npm run gen-keys            # prints two EVM key pairs
```

Keep the output for Part 3.

Every `npm run …` command in this guide works the same on all three OSes. On Windows, see [Running on Windows](#running-on-windows) for the few other commands that differ.

---

## Part 2: Run it with mocks (no keys)

Before any accounts exist, you can see the whole frontend against a fake agent. The mock serves `/stats`, `/jobs`, `/quote` and `/health` on :3000 with plausible demo data.

Open two terminals in `kamai/`:

```bash
# terminal 1: the mock agent
npm run mock

# terminal 2: the dashboard
npm run dashboard
```

Open **http://localhost:3001** — the landing page shows the manifesto, how-it-works, the ENS policy story, and a live stats strip. **http://localhost:3001/dashboard** shows the P&L: revenue vs cost chart, job feed with proof columns, and the policy panel.

Other things to try:

```bash
curl -s localhost:3000/health   # { ok: true }
curl -s localhost:3000/stats    # the numbers the dashboard reads
curl -s localhost:3000/quote    # kamai's current price and status
```

On Windows PowerShell, type `curl.exe` instead of `curl`. Or just open http://localhost:3000/quote in a browser.

The mock writes nothing on chain and touches no wallet — it's only for seeing the pages and iterating on the frontend.

---

## Part 3: Create accounts and keys

You need **2–4 Hedera accounts** and **2 EVM keys**. Use fresh testnet-only keys, never a wallet that holds real money.

### 3.1 Hedera testnet accounts (kamai's treasury + customers)

1. Go to **https://portal.hedera.com**, sign up, and choose **Testnet**.
2. Create an account with an **ECDSA** key. Copy its **account ID** (`0.0.xxxxx`) and its **private key**. Hex, `0x`-hex and DER formats all work.
3. Do it again for each customer bot (1–3 accounts).
4. Paste them into `.env`:

```bash
KAMAI_ACCOUNT_ID=0.0.xxxxx        # kamai's treasury: receives USDC, writes the HCS log
KAMAI_PRIVATE_KEY=...
CUSTOMER_1_ACCOUNT_ID=0.0.yyyyy   # buyer bot 1
CUSTOMER_1_PRIVATE_KEY=...
CUSTOMER_2_ACCOUNT_ID=0.0.zzzzz   # buyer bot 2 (optional)
CUSTOMER_2_PRIVATE_KEY=...
CUSTOMER_3_ACCOUNT_ID=0.0.wwwww   # buyer bot 3 (optional)
CUSTOMER_3_PRIVATE_KEY=...
```

New portal accounts come with testnet HBAR. Kamai needs about 10 HBAR (HCS writes + token association). The x402 transfer fee is paid by the facilitator, not the agents.

### 3.2 Two EVM keys (0G + ENS owner, and the ENS agent role)

The keys from Part 1, or run it again for new ones:

```bash
npm run gen-keys
```

Fill in three lines — note that the agent key **must differ** from the owner's, or the ENS permission demo proves nothing:

```bash
OG_PRIVATE_KEY=0x...              # first key: 0G wallet
ENS_OWNER_PRIVATE_KEY=0x...       # same first key: owns the ENS name, sets the policy
ENS_AGENT_PRIVATE_KEY=0x...       # second key: the agent; can only write status/stats
```

Keep the first key's address handy for the faucets.

### 3.3 Test tokens

| Token | Amount | Where | Send to |
|---|---|---|---|
| HBAR | ~10 per account | comes with portal accounts | — |
| USDC (Hedera testnet, `0.0.429274`) | 10 | https://faucet.circle.com, choose **Hedera Testnet** | the **customer** accounts. Do step 4.1 first: an account must be associated with USDC before it can receive it. |
| OG | ~2 | https://faucet.0g.ai | your EVM address (3.2, first key) |
| Sepolia ETH | ~0.05 | any Sepolia faucet, e.g. Google Cloud's Web3 faucet | both EVM addresses (owner writes records; the agent pays gas for status writes) |

Kamai's jobs are priced around $0.03–0.10, so 10 USDC across three bots is plenty for a demo. If a faucet gives too little OG, ask in 0G's Discord — their hackathon prize page says teams get free credits.

### 3.4 An ENSv2 name on Sepolia

1. Go to **https://sepolia.app.ens.domains** (ENSv2 is live on Sepolia) and register a name with the **owner** key's wallet, e.g. `yourname.eth`, then create the subname `kamai.yourname.eth` — or register a plain `kamai-<you>.eth`. ENSv2 registration on Sepolia is paid in MockUSDC, which anyone can mint; the ENS docs explain how.
2. Put the final name in `.env`:

```bash
KAMAI_ENS_NAME=kamai.yourname.eth
SEPOLIA_RPC_URL=...   # optional; blank uses a public Sepolia RPC
```

---

## Part 4: Turn on the real services

Each step replaces one dependency on setup defaults. After each one, run the check under it before moving on.

### 4.1 Hedera: associate USDC

```bash
npm run setup-hedera
```

This associates testnet USDC (`0.0.429274`) with kamai's treasury and every customer account, then prints every balance. Now get USDC from the Circle faucet for the **customers** (3.3) and run it again:

```bash
npm run setup-hedera
# associated 0.0.429274 on 0.0.xxxxx
# 0.0.xxxxx: 10.000000 USDC   ← the customers should be funded; kamai's treasury starts at 0
```

### 4.2 Hedera: create the audit topic

```bash
npm run create-topic
# HCS_TOPIC_ID=0.0.zzzzz
# https://hashscan.io/testnet/topic/0.0.zzzzz
```

Paste `HCS_TOPIC_ID` into `.env`. Every revenue and cost event kamai books also lands on this topic.

### 4.3 0G: fund inference

```bash
npm run setup-0g
```

It prints your chain balance, the ledger balance, and acknowledges the provider. Pick a provider from what it shows and set `OG_PROVIDER_ADDRESS` in `.env`. If the ledger is empty, the script tells you to visit the faucet first. The testnet minimums are 0.1 OG for the ledger and 0.01 OG per provider transfer.

### 4.4 ENS: publish the policy, delegate the agent key

```bash
# first run resolves the resolver and tells you what to put in .env
KAMAI_PUBLIC_URL=http://localhost:3000 npm run ens-publish
# → set ENSV2_RESOLVER_ADDRESS=0x... in .env, then again:
KAMAI_PUBLIC_URL=http://localhost:3000 npm run ens-publish
# → writes url + price floor + daily cap + min margin, one tx per record
npm run ens-delegate
# → authorizes the agent key on kamai.status and kamai.stats only
```

Optional overrides for the same command: `KAMAI_PRICE_FLOOR` (default 0.03), `KAMAI_MAX_DAILY_COMPUTE` (default 0.25), `KAMAI_MIN_MARGIN_BPS` (default 5000).

**Check:** the ENS moment — the agent tries to raise its own spending cap and is refused:

```bash
npx tsx scripts/ens-demo-fail.ts
# agent 0x… tries to write kamai.policy.maxDailyComputeUsd…
# ✔ rejected with EACUnauthorizedAccountRoles — the agent cannot change its own limits
```

If you haven't configured EAC roles yet, the write may succeed on a plain resolver — that means the delegation hasn't taken effect; re-run `ens-delegate` and re-check the record keys.

---

## Part 5: Run kamai live

With Part 4 done:

```bash
# terminal 1: the agent
npm run kamai

# terminal 2: the dashboard
npm run dashboard

# terminal 3: the buyers
npm run customers -- --bots 3 --interval 8 --budget 1
```

Each bot resolves the ENS name, checks `/quote`, pays, and prints something like:

```
[bot-1] … paying $0.047500 to explain 0.0.429274@17500001000.123…
[bot-1] ✔ 0.0.123 paid 0.52 USDC to 0.0.456
[bot-1]   risk=low kind=token_transfer paid=$0.0475 cost=$0.0182
[bot-1]   job=… ogChat=chat_… hcsSeq=3
[bot-1] done, spent $0.8123
```

On the dashboard: the revenue line pulls above the cost line, each job row links to its **payment on HashScan**, and shows the **0G chat ID** and **HCS sequence**. Open the topic on HashScan to watch the audit log grow.

Things to try:

```bash
curl -s localhost:3000/quote            # the price moves with kamai's real cost estimate
curl -s localhost:3000/stats            # the P&L
```

Raise `OG_USD_RATE` in `.env` and restart kamai — the quote goes up by itself, because the price is derived from the cost. Push past `maxDailyComputeUsd` and kamai goes **hungry**: it answers 503, takes no money, and its ENS status changes.

Bots stop at `--budget` USDC each, per run. To recycle USDC for a long demo, send it from kamai's treasury back to the customer accounts.

---

## Part 6: Deploy

You need a public URL for the demo so other agents (and judges) can reach kamai. Any Node host works; these steps use Render.

**kamai (the agent):** a Web Service.

| | |
|---|---|
| Build command | `npm install` |
| Start command | `npm run kamai` |
| Env vars | everything from `.env` (never commit `.env`) |

The server listens on `KAMAI_PORT` by default; set it to whatever the host expects (`PORT` is a common convention — set `KAMAI_PORT=$PORT` in the host's env).

**dashboard:** a Web Service (Next.js).

| | |
|---|---|
| Build command | `npm install && npm run build -w apps/dashboard` |
| Start command | `npm run start -w apps/dashboard` |
| Env vars | `NEXT_PUBLIC_KAMAI_API=https://<your-agent>.onrender.com` |

**Then:** re-run `ens-publish` with the public URL so agents find the public service:

```bash
KAMAI_PUBLIC_URL=https://<your-agent>.onrender.com npm run ens-publish
```

Notes:
- Free hosts have temporary disks, so `data/ledger.json` resets on restart. That's fine for a demo; the HCS topic is the durable record anyway.
- Generate fresh keys for the deployed service if you reuse `.env` locally (`npm run gen-keys`).

---

## Running on Windows

You have two options.

**Option A: WSL (easiest).** WSL gives you a Linux terminal inside Windows, and every command in this guide then works exactly as written.

1. In an **admin** PowerShell: `wsl --install`, then restart.
2. Open **Ubuntu** from the Start menu and install Node 22 inside it, e.g. with `nvm` or the NodeSource packages from https://nodejs.org.
3. Put the project inside the Linux file system (e.g. `~/kamai`), not under `/mnt/c/…`, which is much slower.
4. Follow this guide as if you were on Linux. Browsers on Windows can open `http://localhost:3001` directly.

**Option B: native PowerShell.** Every `npm run …` command works unchanged. These are the only differences:

| In this guide | In PowerShell |
|---|---|
| `cp .env.example .env` | `Copy-Item .env.example .env` |
| `curl …` | `curl.exe …` (plain `curl` is a different command in Windows PowerShell) |
| `export PATH=…` | not needed; the Node installer sets PATH |
| `lsof -nP -iTCP:3000 -sTCP:LISTEN` | `netstat -ano \| findstr :3000`, then `taskkill /PID <pid> /F` |
| `VAR=value npm run …` | `$env:VAR="value"; npm run …` (stays set for that window) |

For example, the ENS publish step in PowerShell:

```powershell
$env:KAMAI_PUBLIC_URL="http://localhost:3000"; npm run ens-publish
```

If Windows Firewall asks about Node.js when a server starts, **Allow** on private networks is enough for local use.

---

## Reference

### Commands

| Command | What it does |
|---|---|
| `npm run kamai` | Start the agent (:3000) |
| `npm run dashboard` | Start the dashboard (:3001; landing at `/`, P&L at `/dashboard`) |
| `npm run mock` | Fake `/stats` + `/jobs` on :3000 for frontend work |
| `npm run customers -- --bots 3 --interval 8 --budget 1` | Run the buyer bots |
| `npm run gen-keys` | Print two EVM key pairs |
| `npm run setup-hedera` | Associate USDC on all accounts, print balances |
| `npm run create-topic` | Create the HCS audit topic |
| `npm run setup-0g` | Check 0G balance, acknowledge the provider |
| `npm run ens-publish` | Write the owner records (url, price floor, cap, margin) |
| `npm run ens-delegate` | Authorize the agent key on status/stats only |
| `npx tsx scripts/ens-demo-fail.ts` | The agent tries to change its own cap — and fails |
| `npm run typecheck` | Typecheck everything |

### Env variables you fill in

| Variable | From |
|---|---|
| `KAMAI_ACCOUNT_ID`, `KAMAI_PRIVATE_KEY` | portal.hedera.com (3.1) |
| `CUSTOMER_*_ACCOUNT_ID`, `CUSTOMER_*_PRIVATE_KEY` | portal.hedera.com (3.1) |
| `OG_PRIVATE_KEY`, `ENS_OWNER_PRIVATE_KEY` | first key from `gen-keys` (3.2) |
| `ENS_AGENT_PRIVATE_KEY` | second key from `gen-keys` (3.2) |
| `HCS_TOPIC_ID` | `npm run create-topic` (4.2) |
| `OG_PROVIDER_ADDRESS` | `npm run setup-0g` (4.3) |
| `KAMAI_ENS_NAME`, `ENSV2_RESOLVER_ADDRESS` | the ENS name you register (3.4), `ens-publish` (4.4) |
| `FACILITATOR_URL` | defaults to Blocky402 testnet; backups in `.env.example` |
| `SEPOLIA_RPC_URL` | any Sepolia RPC; optional |
| `STARTING_FLOAT_USD`, `OG_USD_RATE` | have working defaults (0.25, 0.10) |

Everything else in `.env.example` has a working default.

### Layout

| Path | What |
|---|---|
| `packages/shared` | Types, env loading, ENSv2 client (EAC roles), Hedera helpers |
| `apps/kamai` | The agent: `gate.ts` → `paywall.ts` (x402) → `work.ts` (Mirror Node + 0G) → `ledger.ts` + `audit.ts` (HCS) + `reporter.ts` (ENS) |
| `apps/customers` | Buyer bots: ENS resolution, `/quote`, x402 pay, budget caps |
| `apps/dashboard` | Next.js: landing page (`/`) and live P&L (`/dashboard`) |
| `scripts/` | One-off setup scripts + the mock |
| `data/ledger.json` | The P&L store (created on first job, gitignored) |
| `docs/SPEC.md` | The build spec |

---

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| `Missing required env var X` | Fill in X in `.env` (see the table above). |
| `command not found: node` (macOS) | Run `export PATH="/opt/homebrew/opt/node@22/bin:$PATH"`. |
| `'node' is not recognized` (Windows) | Open a new terminal after installing Node. If it persists, reinstall Node and tick "Add to PATH". |
| `EADDRINUSE` on 3000/3001 | Something's already running there. macOS/Linux: `lsof -nP -iTCP:3000 -sTCP:LISTEN`. Windows: `netstat -ano \| findstr :3000`. Stop that process. |
| Windows: `running scripts is disabled on this system` | PowerShell blocks npm's script wrapper. Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, or use Command Prompt. |
| Circle faucet won't send USDC | The account isn't associated yet. Run `npm run setup-hedera` first. |
| Buyer: `failed: 402` | Kamai isn't running, or the ENS `url` record points somewhere else. |
| Buyer has no USDC / settle fails with `TOKEN_NOT_ASSOCIATED` | `setup-hedera` on that account, then the Circle faucet. |
| Payment rejected by the facilitator | Try another facilitator in `FACILITATOR_URL`: `https://x402.org/facilitator` or `https://testnet.facilitator.ax402.io`. |
| `0G ledger is empty` | faucet.0g.ai → your EVM address, then `npm run setup-0g`. |
| 0G answer is always the fallback text | The model isn't returning valid JSON; the mirror-node fallback is serving. Try another provider from `setup-0g`. |
| `is missing ENS text records` / stale policy | Re-run `ens-publish`; wait a minute for Sepolia to confirm. |
| `ens-demo-fail` succeeds when it shouldn't | EAC roles aren't configured — re-run `ens-delegate` with the right resolver. |
| `503 …hungry` | Working as intended: kamai hit its daily compute cap or allowance. Raise `KAMAI_MAX_DAILY_COMPUTE` via `ens-publish`, or let it earn. |
| Dashboard shows "agent offline" | Is `npm run kamai` (or `npm run mock`) running on :3000? Deployed: check `NEXT_PUBLIC_KAMAI_API`. |
| HashScan link shows "not found" | Wait a few seconds; the Mirror Node and HashScan can lag right after settlement. |

---

## What's verified

| Part | Status |
|---|---|
| Typecheck of every package, app and script | ✅ |
| Dashboard + landing rendered against the mock | ✅ Screenshotted headlessly (light + dark) |
| x402 server wired against real `@x402/*` 2.28 types (paywall, dynamic price, settle hook) | ✅ Against the installed packages |
| 0G broker calls against real `@0gfoundation/0g-compute-ts-sdk` 0.9 types | ✅ Against the installed packages |
| Real x402 payment end to end | ⬜ Needs funded Hedera accounts |
| 0G Compute inference + per-job cost (ledger delta) | ⬜ Needs OG funds |
| ENSv2 EAC per-record roles | ⬜ Resolver ABI is a documented best guess — confirm against docs.ens.domains at the booth, only `packages/shared/src/ens.ts` changes |
| HCS audit writes | ⬜ Needs a Hedera account + topic |
| Windows (native or WSL) | ⬜ Not run yet; only tested on macOS. The code uses no OS-specific APIs. |

## Built with

TypeScript, Express, `@x402/*` (Hedera exact scheme), `@hiero-ledger/sdk`, `@0gfoundation/0g-compute-ts-sdk`, viem, Next.js. Built with help from Claude Code; the spec it worked from is `docs/SPEC.md`.

MIT license.
