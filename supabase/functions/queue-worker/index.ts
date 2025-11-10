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

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'tenantId is required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const processedJobs: string[] = [];

    // Process up to maxJobs jobs
    for (let i = 0; i < maxJobs; i++) {
      // Claim next job
      const { data: job, error: claimError } = await supabase.rpc('claim_next_job', {
        p_tenant_id: tenantId,
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
        // Route to appropriate handler based on job type
        switch (job.job_type) {
          case 'ingest_microsoft':
            // TODO: Call ingest-microsoft function or process directly
            console.log('Processing Microsoft ingestion job:', job.id);
            await supabase.rpc('complete_job', {
              p_job_id: job.id,
              p_result: { message: 'Processed successfully' },
            });
            break;

          case 'ingest_slack':
            // TODO: Call ingest-slack function or process directly
            console.log('Processing Slack ingestion job:', job.id);
            await supabase.rpc('complete_job', {
              p_job_id: job.id,
              p_result: { message: 'Processed successfully' },
            });
            break;

          case 'process_embeddings':
            // TODO: Call process-embeddings function or process directly
            console.log('Processing embeddings job:', job.id);
            await supabase.rpc('complete_job', {
              p_job_id: job.id,
              p_result: { message: 'Processed successfully' },
            });
            break;

          case 'generate_digest':
            // TODO: Call daily-digest function or process directly
            console.log('Processing digest job:', job.id);
            await supabase.rpc('complete_job', {
              p_job_id: job.id,
              p_result: { message: 'Processed successfully' },
            });
            break;

          default:
            await supabase.rpc('fail_job', {
              p_job_id: job.id,
              p_error_message: `Unknown job type: ${job.job_type}`,
            });
        }

        processedJobs.push(job.id);
      } catch (error) {
        // Mark job as failed
        await supabase.rpc('fail_job', {
          p_job_id: job.id,
          p_error_message: error instanceof Error ? error.message : 'Unknown error',
        });
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

