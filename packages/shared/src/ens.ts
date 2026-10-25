/**
 * ENSv2 integration (Sepolia).
 *
 * Kamai's identity and policy live in ENS text records:
 *   url                          owner-writable
 *   kamai.price.floor            owner-writable
 *   kamai.policy.maxDailyComputeUsd  owner-writable
 *   kamai.policy.minMarginBps        owner-writable
 *   kamai.status                 agent-writable (EAC-delegated)
 *   kamai.stats                  agent-writable (EAC-delegated)
 *
 * ENSv2 Enhanced Access Control (EAC) grants roles PER RECORD KEY, so the
 * agent's key can write status/stats but the owner key is the only one that
 * can touch the policy records.
 *
 * NOTE (booth check): the resolver ABI below is centralized here on purpose.
 * Confirm the exact EAC function signatures against docs.ens.domains
 * (/ensv2/enhanced-access-control, /ensv2/permissioned-resolver) and adjust
 * only this file.
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  namehash,
  type Address,
  type HttpTransport,
  type PrivateKeyAccount,
  type PublicClient,
  type WalletClient,
} from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import type { Policy, Stats, AgentStatus } from "./types.js";

export const ENS_RECORD_KEYS = {
  url: "url",
  priceFloor: "kamai.price.floor",
  maxDailyComputeUsd: "kamai.policy.maxDailyComputeUsd",
  minMarginBps: "kamai.policy.minMarginBps",
  status: "kamai.status",
  stats: "kamai.stats",
} as const;

/**
 * ENSv2 permissioned resolver. If ENSV2_RESOLVER_ADDRESS is set we use it
 * directly; otherwise viem's ENS helpers resolve through the standard chain.
 */
export const ENSV2_RESOLVER_ABI = [
  {
    name: "text",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
    ],
    outputs: [{ type: "string" }],
  },
  {
    name: "setText",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
      { name: "value", type: "string" },
    ],
  },
  // EAC: grant an account write roles on specific record keys.
  // Signature to confirm at the ENS booth (see note above).
  {
    name: "authorizeRoles",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "account", type: "address" },
      { name: "role", type: "uint256" },
      { name: "keys", type: "string[]" },
    ],
  },
] as const;

type SepoliaWalletClient = WalletClient<HttpTransport, typeof sepolia, PrivateKeyAccount>;

export type EnsClients = {
  public: PublicClient;
  ownerWallet: SepoliaWalletClient;
  agentWallet: SepoliaWalletClient;
  resolverAddress: Address | null;
  node: `0x${string}`;
};

export function createEnsClients(opts: {
  rpcUrl: string;
  ensName: string;
  ownerPrivateKey: string;
  agentPrivateKey: string;
}): EnsClients {
  const owner = privateKeyToAccount(opts.ownerPrivateKey as `0x${string}`);
  const agent = privateKeyToAccount(opts.agentPrivateKey as `0x${string}`);
  const public_ = createPublicClient({ chain: sepolia, transport: http(opts.rpcUrl) });
  const resolverAddress = (process.env.ENSV2_RESOLVER_ADDRESS?.trim() || null) as Address | null;
  return {
    public: public_,
    ownerWallet: createWalletClient({ chain: sepolia, transport: http(opts.rpcUrl), account: owner }),
    agentWallet: createWalletClient({ chain: sepolia, transport: http(opts.rpcUrl), account: agent }),
    resolverAddress,
    node: namehash(opts.ensName),
  };
}

export async function readRecord(clients: EnsClients, name: string, key: string): Promise<string | null> {
  if (clients.resolverAddress) {
    const value = (await clients.public.readContract({
      address: clients.resolverAddress,
      abi: ENSV2_RESOLVER_ABI,
      functionName: "text",
      args: [clients.node, key],
    })) as unknown as string;
    return value === "" ? null : value;
  }
  const { getEnsText } = await import("viem/ens");
  const value = (await clients.public.getEnsText({ name, key })) as unknown as string | null;
  return value ?? null;
}

export async function readPolicy(
  clients: EnsClients,
  name: string,
  defaults: Policy,
): Promise<Policy> {
  const [floor, cap, margin] = await Promise.all([
    readRecord(clients, name, ENS_RECORD_KEYS.priceFloor),
    readRecord(clients, name, ENS_RECORD_KEYS.maxDailyComputeUsd),
    readRecord(clients, name, ENS_RECORD_KEYS.minMarginBps),
  ]);
  return {
    priceFloorUsd: parseNum(floor, defaults.priceFloorUsd),
    maxDailyComputeUsd: parseNum(cap, defaults.maxDailyComputeUsd),
    minMarginBps: Math.round(parseNum(margin, defaults.minMarginBps)),
  };
}

function parseNum(v: string | null, fallback: number): number {
  if (v === null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Write a record with the AGENT key. Only valid for kamai.status / kamai.stats. */
export async function writeAgentRecord(
  clients: EnsClients,
  key: string,
  value: string,
): Promise<{ txHash: string }> {
  if (!clients.resolverAddress) {
    throw new Error(
      "ENSV2_RESOLVER_ADDRESS is not set; set it in .env once the resolver address is known (ens-publish writes it).",
    );
  }
  const hash = await clients.agentWallet.writeContract({
    chain: sepolia,
    address: clients.resolverAddress,
    abi: ENSV2_RESOLVER_ABI,
    functionName: "setText",
    args: [clients.node, key, value],
  });
  return { txHash: hash };
}

/** Owner-only records (url, policy). Used by scripts/ens-publish.ts. */
export async function writeOwnerRecord(
  clients: EnsClients,
  key: string,
  value: string,
): Promise<{ txHash: string }> {
  if (!clients.resolverAddress) {
    throw new Error("ENSV2_RESOLVER_ADDRESS is not set.");
  }
  const hash = await clients.ownerWallet.writeContract({
    chain: sepolia,
    address: clients.resolverAddress,
    abi: ENSV2_RESOLVER_ABI,
    functionName: "setText",
    args: [clients.node, key, value],
  });
  return { txHash: hash };
}

/**
 * The ENS moment: the agent tries to raise its own spending cap and is
 * rejected by the resolver with EACUnauthorizedAccountRoles.
 * Never swallows the revert — the error text is the demo.
 */
export async function agentAttemptsPolicyWrite(
  clients: EnsClients,
  key: string,
  value: string,
): Promise<{ txHash: string }> {
  if (!clients.resolverAddress) throw new Error("ENSV2_RESOLVER_ADDRESS is not set.");
  const hash = await clients.agentWallet.writeContract({
    chain: sepolia,
    address: clients.resolverAddress,
    abi: ENSV2_RESOLVER_ABI,
    functionName: "setText",
    args: [clients.node, key, value],
  });
  return { txHash: hash };
}

export function statsToRecord(stats: Stats): string {
  return JSON.stringify(stats);
}

export function statusToRecord(status: AgentStatus, reason?: string): string {
  return reason ? `${status}:${reason}` : status;
}

/** Small helper for scripts that print balances. */
export async function sepoliaBalance(clients: EnsClients, address: Address): Promise<string> {
  const wei = await clients.public.getBalance({ address });
  return formatEther(wei);
}

/** Resolve the resolver address for the kamai name on Sepolia (ENSv2). */
export async function resolveResolver(clients: EnsClients, name: string): Promise<Address> {
  const { getEnsResolver } = await import("viem/ens");
  return clients.public.getEnsResolver({ name });
}
