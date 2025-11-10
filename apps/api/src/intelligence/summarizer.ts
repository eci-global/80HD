import type { ActivityRecord } from "@80hd/shared";

export interface LanguageModelProvider {
  complete(prompt: string, options?: { temperature?: number }): Promise<string>;
}

export interface DailySummaryInput {
  date: string;
  highlights: ActivityRecord[];
  decisions: ActivityRecord[];
  followUps: ActivityRecord[];
}

export interface SummaryArtifacts {
  digest: string;
  actionItems: Array<{ activityId: string; summary: string; due?: string | null }>;
  escalations: Array<{ activityId: string; reason: string }>;
}

const SUMMARY_PROMPT = `You are 80HD, an interruption shield assistant.
Summarize the user's communications for the day.
Output three sections: Highlights, Decisions, Follow-ups.
For each item, provide a bullet with sender, topic, and status.
Respond in markdown.`;

export class Summarizer {
  constructor(private readonly model: LanguageModelProvider) {}

  async createDailySummary(input: DailySummaryInput): Promise<SummaryArtifacts> {
    const prompt = this.buildDailyPrompt(input);
    const digest = await this.model.complete(prompt, { temperature: 0.2 });
    const actionItems = deriveActionItems(input.followUps);
    const escalations = deriveEscalations(input.highlights);

    return { digest, actionItems, escalations };
  }

  async explainEscalation(activity: ActivityRecord, reasons: string[]): Promise<string> {
    const prompt = [
      "Explain succinctly why this activity was escalated:",
      `Sender: ${activity.participants.find((p) => p.role === "sender")?.displayName ?? "Unknown"}`,
      `Subject: ${activity.subject ?? activity.preview ?? activity.body.slice(0, 120)}`,
      `Reasons: ${reasons.join("; ")}`
    ].join("\n");

    return this.model.complete(prompt, { temperature: 0.1 });
  }

  private buildDailyPrompt(input: DailySummaryInput): string {
    const lines: string[] = [SUMMARY_PROMPT, `Date: ${input.date}`];

    const sections: Array<[string, ActivityRecord[]]> = [
      ["Highlights", input.highlights],
      ["Decisions", input.decisions],
      ["Follow-ups", input.followUps]
    ];

    for (const [label, activities] of sections) {
      lines.push(`\n${label}:`);
      for (const activity of activities) {
        const sender = activity.participants.find((p) => p.role === "sender");
        lines.push(
          `- Sender: ${sender?.displayName ?? sender?.email ?? "Unknown"} | Subject: ${
            activity.subject ?? activity.preview ?? "(no subject)"
          } | Summary: ${activity.body.slice(0, 180)}`
        );
      }
    }

    return lines.join("\n");
  }
}

function deriveActionItems(followUps: ActivityRecord[]) {
  return followUps.map((activity) => ({
    activityId: activity.id,
    summary: activity.body.slice(0, 160),
    due: activity.metadata.dueAt ?? null
  }));
}

function deriveEscalations(highlights: ActivityRecord[]) {
  return highlights
    .filter((activity) => activity.metadata.urgency > 0.7)
    .map((activity) => ({
      activityId: activity.id,
      reason: activity.metadata.requiresResponse
        ? "Requires response"
        : "High urgency score"
    }));
}


