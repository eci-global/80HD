/**
 * Edge Function: Generate daily digest
 * 
 * This function generates a daily summary of activities using Vercel AI SDK,
 * creates action items, and stores the digest in the database.
 * 
 * Trigger: Scheduled via Supabase Cron (daily at end of day)
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { corsHeaders } from '../_shared/cors.ts';

const DigestSchema = z.object({
  summary: z.string(),
  actionItems: z.array(z.string()),
  highlights: z.array(z.string()),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { tenantId, date } = await req.json().catch(() => ({
      tenantId: null,
      date: new Date().toISOString().split('T')[0],
    }));

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'tenantId is required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Fetch activities for the date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { data: activities, error: fetchError } = await supabase
      .from('activities')
      .select('subject, preview, body, occurred_at, metadata')
      .eq('tenant_id', tenantId)
      .gte('occurred_at', startOfDay.toISOString())
      .lte('occurred_at', endOfDay.toISOString())
      .order('occurred_at', { ascending: false });

    if (fetchError) {
      throw new Error(`Failed to fetch activities: ${fetchError.message}`);
    }

    if (!activities || activities.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No activities for this date' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Generate digest using Vercel AI SDK
    const activitiesText = activities
      .map((a) => `[${a.occurred_at}] ${a.subject || 'No subject'}: ${a.preview || a.body.substring(0, 200)}`)
      .join('\n\n');

    const { object: digest } = await generateObject({
      model: openai('gpt-4'),
      schema: DigestSchema,
      prompt: `Generate a daily digest for ${date} based on these activities:\n\n${activitiesText}\n\nProvide a summary, key highlights, and actionable items.`,
    });

    // Store digest
    const { error: insertError } = await supabase.from('daily_digests').insert({
      tenant_id: tenantId,
      date,
      summary: digest.summary,
      highlights: digest.highlights,
    });

    if (insertError) {
      throw new Error(`Failed to store digest: ${insertError.message}`);
    }

    // Store action items
    if (digest.actionItems.length > 0) {
      const actionItemsData = digest.actionItems.map((item) => ({
        tenant_id: tenantId,
        content: item,
        source_date: date,
        status: 'pending',
      }));

      const { error: itemsError } = await supabase
        .from('action_items')
        .insert(actionItemsData);

      if (itemsError) {
        console.error('Failed to store action items:', itemsError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Daily digest generated',
        digest,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in daily-digest:', error);
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

