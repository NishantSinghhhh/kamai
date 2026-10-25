/**
 * Reporter: every N jobs (or minutes) kamai writes its own status and stats
 * to ENS with its delegated key. This is the ONLY thing its key can write —
 * the policy records belong to the owner.
 */
import {
  ENS_RECORD_KEYS,
  createEnsClients,
  readPolicy,
  statsToRecord,
  statusToRecord,
  writeAgentRecord,
  type EnsClients,
  type Policy,
  type Stats,
} from "@kamai/shared";

export type ReporterOpts = {
  rpcUrl: string;
  ensName: string;
  agentPrivateKey: string;
  ownerPrivateKeyForReads?: string; // not needed; reads use the public client
};

export class Reporter {
  private clients: EnsClients | null = null;
  private ensName: string;

  constructor(private opts: ReporterOpts) {
    this.ensName = opts.ensName;
  }

  private ensureClients(): EnsClients {
    if (!this.clients) {
      this.clients = createEnsClients({
        rpcUrl: this.opts.rpcUrl,
        ensName: this.ensName,
        // the reporter only ever signs with the AGENT key
        ownerPrivateKey: this.opts.agentPrivateKey, // unused for writes we make
        agentPrivateKey: this.opts.agentPrivateKey,
      });
    }
    return this.clients;
  }

  async writeStatus(status: Stats["status"], reason?: string): Promise<{ txHash: string } | { error: string }> {
    try {
      return await writeAgentRecord(this.ensureClients(), ENS_RECORD_KEYS.status, statusToRecord(status, reason));
    } catch (e) {
      return { error: String((e as Error).message ?? e) };
    }
  }

  async writeStats(stats: Stats): Promise<{ txHash: string } | { error: string }> {
    try {
      return await writeAgentRecord(this.ensureClients(), ENS_RECORD_KEYS.stats, statsToRecord(stats));
    } catch (e) {
      return { error: String((e as Error).message ?? e) };
    }
  }

  /** Read the owner's policy out of ENS. Called at startup and periodically. */
  async readPolicy(defaults: Policy): Promise<Policy> {
    try {
      return await readPolicy(this.ensureClients(), this.ensName, defaults);
    } catch {
      return defaults; // ENS unreachable: keep the last known defaults
    }
  }
}
