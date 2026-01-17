/**
 * Edge Function: Ingest Slack data
 * 
 * This function fetches data from Slack using Web API,
 * normalizes it, and stores it in Supabase.
 * 
 * Trigger: Scheduled via Supabase Cron or manual invocation
 * 
 * Request body (optional):
 * {
 *   "tenantId": "uuid", // If not provided, processes all tenants
 *   "channelId": "string", // Optional specific channel
 *   "cursor": "string" // Optional cursor for pagination
 * }
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { getAccessToken } from '../_shared/oauth.ts';
import { getSyncState, saveSyncState } from '../_shared/sync-state.ts';
import { uploadRawPayload } from '../_shared/storage.ts';

interface SlackMessage {
  ts?: string;
  text?: string;
  user?: string;
  subtype?: string;
  files?: Array<{ id?: string; name?: string; mimetype?: string; size?: number; url_private?: string }>;
}

interface SlackConversationsHistoryResponse {
  ok: boolean;
  messages?: SlackMessage[];
  response_metadata?: { next_cursor?: string };
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { tenantId, channelId, cursor: requestCursor } = body;

    // Get tenant IDs to process
    let tenantIds: string[] = [];
    if (tenantId) {
      tenantIds = [tenantId];
    } else {
      // Process all tenants with Slack OAuth tokens
      const { data: tokens } = await supabase
        .from('oauth_tokens')
        .select('tenant_id')
        .eq('provider', 'slack');
      tenantIds = [...new Set(tokens?.map((t) => t.tenant_id) || [])];
    }

    if (tenantIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No tenants with Slack OAuth tokens found' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const results = [];

    for (const tid of tenantIds) {
      try {
        // Get access token (will throw error if token missing or refresh fails)
        const accessToken = await getAccessToken(supabase, tid, 'slack');

        // Get sync state
        const syncState = await getSyncState(supabase, tid, 'slack');
        const cursor = requestCursor || syncState?.cursor;

        // If channelId provided, sync that channel; otherwise sync all channels
        const channelsToSync = channelId ? [channelId] : await getAllChannels(accessToken);

        let totalStored = 0;
        let nextCursor: string | undefined;

        for (const channel of channelsToSync) {
          // Fetch messages from Slack API
          const slackUrl = `https://slack.com/api/conversations.history?channel=${encodeURIComponent(channel)}&limit=200${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;

          const slackResponse = await fetch(slackUrl, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          });

          if (!slackResponse.ok) {
            throw new Error(`Slack API error: ${slackResponse.status}`);
          }

          const slackData: SlackConversationsHistoryResponse = await slackResponse.json();

          if (!slackData.ok) {
            throw new Error(`Slack API error: ${slackData.error || 'Unknown error'}`);
          }

          const messages = slackData.messages || [];
          nextCursor = slackData.response_metadata?.next_cursor;

          // Normalize and store activities
          for (const message of messages) {
            if (!message.ts || !message.text) continue;

            const activityHash = `slack-${channel}-${message.ts}`;
            const occurredAt = new Date(parseFloat(message.ts) * 1000).toISOString();

            // Check if activity already exists
            const { data: existing } = await supabase
              .from('activities')
              .select('id')
              .eq('tenant_id', tid)
              .eq('activity_hash', activityHash)
              .single();

            if (existing) continue; // Skip duplicates

            // Extract mentions
            const mentions = (message.text.match(/<@([A-Z0-9]+)>/g) || []).map((m) =>
              m.replace(/[<@>]/g, '')
            );

            // Insert activity
            const { error: insertError } = await supabase.from('activities').insert({
              tenant_id: tid,
              activity_hash: activityHash,
              source: 'slack',
              source_message_id: message.ts,
              thread_id: null,
              channel_id: channel,
              occurred_at: occurredAt,
              received_at: occurredAt,
              subject: null,
              preview: message.text.substring(0, 240) || null,
              body: message.text,
              metadata: {
                urgency: message.subtype === 'reminder_add' ? 0.6 : mentions.length > 0 ? 0.5 : 0.2,
                sentiment: null,
                topics: [],
                project: null,
                requiresResponse: mentions.length > 0,
                dueAt: null,
              },
              participants: JSON.stringify([
                {
                  id: message.user || 'unknown',
                  handle: message.user,
                  role: 'sender',
                },
                ...mentions.map((id) => ({
                  id,
                  handle: id,
                  role: 'mentioned',
                })),
              ]),
              attachments: JSON.stringify(
                (message.files || []).map((file) => ({
                  id: file.id || '',
                  name: file.name || 'attachment',
                  contentType: file.mimetype,
                  sizeBytes: file.size,
                  downloadUrl: file.url_private,
                }))
              ),
              raw_payload_ref: `slack/${tid}/${channel}/${message.ts}.json`,
            });

            if (insertError) {
              console.error(`Failed to insert activity for tenant ${tid}:`, insertError);
              continue;
            }

            // Upload raw payload to storage
            const storagePath = await uploadRawPayload(
              supabase,
              tid,
              'slack',
              `${channel}-${message.ts}`,
              message
            );

            // Update activity with storage path if different
            if (storagePath !== `slack/${tid}/${channel}/${message.ts}.json`) {
              await supabase
                .from('activities')
                .update({ raw_payload_ref: storagePath })
                .eq('tenant_id', tid)
                .eq('activity_hash', activityHash);
            }

            totalStored++;

            // Create chunks for embedding
            const { data: activity } = await supabase
              .from('activities')
              .select('id')
              .eq('tenant_id', tid)
              .eq('activity_hash', activityHash)
              .single();

            if (activity) {
              await supabase.from('activity_chunks').insert({
                tenant_id: tid,
                activity_id: activity.id,
                chunk_index: 0,
                content: message.text,
                token_count: Math.ceil(message.text.length / 4), // Rough estimate
                status: 'pending',
              });
            }
          }
        }

        // Save new cursor
        if (nextCursor) {
          await saveSyncState(supabase, tid, 'slack', {
            cursor: nextCursor,
          });
        }

        // Enqueue prioritize-activities job if activities were stored
        if (totalStored > 0) {
          const { error: enqueueError } = await supabase.from('queue_jobs').insert({
            tenant_id: tid,
            job_type: 'prioritize_activities',
            payload: {},
            priority: 5, // Medium priority
            status: 'pending',
            scheduled_at: new Date().toISOString(),
          });

          if (enqueueError) {
            console.error(`Failed to enqueue prioritize-activities job for tenant ${tid}:`, enqueueError);
            // Don't fail the ingestion if enqueue fails - prioritization can run on schedule
          }
        }

        results.push({
          tenantId: tid,
          stored: totalStored,
          cursor: nextCursor ? 'updated' : 'none',
        });
      } catch (error) {
        console.error(`Error processing tenant ${tid}:`, error);
        results.push({
          tenantId: tid,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Slack ingestion completed',
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in ingest-slack:', error);
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

/**
 * Get all channels for a Slack workspace.
 */
async function getAllChannels(botToken: string): Promise<string[]> {
  const url = 'https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=1000';
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${botToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch channels: ${response.status}`);
  }

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error || 'Unknown error'}`);
  }

  return (data.channels || []).map((ch: { id: string }) => ch.id);
}
