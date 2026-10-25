/**
 * 0G setup: fund the ledger if needed, list providers with their models and
 * prices, acknowledge the chosen provider, and print a starting OG balance.
 * Minimum ledger deposit is 0.1 OG; provider transfers are 0.01 OG.
 */
import { ethers } from "ethers";
import { loadConfig } from "@kamai/shared";
import { OgCompute, formatOg } from "../apps/kamai/src/work.js";

const cfg = loadConfig();

async function main() {
  const provider = new ethers.JsonRpcProvider(cfg.ogRpcUrl);
  const og = new OgCompute({
    rpcUrl: cfg.ogRpcUrl,
    privateKey: cfg.ogPrivateKey,
    providerAddress: cfg.ogProviderAddress,
  });

  const ready = await og.ensureReady();
  console.log(`0G ledger balance: ${ready.ledgerOg} OG`);
  console.log(`provider: ${cfg.ogProviderAddress}`);
  const wallet = new ethers.Wallet(cfg.ogPrivateKey);
  console.log(`wallet:   ${wallet.address}`);
  const chainBalance = await provider.getBalance(wallet.address);
  console.log(`balance (chain): ${formatOg(chainBalance)} OG`);

  // TODO(0G): list service metadata (models + input prices) once the SDK's
  // listing API is confirmed from its .d.ts; pick the cheapest capable model
  // and put its provider address in OG_PROVIDER_ADDRESS.
  console.log("\nDone. If the ledger is low, top up via faucet.0g.ai (min 0.1 OG).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
