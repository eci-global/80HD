/**
 * Activity prioritization logic for Edge Functions
 * 
 * This module contains the prioritization logic adapted from apps/api/src/intelligence/prioritization.ts
 * for use in Deno Edge Functions.
 */

export interface PrioritySignal {
  score: number;
  label: "ignore" | "normal" | "important" | "critical";
  reasons: string[];
  recommendedChannel: "digest" | "focus-pager" | "sms";
}

export interface PrioritizationConfig {
  urgentThreshold?: number;
  criticalThreshold?: number;
  quietHours?: { start: string; end: string };
  mentionWeight?: number;
}

interface ActivityMetadata {
  urgency?: number;
  requiresResponse?: boolean;
  rawImportanceLabel?: string;
  dueAt?: string;
}

interface ActivityParticipant {
  role: string;
  importanceScore?: number;
}

interface ActivityRecord {
  metadata: ActivityMetadata;
  participants: ActivityParticipant[];
  receivedAt: string;
}

const DEFAULT_CONFIG: Required<PrioritizationConfig> = {
  urgentThreshold: 0.55,
  criticalThreshold: 0.8,
  quietHours: { start: "22:00", end: "07:00" },
  mentionWeight: 0.15
};

export function rankActivity(
  activity: ActivityRecord,
  config: PrioritizationConfig = {}
): PrioritySignal {
  const opts = { ...DEFAULT_CONFIG, ...config };
  const reasons: string[] = [];

  const metadataScore = scoreFromMetadata(activity.metadata, reasons);
  const senderScore = scoreFromParticipants(activity, reasons);
  const mentionScore = activity.participants.some((p) => p.role === "mentioned")
    ? opts.mentionWeight
    : 0;
  const timeScore = timeDecay(activity, reasons);

  let score = metadataScore + senderScore + mentionScore + timeScore;
  score = clamp(score, 0, 1);

  const label = score >= opts.criticalThreshold
    ? "critical"
    : score >= opts.urgentThreshold
      ? "important"
      : "normal";

  if (label === "normal" && score < 0.25) {
    reasons.push("Confidence low — candidate for digest only.");
    return { score, label: "ignore", reasons, recommendedChannel: "digest" };
  }

  let recommendedChannel: PrioritySignal["recommendedChannel"];
  if (label === "critical") {
    recommendedChannel = "sms";
  } else if (label === "important") {
    recommendedChannel = isQuietHours(opts) ? "digest" : "focus-pager";
    if (recommendedChannel === "digest") {
      reasons.push("Within quiet hours — defer to digest unless escalated.");
    }
  } else {
    recommendedChannel = "digest";
  }

  return { score, label, reasons, recommendedChannel };
}

function scoreFromMetadata(metadata: ActivityMetadata, reasons: string[]): number {
  let score = metadata.urgency ?? 0;

  if (metadata.requiresResponse) {
    score += 0.2;
    reasons.push("Sender requested response.");
  }

  if (metadata.rawImportanceLabel === "high") {
    score += 0.15;
    reasons.push("Marked as high importance.");
  }

  if (metadata.dueAt) {
    const dueDate = Date.parse(metadata.dueAt);
    if (!Number.isNaN(dueDate)) {
      const hoursUntilDue = (dueDate - Date.now()) / (1000 * 60 * 60);
      if (hoursUntilDue < 1) {
        score += 0.25;
        reasons.push("Due within the next hour.");
      } else if (hoursUntilDue < 6) {
        score += 0.15;
        reasons.push("Due later today.");
      }
    }
  }

  return score;
}

function scoreFromParticipants(
  activity: ActivityRecord,
  reasons: string[]
): number {
  const sender = activity.participants.find((p) => p.role === "sender");
  if (!sender) return 0;

  if (sender.importanceScore) {
    reasons.push(`Sender importance weight ${sender.importanceScore.toFixed(2)}.`);
    return sender.importanceScore * 0.4;
  }

  return 0.1;
}

function timeDecay(activity: ActivityRecord, reasons: string[]): number {
  const receivedTs = Date.parse(activity.receivedAt);
  if (Number.isNaN(receivedTs)) return 0;
  const hoursElapsed = (Date.now() - receivedTs) / (1000 * 60 * 60);
  if (hoursElapsed > 12) {
    reasons.push("Message older than 12 hours, decaying priority.");
    return -0.1;
  }
  return 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isQuietHours(config: Required<PrioritizationConfig>): boolean {
  const [startHour, startMinute] = config.quietHours.start.split(":").map(Number);
  const [endHour, endMinute] = config.quietHours.end.split(":").map(Number);
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  // Quiet period wraps midnight
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}







