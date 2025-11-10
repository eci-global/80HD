import { randomUUID } from "node:crypto";
import { WebClient, type ConversationsHistoryResponse } from "@slack/web-api";
import type { ActivityRecord, ActivityMetadata } from "@80hd/shared";
import { SlackMCPClient } from "../lib/mcp-client.js";

export interface SlackConnectorConfig {
  botToken: string;
  teamId: string;
  cursor?: string;
}

export interface SlackConnectorResult {
  activities: ActivityRecord[];
  cursor?: string;
}

export class SlackConnector {
  private readonly client: WebClient;
  private readonly mcpClient: SlackMCPClient;

  constructor(token: string, mcpClient?: SlackMCPClient) {
    this.client = new WebClient(token);
    this.mcpClient = mcpClient ?? new SlackMCPClient();
  }

  static fromConfig(config: SlackConnectorConfig) {
    return new SlackConnector(config.botToken);
  }

  /**
   * Check if MCP server is available and preferred for data fetching.
   * Falls back to direct Slack Web API if MCP is unavailable.
   */
  private async useMCP(): Promise<boolean> {
    return this.mcpClient.isAvailable();
  }

  async syncChannel(channelId: string, cursor?: string): Promise<SlackConnectorResult> {
    const response = await this.client.conversations.history({
      channel: channelId,
      cursor,
      limit: 200,
      inclusive: false
    }) as ConversationsHistoryResponse;

    const activities =
      response.messages?.map((message) =>
        buildSlackActivity({
          channelId,
          message,
          teamId: channelId.split(":")[0] ?? "unknown"
        })
      ).filter((activity): activity is ActivityRecord => activity !== null) ?? [];

    return { activities, cursor: response.response_metadata?.next_cursor };
  }

  async syncDMs(cursor?: string): Promise<SlackConnectorResult> {
    const response = await this.client.conversations.list({
      types: "im,mpim",
      cursor,
      limit: 150
    });

    const allActivities: ActivityRecord[] = [];
    let nextCursor = response.response_metadata?.next_cursor;

    for (const channel of response.channels ?? []) {
      if (!channel.id) continue;
      const result = await this.syncChannel(channel.id);
      allActivities.push(...result.activities);
      nextCursor = result.cursor ?? nextCursor;
    }

    return { activities: allActivities, cursor: nextCursor };
  }
}

interface SlackTransformInput {
  teamId: string;
  channelId: string;
  message?: ConversationsHistoryResponse["messages"] extends (infer T)[] ? T : never;
}

function buildSlackActivity(input: SlackTransformInput): ActivityRecord | null {
  const { message, channelId } = input;
  if (!message || !("text" in message)) return null;

  const baseMetadata: ActivityMetadata = {
    urgency: message.subtype === "reminder_add" ? 0.6 : 0.2,
    sentiment: null,
    topics: extractTopics(message.text ?? ""),
    project: null,
    rawImportanceLabel: message.subtype ?? undefined,
    requiresResponse: Boolean(message.text?.includes("<@")),
    dueAt: null,
    messageUrl: buildPermalink(channelId, message.ts ?? ""),
  };

  return {
    id: `slack-${message.client_msg_id ?? randomUUID()}`,
    source: "slack",
    sourceMessageId: message.ts ?? randomUUID(),
    threadId: message.thread_ts ?? message.ts ?? null,
    channelId,
    occurredAt: toISOString(message.ts),
    receivedAt: toISOString(message.ts),
    subject: null,
    preview: message.text?.slice(0, 240) ?? null,
    body: message.text ?? "",
    participants: buildParticipants(message),
    attachments: buildAttachments(message),
    metadata: baseMetadata,
    rawPayloadRef: {
      storagePath: `slack/${channelId}/${message.ts}.json`
    }
  };
}

function buildParticipants(
  message: SlackTransformInput["message"]
): ActivityRecord["participants"] {
  const participants: ActivityRecord["participants"] = [];
  if (!message) return participants;

  if ("user" in message && message.user) {
    participants.push({
      id: message.user,
      handle: message.user,
      role: "sender"
    });
  }

  if (message.text) {
    const mentionMatches = message.text.match(/<@([A-Z0-9]+)>/g) ?? [];
    for (const mention of mentionMatches) {
      const id = mention.replace(/[<@>]/g, "");
      participants.push({
        id,
        handle: id,
        role: "mentioned"
      });
    }
  }

  return participants;
}

function buildAttachments(
  message: SlackTransformInput["message"]
): ActivityRecord["attachments"] {
  if (!message || !("files" in message) || !message.files) return [];

  return message.files?.map((file) => ({
    id: file.id ?? randomUUID(),
    name: file.name ?? "attachment",
    contentType: file.mimetype ?? undefined,
    sizeBytes: file.size ?? undefined,
    downloadUrl: file.url_private ?? undefined
  })) ?? [];
}

function extractTopics(text: string): string[] {
  const channelTags = (text.match(/#[\p{L}0-9_-]+/gu) ?? []).map((tag) => tag.slice(1));
  const keywords = channelTags.slice(0, 3);
  return [...new Set(keywords)];
}

function buildPermalink(channelId: string, ts: string): string | null {
  if (!ts) return null;
  const normalizedTs = ts.replace(".", "");
  return `https://slack.com/app_redirect?channel=${channelId}&message=${normalizedTs}`;
}

function toISOString(ts?: string): string {
  if (!ts) return new Date().toISOString();
  const milliseconds = parseFloat(ts) * 1000;
  return new Date(milliseconds).toISOString();
}

