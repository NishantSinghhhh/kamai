/** Hedera transaction-id formats and HashScan/Mirror Node helpers. */

export type Network = "mainnet" | "testnet";

/**
 * Hedera tx ids come in two shapes:
 *   with payer:  0.0.123@1700000000.123  (what you get from receipts / users)
 *   for Mirror Node REST: 0.0.123-1700000000-123
 */
export function txIdToMirrorFormat(txId: string): string {
  return txId.replace("@", "-").replace(".", "-");
}

/** Keep only the consensus timestamp part of a payer-qualified tx id. */
export function txIdToTimestamp(txId: string): string {
  const at = txId.indexOf("@");
  return at === -1 ? txId : txId.slice(at + 1);
}

export function hashScanTxUrl(txId: string, network: Network = "testnet"): string {
  return `https://hashscan.io/${network}/transaction/${txIdToTimestamp(txId)}`;
}

export function hashScanAccountUrl(accountId: string, network: Network = "testnet"): string {
  return `https://hashscan.io/${network}/account/${accountId}`;
}

export function hashScanTopicUrl(topicId: string, network: Network = "testnet"): string {
  return `https://hashscan.io/${network}/topic/${topicId}`;
}

export function mirrorTxUrl(mirrorNodeUrl: string, txId: string): string {
  const base = mirrorNodeUrl.replace(/\/+$/, "");
  return `${base}/api/v1/transactions/${txIdToMirrorFormat(txId)}`;
}

/** Pull a canonical tx id out of loose user input ("0.0.123@…", bare timestamps, urls). */
export function normalizeTxId(input: string): string {
  const trimmed = input.trim();
  const fromUrl = trimmed.match(/hashscan\.io\/[^/]+\/transaction\/(.+?)(\/|$|\?)/);
  if (fromUrl?.[1]) return fromUrl[1];
  return trimmed;
}

/** Loose check that a string looks like a Hedera tx id or consensus timestamp. */
export function looksLikeTxId(input: string): boolean {
  const v = normalizeTxId(input);
  const forms = [
    /^0\.0\.\d+@\d{9,10}\.\d{1,9}$/, // 0.0.123@1700000000.123
    /^0\.0\.\d+-\d{9,10}-\d{1,9}$/, // 0.0.123-1700000000-123 (mirror form)
    /^\d{9,10}\.\d{1,9}$/, // bare timestamp 1700000000.123
  ];
  return forms.some((r) => r.test(v));
}
