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
import { openai } from '@ai-sdk/openai';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch pending chunks
    const { data: chunks, error: fetchError } = await supabase
      .from('activity_chunks')
      .select('id, content')
      .eq('status', 'pending')
      .limit(10);

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

    // Generate embeddings using Vercel AI SDK
    const texts = chunks.map((chunk) => chunk.content);
    const { embeddings } = await embed({
      model: openai.embedding('text-embedding-3-large'),
      value: texts,
    });

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

