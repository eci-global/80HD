/**
 * Chat API endpoint for querying activities using vector search and LLM.
 * 
 * This endpoint:
 * 1. Generates an embedding for the user's query
 * 2. Performs vector similarity search in Supabase
 * 3. Uses Vercel AI SDK to generate a contextual response
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getServerUser } from '@/lib/auth';
import { embed, generateText } from 'ai';
import { z } from 'zod';
import { getEmbeddingModel, getLanguageModel, getDefaultEmbeddingModel, getDefaultLLMModel } from '@/lib/model-config';

const QuerySchema = z.object({
  prompt: z.string().min(1).max(1000),
});

export async function POST(request: Request) {
  try {
    // Validate request body
    const body = await request.json();
    const { prompt } = QuerySchema.parse(body);

    // Get authenticated user
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user's tenant_id
    const supabase = await createServerClient();
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.tenant_id) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    // Generate embedding for the query using Vercel AI SDK
    const embeddingModelString = getDefaultEmbeddingModel();
    const embeddingModel = getEmbeddingModel(embeddingModelString);
    const { embedding: queryEmbedding } = await embed({
      model: embeddingModel,
      value: prompt,
    });

    // Perform vector similarity search in Supabase
    // Using RPC function for vector search (more efficient than client-side)
    const { data: similarChunks, error: searchError } = await supabase.rpc(
      'match_activity_chunks',
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.7,
        match_count: 5,
        p_tenant_id: profile.tenant_id,
      }
    ).catch(async () => {
      // Fallback: Use client-side vector search if RPC doesn't exist
      const { data: chunks } = await supabase
        .from('activity_chunks')
        .select('content, activity_id, embedding')
        .eq('tenant_id', profile.tenant_id)
        .eq('status', 'completed')
        .not('embedding', 'is', null)
        .limit(100);

      if (!chunks) return { data: null, error: null };

      // Calculate cosine similarity manually
      const similarities = chunks
        .map((chunk) => {
          if (!chunk.embedding) return null;
          const similarity = cosineSimilarity(queryEmbedding, chunk.embedding as number[]);
          return { ...chunk, similarity };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5)
        .map(({ similarity, ...rest }) => rest);

      return { data: similarities, error: null };
    });

    if (searchError) {
      console.error('Vector search error:', searchError);
      // Continue with empty results rather than failing
    }

    // Fetch full activity details for context
    const chunkActivityIds = similarChunks?.map((c: { activity_id: string }) => c.activity_id) ?? [];
    const { data: activities } = await supabase
      .from('activities')
      .select('subject, preview, body, occurred_at, source, participants')
      .eq('tenant_id', profile.tenant_id)
      .in('id', chunkActivityIds.length > 0 ? chunkActivityIds : ['00000000-0000-0000-0000-000000000000']);

    // Build context from retrieved activities
    const context = activities
      ?.map((a) => {
        const date = new Date(a.occurred_at).toLocaleDateString();
        const participants = Array.isArray(a.participants)
          ? a.participants.map((p: { display_name?: string; email?: string }) => p.display_name || p.email).join(', ')
          : 'Unknown';
        return `[${date}] ${a.source}: ${a.subject || 'No subject'}\nFrom: ${participants}\n${a.preview || a.body.substring(0, 300)}`;
      })
      .join('\n\n') ?? 'No relevant activities found.';

    // Generate response using Vercel AI SDK
    const llmModelString = getDefaultLLMModel();
    const llmModel = getLanguageModel(llmModelString);
    const { text: answer } = await generateText({
      model: llmModel,
      prompt: `You are 80HD, an AI assistant that helps manage daily interruptions and communications.

Based on the following context from the user's activities, answer their question. If the context doesn't contain relevant information, say so clearly.

User's question: ${prompt}

Relevant activities:
${context}

Provide a clear, concise answer based on the context above.`,
      temperature: 0.7,
      maxTokens: 500,
    });

    return NextResponse.json({ answer });
  } catch (error) {
    console.error('Error in chat API:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}

/**
 * Calculate cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
