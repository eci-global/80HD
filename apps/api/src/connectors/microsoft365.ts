import { randomUUID } from "node:crypto";
import type { ActivityRecord, ActivityMetadata, ParticipantRole } from "@80hd/shared";
import { Client } from "@microsoft/microsoft-graph-client";
import type {
  Message,
  ChatMessage,
  User
} from "@microsoft/microsoft-graph-types";
import { v5 as uuidv5 } from "uuid";
import { Microsoft365MCPClient } from "../lib/mcp-client.js";

const UUID_NAMESPACE = "8d5dad65-1f0f-4457-8f4e-054b40eecba7";

export interface MicrosoftConnectorConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  userId: string;
  deltaToken?: string;
}

export interface MicrosoftConnectorResult {
  activities: ActivityRecord[];
  deltaToken?: string;
}

export class Microsoft365Connector {
  private readonly graph: Client;
  private readonly mcpClient: Microsoft365MCPClient;

  constructor(graph: Client, mcpClient?: Microsoft365MCPClient) {
    this.graph = graph;
    this.mcpClient = mcpClient ?? new Microsoft365MCPClient();
  }

  static fromConfig(config: MicrosoftConnectorConfig) {
    const client = Client.init({
      authProvider: async (done) => {
        // Placeholder for auth injection; token should be fetched by caller and cached in Supabase Vault.
        done(null, config.clientSecret);
      }
    });
    return new Microsoft365Connector(client);
  }

  /**
   * Check if MCP server is available and preferred for data fetching.
   * Falls back to direct Graph API if MCP is unavailable.
   */
  private async useMCP(): Promise<boolean> {
    return this.mcpClient.isAvailable();
  }

  async syncMail(deltaToken?: string): Promise<MicrosoftConnectorResult> {
    const request = this.graph
      .api("/me/mailFolders/Inbox/messages/delta")
      .top(50)
      .orderby("receivedDateTime DESC");

    if (deltaToken) {
      request.query({ "$deltatoken": deltaToken });
    }

    const response = await request.get();
    const messages: Message[] = response.value ?? [];
    const activities = messages
      .filter((m) => m.body?.content)
      .map((message) => buildMailActivity(message));

    return { activities, deltaToken: response["@odata.deltaLink"] };
  }

  async syncTeamsChats(deltaToken?: string): Promise<MicrosoftConnectorResult> {
    const request = this.graph
      .api("/me/chats/getAllMessages")
      .top(200);

    if (deltaToken) {
      request.query({ "$deltatoken": deltaToken });
    }

    const response = await request.get();
    const messages: ChatMessage[] = response.value ?? [];
    const activities = messages
      .filter((chat) => chat.body?.content)
      .map((chat) => buildTeamsActivity(chat));

    return { activities, deltaToken: response["@odata.deltaLink"] };
  }
}

function buildMailActivity(message: Message): ActivityRecord {
  const id = uuidv5(message.id ?? randomUUID(), UUID_NAMESPACE);
  const participants = buildParticipantsFromMessage(message);
  const metadata: ActivityMetadata = {
    urgency: deriveUrgencyFromMessage(message),
    rawImportanceLabel: message.importance ?? undefined,
    requiresResponse: message.flag?.flagStatus === "flagged",
    dueAt: message.flag?.dueDateTime?.dateTime ?? null,
    messageUrl: message.webLink ?? null,
    sentiment: null,
    topics: [],
    project: null
  };

  return {
    id,
    source: "microsoft-mail",
    sourceMessageId: message.id ?? "",
    threadId: message.conversationId ?? null,
    channelId: null,
    occurredAt: message.sentDateTime ?? new Date().toISOString(),
    receivedAt: message.receivedDateTime ?? new Date().toISOString(),
    subject: message.subject ?? null,
    preview: message.bodyPreview ?? null,
    body: message.body?.content ?? "",
    participants,
    attachments:
      message.attachments?.map((attachment) => ({
        id: attachment.id ?? randomUUID(),
        name: attachment.name ?? "attachment",
        contentType: "contentType" in attachment ? attachment.contentType ?? undefined : undefined,
        sizeBytes: "size" in attachment ? attachment.size ?? undefined : undefined
      })) ?? [],
    metadata,
    rawPayloadRef: {
      storagePath: `graph/mail/${message.id}.json`
    }
  };
}

function buildTeamsActivity(chat: ChatMessage): ActivityRecord {
  const id = uuidv5(chat.id ?? randomUUID(), UUID_NAMESPACE);
  const participants = buildParticipantsFromChat(chat);
  const metadata: ActivityMetadata = {
    urgency: chat.messageType === "systemEventMessage" ? 0 : 0.2,
    rawImportanceLabel: chat.importance ?? undefined,
    requiresResponse: Boolean(chat.mentions?.some((mention) => mention.mentioned?.user?.id === chat.from?.user?.id)),
    dueAt: null,
    messageUrl: chat.webUrl ?? null,
    sentiment: null,
    topics: [],
    project: null
  };

  return {
    id,
    source: "microsoft-teams",
    sourceMessageId: chat.id ?? "",
    threadId: chat.replyToId ?? chat.id ?? null,
    channelId: chat.channelIdentity?.channelId ?? null,
    occurredAt: chat.createdDateTime ?? new Date().toISOString(),
    receivedAt: chat.lastModifiedDateTime ?? chat.createdDateTime ?? new Date().toISOString(),
    subject: null,
    preview: chat.body?.content?.slice(0, 240) ?? null,
    body: chat.body?.content ?? "",
    participants,
    attachments:
      chat.attachments?.map((attachment) => ({
        id: attachment.id ?? randomUUID(),
        name: attachment.name ?? "attachment",
        contentType: attachment.contentType ?? undefined,
        sizeBytes: attachment.content?.length
      })) ?? [],
    metadata,
    rawPayloadRef: {
      storagePath: `graph/teams/${chat.id}.json`
    }
  };
}

function buildParticipantsFromMessage(message: Message): ActivityRecord["participants"] {
  const participants: ActivityRecord["participants"] = [];

  if (message.from?.emailAddress?.address) {
    participants.push({
      id: message.from.emailAddress.address,
      displayName: message.from.emailAddress.name ?? undefined,
      email: message.from.emailAddress.address,
      role: "sender"
    });
  }

  const appendRecipients = (recipients: Message["toRecipients"], role: ParticipantRole) => {
    recipients?.forEach((recipient) => {
      if (!recipient.emailAddress?.address) return;
      participants.push({
        id: recipient.emailAddress.address,
        displayName: recipient.emailAddress.name ?? undefined,
        email: recipient.emailAddress.address,
        role
      });
    });
  };

  appendRecipients(message.toRecipients, "recipient");
  appendRecipients(message.ccRecipients, "cc");
  appendRecipients(message.bccRecipients, "bcc");

  return participants;
}

function buildParticipantsFromChat(chat: ChatMessage): ActivityRecord["participants"] {
  const participants: ActivityRecord["participants"] = [];

  if (chat.from?.user) {
    participants.push(graphUserToParticipant(chat.from.user, "sender"));
  }

  chat.mentions?.forEach((mention) => {
    if (mention.mentioned?.user) {
      participants.push(graphUserToParticipant(mention.mentioned.user, "mentioned"));
    }
  });

  return participants;
}

function graphUserToParticipant(user: User, role: ParticipantRole): ActivityRecord["participants"][number] {
  return {
    id: user.id ?? randomUUID(),
    displayName: user.displayName ?? undefined,
    email: user.mail ?? user.userPrincipalName ?? undefined,
    role
  };
}

function deriveUrgencyFromMessage(message: Message): number {
  if (message.importance === "high") return 0.9;
  if (message.flag?.flagStatus === "flagged") return 0.7;
  return 0.2;
}

