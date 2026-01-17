/**
 * Edge Function: Process embeddings for activity chunks
 * 
 * This function processes pending activity chunks, generates embeddings using Vercel AI SDK,
 * and stores them in the database.
 * 
 * Trigger: Scheduled via Supabase Cron or manual invocation
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { embed } from 'ai';
import { corsHeaders } from '../_shared/cors.ts';
import { getEmbeddingModel, getDefaultEmbeddingModel } from '../_shared/model-config.ts';
import { retryWithBackoff, getRetryOptionsFromEnv } from '../_shared/retry.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { tenantId } = body;

    // Fetch pending chunks (optionally filtered by tenant)
    let query = supabase
      .from('activity_chunks')
      .select('id, content, tenant_id')
      .eq('status', 'pending')
      .limit(10);

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data: chunks, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch chunks: ${fetchError.message}`);
    }

    if (!chunks || chunks.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No pending chunks to process' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Generate embeddings using Vercel AI SDK with retry logic
    const texts = chunks.map((chunk) => chunk.content);
    const embeddingModelString = getDefaultEmbeddingModel();
    const embeddingModel = getEmbeddingModel(embeddingModelString);
    const retryOptions = getRetryOptionsFromEnv();

    let embeddings: number[][];
    try {
      const result = await retryWithBackoff(
        () => embed({
          model: embeddingModel,
          value: texts,
        }),
        retryOptions
      );
      embeddings = result.embeddings;
    } catch (embedError) {
      // Mark all chunks as error if embedding generation fails after retries
      const errorMessage = embedError instanceof Error ? embedError.message : String(embedError);
      console.error('Failed to generate embeddings after retries:', errorMessage);
      
      for (const chunk of chunks) {
        await supabase
          .from('activity_chunks')
          .update({
            status: 'error',
            last_error: errorMessage,
            updated_at: new Date().toISOString(),
          })
          .eq('id', chunk.id);
      }

      throw new Error(
        `Failed to generate embeddings: ${errorMessage}. ` +
        `All ${chunks.length} chunks marked as error. Check AI API configuration and rate limits.`
      );
    }

    // Update chunks with embeddings
    for (let i = 0; i < chunks.length; i++) {
      const { error: updateError } = await supabase
        .from('activity_chunks')
        .update({
          embedding: embeddings[i],
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', chunks[i].id);

      if (updateError) {
        console.error(`Failed to update chunk ${chunks[i].id}:`, updateError);
        // Update chunk status to error
        await supabase
          .from('activity_chunks')
          .update({
            status: 'error',
            last_error: updateError.message,
            updated_at: new Date().toISOString(),
          })
          .eq('id', chunks[i].id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${chunks.length} chunks`,
        processed: chunks.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in process-embeddings:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

