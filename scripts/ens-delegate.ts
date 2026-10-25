/**
 * Delegate the AGENT key write access on exactly two record keys:
 *   kamai.status, kamai.stats
 * Run from the owner (scripts/ens-publish.ts wrote the owner records first).
 *
 * The demo moment this enables: the agent key CAN write these two keys, and
 * CANNOT write the policy keys — trying so reverts with
 * EACUnauthorizedAccountRoles (scripts/ens-demo-fail.ts shows it).
 */
import { createEnsClients, loadConfig, ENS_RECORD_KEYS } from "@kamai/shared";

const cfg = loadConfig();

async function main() {
  if (!process.env.ENSV2_RESOLVER_ADDRESS) {
    throw new Error("Set ENSV2_RESOLVER_ADDRESS in .env first (scripts/ens-publish.ts prints it)");
  }
  const clients = createEnsClients({
    rpcUrl: cfg.sepoliaRpcUrl,
    ensName: cfg.kamaiEnsName,
    ownerPrivateKey: cfg.ensOwnerPrivateKey,
    agentPrivateKey: cfg.ensAgentPrivateKey,
  });
  const agentAddress = clients.agentWallet.account!.address;

  // NOTE (booth check): call shape comes from the centralized ABI in
  // packages/shared/src/ens.ts — confirm the EAC authorize function against
  // docs.ens.domains /ensv2/enhanced-access-control before running.
  const { ENSV2_RESOLVER_ABI } = await import("@kamai/shared");
  const hash = await clients.ownerWallet.writeContract({
    address: process.env.ENSV2_RESOLVER_ADDRESS as `0x${string}`,
    abi: ENSV2_RESOLVER_ABI,
    functionName: "authorizeRoles",
    args: [clients.node, agentAddress, 1n, [ENS_RECORD_KEYS.status, ENS_RECORD_KEYS.stats]],
  });
  console.log(`authorized ${agentAddress} on [${ENS_RECORD_KEYS.status}, ${ENS_RECORD_KEYS.stats}]`);
  console.log(`tx: ${hash}`);
  console.log(`\nVerify the negative case: npx tsx scripts/ens-demo-fail.ts`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
