import "dotenv/config";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v.trim();
}

function opt(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : fallback;
}

function num(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v.trim() === "") return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Env var ${name} is not a number: ${v}`);
  return n;
}

export type CustomerAccount = { accountId: string; privateKey: string };

export type Config = {
  // Hedera
  hederaUsdcTokenId: string;
  facilitatorUrl: string;
  mirrorNodeUrl: string;
  kamaiAccountId: string;
  kamaiPrivateKey: string;
  customers: CustomerAccount[];
  hcsTopicId: string | null;

  // 0G
  ogRpcUrl: string;
  ogPrivateKey: string;
  ogProviderAddress: string;
  ogUsdRate: number;

  // ENS (Sepolia, ENSv2)
  sepoliaRpcUrl: string;
  kamaiEnsName: string;
  ensOwnerPrivateKey: string;
  ensAgentPrivateKey: string;

  // Ledger
  startingFloatUsd: number;

  // Server
  kamaiPort: number;
};

export function loadConfig(): Config {
  const customers: CustomerAccount[] = [];
  for (let i = 1; i <= 3; i++) {
    const accountId = process.env[`CUSTOMER_${i}_ACCOUNT_ID`]?.trim();
    const privateKey = process.env[`CUSTOMER_${i}_PRIVATE_KEY`]?.trim();
    if (accountId && privateKey) customers.push({ accountId, privateKey });
  }

  return {
    hederaUsdcTokenId: opt("HEDERA_USDC_TOKEN_ID", "0.0.429274"),
    facilitatorUrl: opt("FACILITATOR_URL", "https://api.testnet.blocky402.com"),
    mirrorNodeUrl: opt("MIRROR_NODE_URL", "https://testnet.mirrornode.hedera.com"),
    kamaiAccountId: req("KAMAI_ACCOUNT_ID"),
    kamaiPrivateKey: req("KAMAI_PRIVATE_KEY"),
    customers,
    hcsTopicId: process.env.HCS_TOPIC_ID?.trim() || null,

    ogRpcUrl: opt("OG_RPC_URL", "https://evmrpc-testnet.0g.ai"),
    ogPrivateKey: req("OG_PRIVATE_KEY"),
    ogProviderAddress: req("OG_PROVIDER_ADDRESS"),
    ogUsdRate: num("OG_USD_RATE", 0.1),

    sepoliaRpcUrl: req("SEPOLIA_RPC_URL"),
    kamaiEnsName: opt("KAMAI_ENS_NAME", "kamai.you.eth"),
    ensOwnerPrivateKey: req("ENS_OWNER_PRIVATE_KEY"),
    ensAgentPrivateKey: req("ENS_AGENT_PRIVATE_KEY"),

    startingFloatUsd: num("STARTING_FLOAT_USD", 0.25),

    kamaiPort: num("KAMAI_PORT", 3000),
  };
}
