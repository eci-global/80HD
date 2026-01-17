/**
 * Edge Function: Ingest Microsoft 365 data (Outlook, Teams)
 * 
 * This function fetches data from Microsoft 365 using Graph API,
 * normalizes it, and stores it in Supabase.
 * 
 * Trigger: Scheduled via Supabase Cron or manual invocation
 * 
 * Request body (optional):
 * {
 *   "tenantId": "uuid", // If not provided, processes all tenants
 *   "deltaToken": "string" // Optional delta token for incremental sync
 * }
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { getAccessToken } from '../_shared/oauth.ts';
import { getSyncState, saveSyncState } from '../_shared/sync-state.ts';
import { uploadRawPayload } from '../_shared/storage.ts';

interface MicrosoftMessage {
  id: string;
  subject?: string;
  body?: { content: string; contentType: string };
  receivedDateTime: string;
  from?: { emailAddress: { name?: string; address: string } };
  toRecipients?: Array<{ emailAddress: { name?: string; address: string } }>;
  importance?: string;
  isRead?: boolean;
}

interface MicrosoftGraphResponse {
  value: MicrosoftMessage[];
  '@odata.deltaLink'?: string;
  '@odata.nextLink'?: string;
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
    const { tenantId, deltaToken: requestDeltaToken } = body;

    // Get tenant IDs to process
    let tenantIds: string[] = [];
    if (tenantId) {
      tenantIds = [tenantId];
    } else {
      // Process all tenants with Microsoft OAuth tokens
      const { data: tokens } = await supabase
        .from('oauth_tokens')
        .select('tenant_id')
        .eq('provider', 'microsoft');
      tenantIds = [...new Set(tokens?.map((t) => t.tenant_id) || [])];
    }

    if (tenantIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No tenants with Microsoft OAuth tokens found' }),
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
        const accessToken = await getAccessToken(supabase, tid, 'microsoft');

        // Get sync state
        const syncState = await getSyncState(supabase, tid, 'microsoft-mail');
        const deltaToken = requestDeltaToken || syncState?.delta_token;

        // Fetch mail messages from Microsoft Graph
        const graphUrl = deltaToken
          ? `https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages/delta?$deltatoken=${encodeURIComponent(deltaToken)}`
          : 'https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages/delta?$top=50&$orderby=receivedDateTime DESC';

        const graphResponse = await fetch(graphUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!graphResponse.ok) {
          const errorText = await graphResponse.text();
          throw new Error(`Microsoft Graph API error: ${graphResponse.status} ${errorText}`);
        }

        const graphData: MicrosoftGraphResponse = await graphResponse.json();
        const messages = graphData.value || [];

        // Normalize and store activities
        let storedCount = 0;
        for (const message of messages) {
          if (!message.body?.content) continue;

          const activityHash = `microsoft-mail-${message.id}`;
          const occurredAt = new Date(message.receivedDateTime).toISOString();

          // Check if activity already exists
          const { data: existing } = await supabase
            .from('activities')
            .select('id')
            .eq('tenant_id', tid)
            .eq('activity_hash', activityHash)
            .single();

          if (existing) continue; // Skip duplicates

          // Insert activity
          const { error: insertError } = await supabase.from('activities').insert({
            tenant_id: tid,
            activity_hash: activityHash,
            source: 'microsoft-mail',
            source_message_id: message.id,
            occurred_at: occurredAt,
            received_at: new Date().toISOString(),
            subject: message.subject || null,
            preview: message.body.content.substring(0, 240) || null,
            body: message.body.content,
            metadata: {
              urgency: message.importance === 'high' ? 0.7 : 0.3,
              sentiment: null,
              topics: [],
              project: null,
              requiresResponse: !message.isRead,
              dueAt: null,
            },
            participants: JSON.stringify([
              {
                id: message.from?.emailAddress.address || 'unknown',
                email: message.from?.emailAddress.address,
                display_name: message.from?.emailAddress.name,
                role: 'sender',
              },
              ...(message.toRecipients || []).map((r) => ({
                id: r.emailAddress.address,
                email: r.emailAddress.address,
                display_name: r.emailAddress.name,
                role: 'recipient',
              })),
            ]),
            attachments: JSON.stringify([]),
            raw_payload_ref: `microsoft-mail/${tid}/${message.id}.json`,
          });

          if (insertError) {
            console.error(`Failed to insert activity for tenant ${tid}:`, insertError);
            continue;
          }

          // Upload raw payload to storage
          const storagePath = await uploadRawPayload(
            supabase,
            tid,
            'microsoft-mail',
            message.id,
            message
          );

          // Update activity with storage path if different
          if (storagePath !== `microsoft-mail/${tid}/${message.id}.json`) {
            await supabase
              .from('activities')
              .update({ raw_payload_ref: storagePath })
              .eq('tenant_id', tid)
              .eq('activity_hash', activityHash);
          }

          storedCount++;

          // Create chunks for embedding (simplified - just one chunk per message)
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
              content: message.body.content,
              token_count: Math.ceil(message.body.content.length / 4), // Rough estimate
              status: 'pending',
            });
          }
        }

        // Save new delta token
        if (graphData['@odata.deltaLink']) {
          const deltaLink = new URL(graphData['@odata.deltaLink']);
          const newDeltaToken = deltaLink.searchParams.get('$deltatoken');
          if (newDeltaToken) {
            await saveSyncState(supabase, tid, 'microsoft-mail', {
              delta_token: newDeltaToken,
            });
          }
        }

        // Enqueue prioritize-activities job if activities were stored
        if (storedCount > 0) {
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
          stored: storedCount,
          deltaToken: graphData['@odata.deltaLink'] ? 'updated' : 'none',
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
        message: 'Microsoft 365 ingestion completed',
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in ingest-microsoft:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
