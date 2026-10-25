/**
 * Owner setup for ENSv2 (run once, from the OWNER key):
 *   1. resolve the resolver for kamai.<you>.eth (or take ENSV2_RESOLVER_ADDRESS)
 *   2. write the owner records: url, price floor, daily compute cap, min margin
 *   3. delegate the AGENT key write access to kamai.status / kamai.stats only
 * Prints the resolver address for .env (ENSV2_RESOLVER_ADDRESS).
 */
import { loadConfig, writeOwnerRecord, createEnsClients, resolveResolver, ENS_RECORD_KEYS } from "@kamai/shared";

const cfg = loadConfig();

async function main() {
  const clients = createEnsClients({
    rpcUrl: cfg.sepoliaRpcUrl,
    ensName: cfg.kamaiEnsName,
    ownerPrivateKey: cfg.ensOwnerPrivateKey,
    agentPrivateKey: cfg.ensAgentPrivateKey,
  });
  const ownerAddress = clients.ownerWallet.account!.address;
  const agentAddress = clients.agentWallet.account!.address;
  console.log(`name:  ${cfg.kamaiEnsName}`);
  console.log(`owner: ${ownerAddress} (sepolia.etherscan.io/address/${ownerAddress})`);
  console.log(`agent: ${agentAddress}`);

  const resolver = await resolveResolver(clients, cfg.kamaiEnsName);
  console.log(`resolver: ${resolver}`);
  console.log(`→ set ENSV2_RESOLVER_ADDRESS=${resolver} in .env, then re-run this script.`);

  const serviceUrl = process.env.KAMAI_PUBLIC_URL;
  if (!serviceUrl) {
    console.log("\nKAMAI_PUBLIC_URL is not set — skipping the url record.");
  } else {
    const r = await writeOwnerRecord(clients, ENS_RECORD_KEYS.url, serviceUrl);
    console.log(`url = ${serviceUrl} (tx ${r.txHash})`);
  }

  const floor = process.env.KAMAI_PRICE_FLOOR ?? "0.03";
  const cap = process.env.KAMAI_MAX_DAILY_COMPUTE ?? "0.25";
  const margin = process.env.KAMAI_MIN_MARGIN_BPS ?? "5000"; // 50%
  const r1 = await writeOwnerRecord(clients, ENS_RECORD_KEYS.priceFloor, floor);
  console.log(`${ENS_RECORD_KEYS.priceFloor} = ${floor} (tx ${r1.txHash})`);
  const r2 = await writeOwnerRecord(clients, ENS_RECORD_KEYS.maxDailyComputeUsd, cap);
  console.log(`${ENS_RECORD_KEYS.maxDailyComputeUsd} = ${cap} (tx ${r2.txHash})`);
  const r3 = await writeOwnerRecord(clients, ENS_RECORD_KEYS.minMarginBps, margin);
  console.log(`${ENS_RECORD_KEYS.minMarginBps} = ${margin} (tx ${r3.txHash})`);

  console.log("\nNow delegate the agent key: npm run ens-delegate");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
