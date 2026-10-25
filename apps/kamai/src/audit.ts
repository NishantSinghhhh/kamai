/**
 * Audit log: every revenue and cost event goes to an HCS topic, giving the
 * P&L a tamper-evident, timestamped, consensus-ordered record.
 */
import {
  Client,
  PrivateKey,
  TopicMessageSubmitTransaction,
  type AccountId,
} from "@hiero-ledger/sdk";
import type { AuditEvent } from "@kamai/shared";

export class AuditLog {
  private client: Client | null = null;

  constructor(
    private opts: { topicId: string | null; accountId: string; privateKey: string },
  ) {}

  private getClient(): Client | null {
    if (!this.opts.topicId) return null;
    if (!this.client) {
      this.client = Client.forName("testnet");
      this.client.setOperator(
        this.opts.accountId,
        PrivateKey.fromString(this.opts.privateKey),
      );
    }
    return this.client;
  }

  /** Returns the HCS sequence number, or null when no topic is configured. */
  async publish(event: AuditEvent): Promise<number | null> {
    const client = this.getClient();
    if (!client) return null;
    const resp = await new TopicMessageSubmitTransaction({
      topicId: this.opts.topicId!,
      message: JSON.stringify(event),
    }).execute(client);
    const receipt = await resp.getReceipt(client);
    return receipt.topicSequenceNumber?.toNumber() ?? null;
  }
}
