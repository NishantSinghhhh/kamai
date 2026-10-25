/** Create the HCS audit topic and print its id (put it in .env as HCS_TOPIC_ID). */
import { Client, PrivateKey, TopicCreateTransaction } from "@hiero-ledger/sdk";
import { hashScanTopicUrl, loadConfig } from "@kamai/shared";

const cfg = loadConfig();

async function main() {
  const client = Client.forName("testnet");
  client.setOperator(
    cfg.kamaiAccountId,
    PrivateKey.fromString(cfg.kamaiPrivateKey),
  );
  const resp = await new TopicCreateTransaction()
    .setTopicMemo("kamai P&L audit log — every revenue and cost event")
    .execute(client);
  const receipt = await resp.getReceipt(client);
  const topicId = receipt.topicId!.toString();
  console.log(`HCS_TOPIC_ID=${topicId}`);
  console.log(`HashScan: ${hashScanTopicUrl(topicId)}`);
  client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
