import type { ActivityRecord } from "@80hd/shared";
import {
  normalizeActivity,
  type NormalizationContext,
  type NormalizedActivity
} from "./normalizer/activity-normalizer.js";
import { Microsoft365Connector, SlackConnector } from "./connectors/index.js";
import {
  chunkActivity,
  type ActivityChunkInsert
} from "./workers/embedding-worker.js";

export interface IngestionDependencies {
  microsoftConnector?: Microsoft365Connector;
  slackConnector?: SlackConnector;
  persistActivities: (records: NormalizedActivity[]) => Promise<void>;
  persistChunks: (chunks: ActivityChunkInsert[]) => Promise<void>;
}

export class IngestionPipeline {
  constructor(private readonly deps: IngestionDependencies) {}

  async ingestMicrosoft(deltaToken?: string): Promise<void> {
    if (!this.deps.microsoftConnector) return;
    const { activities } = await this.deps.microsoftConnector.syncMail(deltaToken);
    await this.persistAll("microsoft-mail", activities);
  }

  async ingestTeams(deltaToken?: string): Promise<void> {
    if (!this.deps.microsoftConnector) return;
    const { activities } = await this.deps.microsoftConnector.syncTeamsChats(deltaToken);
    await this.persistAll("microsoft-teams", activities);
  }

  async ingestSlack(channelId: string, cursor?: string): Promise<void> {
    if (!this.deps.slackConnector) return;
    const { activities } = await this.deps.slackConnector.syncChannel(channelId, cursor);
    await this.persistAll("slack", activities);
  }

  private async persistAll(
    source: ActivityRecord["source"],
    activities: ActivityRecord[]
  ) {
    const normalized = activities.map((activity) => normalizeActivity(
      activity,
      this.buildContext(source)
    ));

    if (normalized.length === 0) return;

    await this.deps.persistActivities(normalized);

    const chunks = normalized.flatMap((activity) => chunkActivity(activity).map((chunk) => ({
      ...chunk,
      tenant_id: activity.tenantId
    })));

    if (chunks.length > 0) {
      await this.deps.persistChunks(chunks);
    }
  }

  private buildContext(source: ActivityRecord["source"]): NormalizationContext {
    return {
      tenantId: "todo-tenant",
      source,
      receivedAt: new Date().toISOString()
    };
  }
}

