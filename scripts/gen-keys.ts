/**
 * Generate the three throwaway keys the demo needs:
 *   - one Hedera ECDSA account pair for kamai (treasury + HCS)
 *   - one EVM key for 0G + the ENS owner role
 *   - one EVM key for the ENS agent role (must differ from the owner's!)
 * Prints them; copy into .env. Never commit real keys.
 */
import { Wallet, ethers } from "ethers";

for (const label of ["ENS_OWNER / 0G", "ENS_AGENT"]) {
  const w = Wallet.createRandom();
  console.log(`${label}:`);
  console.log(`  address:    ${w.address}`);
  console.log(`  privateKey: ${w.privateKey}`);
}

// Hedera testnet accounts come from portal.hedera.com (they need faucet funds);
// an ECDSA key pair can still be generated here for reference.
const hedera = ethers.hexlify(ethers.randomBytes(32));
console.log(`HEDERA (ECDSA seed — prefer portal.hedera.com accounts):`);
console.log(`  privateKey: ${hedera}`);
