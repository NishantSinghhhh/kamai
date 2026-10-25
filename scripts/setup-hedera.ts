/**
 * Hedera setup: associate USDC on every account in .env and print balances.
 * Run once before the demo; customers can't pay without the association.
 */
import {
  AccountId,
  Client,
  PrivateKey,
  TokenAssociateTransaction,
  TokenId,
} from "@hiero-ledger/sdk";
import { loadConfig } from "@kamai/shared";

const cfg = loadConfig();

async function associate(client: Client, accountId: string, privateKey: string, tokenId: string) {
  const id = AccountId.fromString(accountId);
  const key = PrivateKey.fromString(privateKey);
  client.setOperator(id, key);
  try {
    const resp = await new TokenAssociateTransaction()
      .setAccountId(id)
      .setTokenIds([TokenId.fromString(tokenId)])
      .execute(client);
    await resp.getReceipt(client);
    console.log(`associated ${tokenId} on ${accountId}`);
  } catch (e) {
    const msg = String((e as Error).message);
    if (msg.includes("TOKEN_ALREADY_ASSOCIATED")) {
      console.log(`${accountId}: already associated`);
    } else {
      throw e;
    }
  }
}

async function balance(client: Client, accountId: string, tokenId: string): Promise<string> {
  const res = await fetch(
    `https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}/tokens?token.id=${tokenId}`,
  );
  const body = (await res.json()) as { tokens?: { balance: string }[] };
  const bal = body.tokens?.[0]?.balance ?? "0";
  // USDC has 6 decimals
  return (Number(bal) / 1e6).toFixed(6);
}

async function main() {
  const client = Client.forName("testnet");
  const accounts: [string, string][] = [
    [cfg.kamaiAccountId, cfg.kamaiPrivateKey],
    ...cfg.customers.map((c) => [c.accountId, c.privateKey] as [string, string]),
  ];
  for (const [accountId, privateKey] of accounts) {
    await associate(client, accountId, privateKey, cfg.hederaUsdcTokenId);
    const bal = await balance(client, accountId, cfg.hederaUsdcTokenId);
    console.log(`${accountId}: ${bal} USDC`);
  }
  client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
