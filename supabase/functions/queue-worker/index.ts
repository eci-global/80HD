/**
 * Edge Function: Queue Worker
 * 
 * Processes jobs from the queue_jobs table.
 * Can be triggered manually or scheduled via Supabase Cron.
 * 
 * Trigger: Scheduled via Supabase Cron (runs every minute) or manual invocation
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { tenantId, jobType, maxJobs } = await req.json().catch(() => ({
      tenantId: null,
      jobType: null,
      maxJobs: 10,
    }));

    // If no tenantId provided, process jobs for all tenants
    let tenantIds: string[] = [];
    if (tenantId) {
      tenantIds = [tenantId];
    } else {
      // Get all tenants with pending jobs
      const { data: jobs } = await supabase
        .from('queue_jobs')
        .select('tenant_id')
        .eq('status', 'pending')
        .limit(100);
      tenantIds = [...new Set(jobs?.map((j) => j.tenant_id) || [])];
    }

    if (tenantIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No pending jobs found' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const processedJobs: string[] = [];
    let totalProcessed = 0;

    // Process jobs for each tenant
    for (const tid of tenantIds) {
      if (totalProcessed >= maxJobs) break;

      // Process up to maxJobs jobs for this tenant
      for (let i = 0; i < maxJobs; i++) {
        if (totalProcessed >= maxJobs) break;

        // Claim next job
        const { data: job, error: claimError } = await supabase.rpc('claim_next_job', {
          p_tenant_id: tid,
          p_job_type: jobType ?? null,
        });

      if (claimError) {
        console.error('Error claiming job:', claimError);
        break;
      }

      if (!job) {
        // No more jobs available
        break;
      }

      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || supabaseServiceKey;
        let result: { success: boolean; message?: string; error?: string } = { success: false };

        // Route to appropriate handler based on job type
        switch (job.job_type) {
          case 'ingest_microsoft': {
            console.log('Processing Microsoft ingestion job:', job.id);
            const functionUrl = `${supabaseUrl}/functions/v1/ingest-microsoft`;
            const response = await fetch(functionUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${supabaseAnonKey}`,
              },
              body: JSON.stringify({
                tenantId: job.tenant_id,
                deltaToken: job.payload?.deltaToken,
              }),
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`Ingest Microsoft failed: ${response.status} ${errorText}`);
            }

            result = await response.json();
            break;
          }

          case 'ingest_slack': {
            console.log('Processing Slack ingestion job:', job.id);
            const functionUrl = `${supabaseUrl}/functions/v1/ingest-slack`;
            const response = await fetch(functionUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${supabaseAnonKey}`,
              },
              body: JSON.stringify({
                tenantId: job.tenant_id,
                channelId: job.payload?.channelId,
                cursor: job.payload?.cursor,
              }),
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`Ingest Slack failed: ${response.status} ${errorText}`);
            }

            result = await response.json();
            break;
          }

          case 'process_embeddings': {
            console.log('Processing embeddings job:', job.id);
            const functionUrl = `${supabaseUrl}/functions/v1/process-embeddings`;
            const response = await fetch(functionUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${supabaseAnonKey}`,
              },
              body: JSON.stringify({
                tenantId: job.tenant_id,
              }),
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`Process embeddings failed: ${response.status} ${errorText}`);
            }

            result = await response.json();
            break;
          }

          case 'generate_digest': {
            console.log('Processing digest job:', job.id);
            const functionUrl = `${supabaseUrl}/functions/v1/daily-digest`;
            const response = await fetch(functionUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${supabaseAnonKey}`,
              },
              body: JSON.stringify({
                tenantId: job.tenant_id,
                date: job.payload?.date || new Date().toISOString().split('T')[0],
              }),
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`Generate digest failed: ${response.status} ${errorText}`);
            }

            result = await response.json();
            break;
          }

          case 'prioritize_activities': {
            console.log('Processing prioritize activities job:', job.id);
            const functionUrl = `${supabaseUrl}/functions/v1/prioritize-activities`;
            const response = await fetch(functionUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${supabaseAnonKey}`,
              },
              body: JSON.stringify({
                tenantId: job.tenant_id,
                activityIds: job.payload?.activityIds,
              }),
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`Prioritize activities failed: ${response.status} ${errorText}`);
            }

            result = await response.json();
            break;
          }

          default:
            await supabase.rpc('fail_job', {
              p_job_id: job.id,
              p_error_message: `Unknown job type: ${job.job_type}`,
            });
            continue;
        }

        // Mark job as completed
        if (result.success) {
          await supabase.rpc('complete_job', {
            p_job_id: job.id,
            p_result: result,
          });
          processedJobs.push(job.id);
          totalProcessed++;
        } else {
          throw new Error(result.error || 'Job processing failed');
        }
      } catch (error) {
        // Mark job as failed
        await supabase.rpc('fail_job', {
          p_job_id: job.id,
          p_error_message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${processedJobs.length} jobs`,
        processed: processedJobs.length,
        jobIds: processedJobs,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in queue-worker:', error);
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

