import { ActivityRecordSchema } from "@80hd/shared";
import type { ActivityRecord } from "@80hd/shared";
import { z } from "zod";

export interface NormalizationContext {
  tenantId: string;
  source: ActivityRecord["source"];
  receivedAt?: string;
}

export const NormalizedActivitySchema = ActivityRecordSchema.extend({
  tenantId: z.string(),
  hash: z.string()
});

export type NormalizedActivity = z.infer<typeof NormalizedActivitySchema>;

export function normalizeActivity(
  activity: ActivityRecord,
  context: NormalizationContext
): NormalizedActivity {
  const parsed = ActivityRecordSchema.safeParse(activity);
  if (!parsed.success) {
    throw new Error(
      `Invalid activity payload: ${parsed.error.issues.map((issue) => issue.message).join(", ")}`
    );
  }

  const hash = computeStableHash(parsed.data);

  return {
    ...parsed.data,
    receivedAt: context.receivedAt ?? parsed.data.receivedAt,
    metadata: {
      ...parsed.data.metadata,
      urgency: clamp(parsed.data.metadata.urgency, 0, 1)
    },
    tenantId: context.tenantId,
    hash
  };
}

function computeStableHash(activity: ActivityRecord): string {
  const stablePayload = JSON.stringify({
    source: activity.source,
    sourceMessageId: activity.sourceMessageId,
    occurredAt: activity.occurredAt,
    participants: activity.participants.map((participant) => participant.id).sort(),
    subject: activity.subject ?? "",
    bodyHash: stringHash(activity.body)
  });

  return stringHash(stablePayload);
}

function stringHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (Math.imul(31, hash) + input.charCodeAt(i)) | 0;
  }
  return `h${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

