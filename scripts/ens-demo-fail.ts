/**
 * The ENS moment for the demo video: the AGENT key tries to raise its own
 * spending cap and the resolver rejects it with EACUnauthorizedAccountRoles.
 * Only the owner can change the policy.
 */
import { agentAttemptsPolicyWrite, createEnsClients, loadConfig, ENS_RECORD_KEYS } from "@kamai/shared";

const cfg = loadConfig();

async function main() {
  const clients = createEnsClients({
    rpcUrl: cfg.sepoliaRpcUrl,
    ensName: cfg.kamaiEnsName,
    ownerPrivateKey: cfg.ensOwnerPrivateKey,
    agentPrivateKey: cfg.ensAgentPrivateKey,
  });
  console.log(`agent ${clients.agentWallet.account!.address} tries to write ${ENS_RECORD_KEYS.maxDailyComputeUsd}…`);
  try {
    await agentAttemptsPolicyWrite(clients, ENS_RECORD_KEYS.maxDailyComputeUsd, "999");
    console.error("UNEXPECTED: the write succeeded — EAC roles are not configured correctly!");
    process.exit(1);
  } catch (e) {
    const msg = String((e as Error).message ?? e);
    if (msg.includes("EACUnauthorizedAccountRoles")) {
      console.log("✔ rejected with EACUnauthorizedAccountRoles — the agent cannot change its own limits");
    } else {
      console.log(`rejected with: ${msg}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
