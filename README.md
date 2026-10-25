# kamai — the agent that pays its own bills

Every AI agent today runs on somebody's API key and credit card. Kamai runs on its own income. It sells **"explain this Hedera transaction"** to other agents over **x402** and gets paid per request in USDC. It does the work with inference on **0G Compute**, prices every job from what the job costs it, and refuses work that would lose money. Its identity and spending policy live in an **ENSv2** name where only the owner can set the limits — the agent can't change them. Every rupee in and out goes to a tamper-evident log on **Hedera Consensus Service**.

> "If it doesn't earn, it doesn't think."

---

# Full setup, end to end

Zero to a running kamai with live payments. Budget ~45 minutes, mostly waiting on faucets and transactions.

## 0. What you'll end up with

| Piece | Lives on | Purpose |
|---|---|---|
| Kamai's treasury account | Hedera testnet | receives USDC, writes the HCS audit log |
| 1–3 customer accounts | Hedera testnet | buyer bots that pay kamai |
| USDC token `0.0.429274` | Hedera testnet | the money (6 decimals) |
| HCS topic | Hedera testnet | tamper-evident P&L log |
| EVM wallet (owner) | 0G testnet + Sepolia | pays for 0G inference; owns the ENS name |
| EVM wallet (agent) | Sepolia | writes only kamai.status / kamai.stats on ENS |
| ENSv2 name | Sepolia | `kamai.<you>.eth` — identity, endpoint, policy |
| Node service | localhost:3000 | the agent |
| Dashboard | localhost:3001 | landing page + live P&L |

You need **Node 22+** (`node -v`) and npm 10+.

```bash
git clone <repo> && cd kamai
npm install
cp .env.example .env
```

## 1. Hedera testnet accounts (portal.hedera.com)

You need **two to four** ECDSA accounts: one for kamai (treasury) and one to three for customer bots.

1. Go to **portal.hedera.com** → create an account → select **Testnet**.
2. Create an **ECDSA** account. It gives you an account id like `0.0.123456` and a private key (hex). Save both.
3. Repeat for each customer account. Name them clearly (kamai, customer-1, …).
4. Each account starts with testnet HBAR from the portal. That pays gas for HCS writes and token association.

Fill in `.env`:

```
KAMAI_ACCOUNT_ID=0.0.xxxxxx
KAMAI_PRIVATE_KEY=<ECDSA hex private key>
CUSTOMER_1_ACCOUNT_ID=0.0.xxxxxx
CUSTOMER_1_PRIVATE_KEY=<ECDSA hex>
CUSTOMER_2_ACCOUNT_ID=...
CUSTOMER_2_PRIVATE_KEY=...
CUSTOMER_3_ACCOUNT_ID=...        # optional third bot
CUSTOMER_3_PRIVATE_KEY=...
```

## 2. USDC: associate + fund

Customers can't hold or send USDC until the token is **associated** with their account.

1. Associate USDC on every account (kamai + all customers):

   ```bash
   npm run setup-hedera
   ```

   This associates token `0.0.429274` on each account in `.env` and prints each USDC balance.

2. Fund the **customer** accounts with testnet USDC from **faucet.circle.com** → select **Hedera Testnet** → paste the customer account id. Kamai's treasury doesn't need any — it earns its own.

3. Create the HCS audit topic and put the id it prints into `.env`:

   ```bash
   npm run create-topic
   # → HCS_TOPIC_ID=0.0.xxxxxxx
   ```

```
HCS_TOPIC_ID=0.0.xxxxxxx
```

## 3. 0G Compute: EVM key, faucet, provider

1. Generate the two EVM keys (owner role + agent role — they **must differ**, or the ENS permission demo proves nothing):

   ```bash
   npm run gen-keys
   ```

   The first key printed is both your 0G wallet and your ENS owner. Fill in:

   ```
   OG_PRIVATE_KEY=0x...            # first key from gen-keys
   ENS_OWNER_PRIVATE_KEY=0x...     # same key
   ENS_AGENT_PRIVATE_KEY=0x...     # second key — different!
   ```

2. Get testnet OG: **faucet.0g.ai** → paste the first key's address. ~2 OG is plenty (0.1 minimum ledger deposit, a job costs a fraction of that).

3. Pick an inference provider. The setup script lists them and funds/acknowledges:

   ```bash
   npm run setup-0g
   ```

   It prints your chain balance, ledger balance, and the providers it sees. Put the chosen provider address in `.env`:

   ```
   OG_PROVIDER_ADDRESS=0x...
   ```

   If the ledger is empty the script tells you — go back to the faucet, or ask in the 0G Discord if it's dry.

## 4. ENSv2 on Sepolia: the name, the policy, the delegation

1. Get **Sepolia ETH** on both EVM addresses (owner pays for record writes; the agent pays a little gas for its status writes). Any Sepolia faucet works (e.g. sepoliafaucet.com / the POW one). ~0.05 on owner, ~0.01 on agent.

2. Register or pick your parent name and create the subname **`kamai.<you>.eth`** on the ENSv2 app on Sepolia, or set the name you already control:

   ```
   SEPOLIA_RPC_URL=https://...   # any Sepolia RPC (alchemy/infura/public)
   KAMAI_ENS_NAME=kamai.you.eth
   ```

3. Publish the owner records (service url + policy) and delegate the agent key:

   ```bash
   # first run resolves the resolver address; put it in .env as told, then re-run
   KAMAI_PUBLIC_URL=http://localhost:3000 npm run ens-publish
   # → set ENSV2_RESOLVER_ADDRESS=0x... in .env, then again:
   KAMAI_PUBLIC_URL=http://localhost:3000 npm run ens-publish
   npm run ens-delegate
   ```

   Optional policy overrides for the same command: `KAMAI_PRICE_FLOOR`, `KAMAI_MAX_DAILY_COMPUTE`, `KAMAI_MIN_MARGIN_BPS` (default 0.03 / 0.25 / 5000 bps).

4. Sanity check the whole ENS story:

   ```bash
   npx tsx scripts/ens-demo-fail.ts
   # ✔ rejected with EACUnauthorizedAccountRoles — the agent cannot change its own limits
   ```

   Customer bots resolve kamai **only** through this name — no hard-coded URL.

## 5. Fill the rest of `.env`

```
FACILITATOR_URL=https://api.testnet.blocky402.com   # x402 facilitator (backups in .env.example)
STARTING_FLOAT_USD=0.25                             # kamai's first "meal" before it has earned
OG_USD_RATE=0.10                                    # stated trade-off: OG cost converted to USD at this rate
KAMAI_PORT=3000
```

## 6. Run it

Three terminals:

```bash
npm run kamai                                    # 1. the agent (:3000)
npm run dashboard                                # 2. landing + live P&L (:3001)
npm run customers -- --bots 3 --interval 8 --budget 1   # 3. buyer bots
```

Then:

- Landing page: **http://localhost:3001**
- Live P&L: **http://localhost:3001/dashboard**
- Raw endpoints: `:3000/health`, `:3000/quote`, `:3000/stats`, `:3000/jobs`
- The settled payment: each job row links to its HashScan USDC transfer; the 0G chat id and HCS sequence are shown per job.

No keys yet? `npm run mock` fakes `/stats` + `/jobs` on :3000 so you can work on the frontend.

## 7. What's honest vs. simulated

- **Real:** every x402 USDC payment settles on Hedera testnet; every job costs real 0G inference; every revenue/cost event lands on the HCS topic; the ENS EAC delegation is real on Sepolia.
- **Stated trade-off:** kamai earns USDC (Hedera) and spends OG (0G). There is no testnet bridge between them, so the ledger is kept in USD terms with `OG_USD_RATE`. The compute allowance = revenue − cost + float. A real swap is future work, said as such — not faked.

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| `Missing required env var …` | Fill `.env` from `.env.example` |
| Buyer gets `TOKEN_NOT_ASSOCIATED` | `npm run setup-hedera` on that account |
| Buyer has no USDC | faucet.circle.com → Hedera Testnet |
| `0G ledger is empty` | faucet.0g.ai → your EVM address, then `npm run setup-0g` |
| ENS writes revert unexpectedly | check `ENSV2_RESOLVER_ADDRESS` and that the owner key owns the name |
| Agent key can't write status/stats | re-run `npm run ens-delegate` |
| `503 …hungry` | working as intended — kamai hit its daily cap; raise `KAMAI_MAX_DAILY_COMPUTE` via ens-publish |
| Dashboard shows "agent offline" | is `npm run kamai` (or `npm run mock`) on :3000? |

## 9. AI-tool attribution

Built with AI assistance (Claude Code). The spec and prompts live in [`docs/SPEC.md`](docs/SPEC.md) and the commit history. MIT license.
