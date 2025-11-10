import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActivityRecord } from "@80hd/shared";
import { rankActivity, type PrioritizationConfig } from "../intelligence/prioritization.js";
import { Summarizer } from "../intelligence/summarizer.js";

export interface DigestJobDependencies {
  supabase: SupabaseClient;
  summarizer: Summarizer;
  prioritization?: PrioritizationConfig;
}

export class DailyDigestJob {
  constructor(private readonly deps: DigestJobDependencies) {}

  async run(date: string, tenantId: string): Promise<void> {
    const activities = await this.fetchActivities(date, tenantId);

    const ranked = activities.map((activity) => ({
      activity,
      signal: rankActivity(activity, this.deps.prioritization)
    }));

    const highlights = ranked
      .filter(({ signal }) => signal.label === "critical")
      .map(({ activity }) => activity);
    const decisions = ranked
      .filter(({ activity }) => activity.metadata.topics.includes("decision"))
      .map(({ activity }) => activity);
    const followUps = ranked
      .filter(({ activity }) => activity.metadata.requiresResponse)
      .map(({ activity }) => activity);

    const summary = await this.deps.summarizer.createDailySummary({
      date,
      highlights,
      decisions,
      followUps
    });

    await this.persistDigest(date, tenantId, summary.digest);
    await this.persistActionItems(tenantId, summary.actionItems);
  }

  private async fetchActivities(date: string, tenantId: string): Promise<ActivityRecord[]> {
    const { data, error } = await this.deps.supabase
      .from<ActivityRecord>("activities")
      .select("*")
      .eq("tenant_id", tenantId)
      .gte("occurred_at", `${date}T00:00:00Z`)
      .lt("occurred_at", `${date}T23:59:59Z`);

    if (error) {
      console.error("Failed to load activities for digest", error);
      return [];
    }

    return data ?? [];
  }

  private async persistDigest(date: string, tenantId: string, digest: string) {
    const { error } = await this.deps.supabase
      .from("daily_digests")
      .upsert(
        {
          digest_date: date,
          tenant_id: tenantId,
          markdown: digest
        },
        { onConflict: "tenant_id,digest_date" }
      );

    if (error) {
      console.error("Failed to persist daily digest", error);
    }
  }

  private async persistActionItems(
    tenantId: string,
    actionItems: Array<{ activityId: string; summary: string; due?: string | null }>
  ) {
    if (actionItems.length === 0) return;
    const rows = actionItems.map((item) => ({
      activity_id: item.activityId,
      tenant_id: tenantId,
      summary: item.summary,
      due_at: item.due ?? null
    }));
    const { error } = await this.deps.supabase
      .from("action_items")
      .insert(rows);

    if (error) {
      console.error("Failed to persist action items", error);
    }
  }
}

