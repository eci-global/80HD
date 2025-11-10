import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedActivity } from "../normalizer/activity-normalizer.js";

export interface ActivityChunk {
  id: string;
  activity_id: string;
  tenant_id: string;
  content: string;
  token_count: number;
  status: "pending" | "processing" | "embedded" | "error";
  last_error: string | null;
}

export interface EmbeddingProvider {
  embedText(input: string[]): Promise<number[][]>;
  dimensions: number;
  model: string;
}

export interface EmbeddingWorkerOptions {
  batchSize?: number;
  maxTokensPerChunk?: number;
}

export interface ActivityChunkInsert {
  activity_id: string;
  tenant_id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  status?: "pending";
}

export class EmbeddingWorker {
  private readonly batchSize: number;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly embeddings: EmbeddingProvider,
    options: EmbeddingWorkerOptions = {}
  ) {
    this.batchSize = options.batchSize ?? 32;
  }

  async runOnce(): Promise<number> {
    const chunks = await this.claimChunks();
    if (chunks.length === 0) return 0;

    const embeddings = await this.embeddings.embedText(
      chunks.map((chunk) => chunk.content)
    );

    await this.persistEmbeddings(chunks, embeddings);
    return chunks.length;
  }

  private async claimChunks(): Promise<ActivityChunk[]> {
    const { data, error } = await this.supabase
      .from<ActivityChunk>("activity_chunks")
      .update({ status: "processing" })
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(this.batchSize)
      .select();

    if (error) {
      console.error("Failed to claim chunks", error);
      return [];
    }

    return data ?? [];
  }

  private async persistEmbeddings(
    chunks: ActivityChunk[],
    vectors: number[][]
  ): Promise<void> {
    const rows = chunks.map((chunk, index) => ({
      id: chunk.id,
      embedding: vectors[index],
      status: "embedded",
      last_error: null
    }));

    const { error } = await this.supabase
      .from("activity_chunks")
      .upsert(rows, { onConflict: "id" });

    if (error) {
      console.error("Failed to persist embeddings", error);
      await this.markFailed(
        chunks.map((chunk) => chunk.id),
        error.message
      );
    }
  }

  async markFailed(chunkIds: string[], reason: string) {
    await this.supabase
      .from("activity_chunks")
      .update({ status: "error", last_error: reason })
      .in("id", chunkIds);
  }
}

export function chunkActivity(
  activity: NormalizedActivity,
  maxTokens = 550
): ActivityChunkInsert[] {
  const sentences = activity.body.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length === 0) return;
    chunks.push(buffer.join(" ").trim());
    buffer = [];
  };

  for (const sentence of sentences) {
    const prospective = [...buffer, sentence].join(" ");
    if (prospective.length / 4 > maxTokens) {
      flush();
      buffer.push(sentence);
    } else {
      buffer.push(sentence);
    }
  }
  flush();

  return chunks.map((content, index) => ({
    activity_id: activity.id,
    tenant_id: activity.tenantId,
    chunk_index: index,
    content,
    token_count: Math.ceil(content.length / 4),
    status: "pending"
  }));
}

