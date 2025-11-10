import { z } from "zod";

export const SourceSystemSchema = z.enum(["microsoft-mail", "microsoft-teams", "slack"]);

export const ParticipantRoleSchema = z.enum(["sender", "recipient", "cc", "bcc", "mentioned"]);

export const ParticipantSchema = z.object({
  id: z.string(),
  displayName: z.string().optional(),
  email: z.string().email().optional(),
  handle: z.string().optional(),
  role: ParticipantRoleSchema,
  importanceScore: z.number().min(0).max(1).optional()
});

export const AttachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  contentType: z.string().optional(),
  sizeBytes: z.number().nonnegative().optional(),
  downloadUrl: z.string().url().optional(),
  hash: z.string().optional()
});

export const ActivityMetadataSchema = z.object({
  urgency: z.number().min(0).max(1).default(0),
  sentiment: z.number().min(-1).max(1).nullable().optional(),
  topics: z.array(z.string()).default([]),
  project: z.string().nullable().optional(),
  requiresResponse: z.boolean().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  messageUrl: z.string().url().nullable().optional(),
  rawImportanceLabel: z.string().nullable().optional()
});

export const ActivityRecordSchema = z.object({
  id: z.string(),
  source: SourceSystemSchema,
  sourceMessageId: z.string(),
  threadId: z.string().nullable(),
  channelId: z.string().nullable(),
  occurredAt: z.string().datetime(),
  receivedAt: z.string().datetime(),
  subject: z.string().nullable(),
  preview: z.string().nullable(),
  body: z.string(),
  participants: z.array(ParticipantSchema),
  attachments: z.array(AttachmentSchema).default([]),
  metadata: ActivityMetadataSchema,
  rawPayloadRef: z.object({
    storagePath: z.string(),
    checksum: z.string().optional()
  })
});

export type SourceSystem = z.infer<typeof SourceSystemSchema>;
export type ParticipantRole = z.infer<typeof ParticipantRoleSchema>;
export type Participant = z.infer<typeof ParticipantSchema>;
export type Attachment = z.infer<typeof AttachmentSchema>;
export type ActivityMetadata = z.infer<typeof ActivityMetadataSchema>;
export type ActivityRecord = z.infer<typeof ActivityRecordSchema>;

