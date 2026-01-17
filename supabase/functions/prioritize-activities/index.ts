/**
 * Edge Function: Prioritize Activities and Create Escalations
 * 
 * This function processes activities, runs prioritization logic, and creates escalations
 * for critical/important items. Triggers notifications for focus-pager and sms channels.
 * 
 * Trigger: Queue job type 'prioritize_activities' or manual invocation
 * 
 * Request body (optional):
 * {
 *   "tenantId": "uuid", // If not provided, processes all tenants
 *   "activityIds": ["uuid", ...] // Optional specific activities to prioritize
 * }
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { rankActivity, type PrioritySignal } from '../_shared/prioritization.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { tenantId, activityIds } = body;

    // Determine which tenants to process
    let tenantIds: string[] = [];
    if (tenantId) {
      tenantIds = [tenantId];
    } else {
      // Get all tenants
      const { data: tenants } = await supabase
        .from('tenants')
        .select('id');
      tenantIds = tenants?.map((t) => t.id) || [];
    }

    if (tenantIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No tenants found' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const results = [];
    let totalEscalationsCreated = 0;

    for (const tid of tenantIds) {
      try {
        // Fetch activities that don't have escalations yet
        let activitiesQuery = supabase
          .from('activities')
          .select(`
            id,
            tenant_id,
            source,
            source_message_id,
            occurred_at,
            received_at,
            subject,
            preview,
            body,
            metadata,
            participants
          `)
          .eq('tenant_id', tid);

        // If specific activity IDs provided, filter by them
        if (activityIds && Array.isArray(activityIds) && activityIds.length > 0) {
          activitiesQuery = activitiesQuery.in('id', activityIds);
        } else {
          // Get activities that already have escalations to exclude them
          const { data: existingEscalations } = await supabase
            .from('escalations')
            .select('activity_id')
            .eq('tenant_id', tid)
            .not('activity_id', 'is', null);

          const existingActivityIds = existingEscalations?.map((e) => e.activity_id).filter(Boolean) || [];
          if (existingActivityIds.length > 0) {
            // Exclude activities that already have escalations
            activitiesQuery = activitiesQuery.not('id', 'in', `(${existingActivityIds.join(',')})`);
          }

          // Only process recent activities (last 24 hours) to avoid processing old data
          const oneDayAgo = new Date();
          oneDayAgo.setHours(oneDayAgo.getHours() - 24);
          activitiesQuery = activitiesQuery.gte('received_at', oneDayAgo.toISOString());
        }

        const { data: activities, error: fetchError } = await activitiesQuery.limit(100);

        if (fetchError) {
          throw new Error(`Failed to fetch activities: ${fetchError.message}`);
        }

        if (!activities || activities.length === 0) {
          results.push({
            tenantId: tid,
            processed: 0,
            escalationsCreated: 0,
            message: 'No activities to prioritize',
          });
          continue;
        }

        let escalationsCreated = 0;

        // Process each activity
        for (const activity of activities) {
          try {
            // Convert database record to ActivityRecord format for prioritization
            const activityRecord = {
              metadata: activity.metadata || {},
              participants: activity.participants || [],
              receivedAt: activity.received_at || activity.occurred_at,
            };

            // Run prioritization
            const prioritySignal: PrioritySignal = rankActivity(activityRecord);

            // Only create escalation for critical or important items
            if (prioritySignal.label === 'critical' || prioritySignal.label === 'important') {
              // Map recommendedChannel to delivery_channel
              const deliveryChannel = prioritySignal.recommendedChannel === 'focus-pager'
                ? 'focus-pager'
                : prioritySignal.recommendedChannel === 'sms'
                  ? 'sms'
                  : 'digest';

              // Create escalation record
              const { error: escalationError } = await supabase.from('escalations').insert({
                tenant_id: tid,
                activity_id: activity.id,
                priority_score: prioritySignal.score,
                reason: prioritySignal.reasons, // JSONB array
                delivery_channel: deliveryChannel,
                status: 'pending',
                metadata: {
                  label: prioritySignal.label,
                  recommendedChannel: prioritySignal.recommendedChannel,
                },
              });

              if (escalationError) {
                console.error(`Failed to create escalation for activity ${activity.id}:`, escalationError);
                continue;
              }

              escalationsCreated++;

              // Trigger notification for focus-pager or sms channels
              if (deliveryChannel === 'focus-pager' || deliveryChannel === 'sms') {
                // Get user for this tenant to send notification
                const { data: userProfile } = await supabase
                  .from('user_profiles')
                  .select('id')
                  .eq('tenant_id', tid)
                  .limit(1)
                  .single();

                if (userProfile) {
                  // Call send-notification Edge Function
                  const notificationUrl = `${supabaseUrl}/functions/v1/send-notification`;
                  const notificationResponse = await fetch(notificationUrl, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${supabaseServiceKey}`,
                    },
                    body: JSON.stringify({
                      userId: userProfile.id,
                      title: prioritySignal.label === 'critical' ? '🚨 Critical Alert' : '⚠️ Important Message',
                      body: activity.subject || activity.preview || 'New urgent message requires attention',
                      url: `/focus-pager`,
                      tag: `escalation-${activity.id}`,
                      requireInteraction: true,
                    }),
                  });

                  if (!notificationResponse.ok) {
                    console.error(`Failed to send notification: ${notificationResponse.status}`);
                  }
                }
              }
            }
          } catch (activityError) {
            console.error(`Error processing activity ${activity.id}:`, activityError);
            // Continue with next activity
          }
        }

        totalEscalationsCreated += escalationsCreated;
        results.push({
          tenantId: tid,
          processed: activities.length,
          escalationsCreated,
        });
      } catch (tenantError) {
        console.error(`Error processing tenant ${tid}:`, tenantError);
        results.push({
          tenantId: tid,
          error: tenantError instanceof Error ? tenantError.message : 'Unknown error',
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalEscalationsCreated,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in prioritize-activities:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

