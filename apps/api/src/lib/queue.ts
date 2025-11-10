/**
 * Queue system for background job processing.
 * 
 * Uses Supabase tables to implement a durable task queue with:
 * - Priority-based processing
 * - Retry logic with exponential backoff
 * - Tenant isolation
 * - Job status tracking
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type JobType =
  | 'ingest_microsoft'
  | 'ingest_slack'
  | 'process_embeddings'
  | 'generate_digest'
  | 'send_notification';

export interface QueueJob {
  id: string;
  tenant_id: string;
  job_type: JobType;
  payload: Record<string, unknown>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: number;
  attempts: number;
  max_attempts: number;
  error_message: string | null;
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QueueJobInput {
  tenant_id: string;
  job_type: JobType;
  payload?: Record<string, unknown>;
  priority?: number;
  scheduled_at?: string;
  max_attempts?: number;
}

export class Queue {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Enqueue a new job
   */
  async enqueue(job: QueueJobInput): Promise<QueueJob> {
    const { data, error } = await this.supabase
      .from('queue_jobs')
      .insert({
        tenant_id: job.tenant_id,
        job_type: job.job_type,
        payload: job.payload ?? {},
        priority: job.priority ?? 0,
        scheduled_at: job.scheduled_at ?? new Date().toISOString(),
        max_attempts: job.max_attempts ?? 3,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      throw new Error(
        `Failed to enqueue job: ${error.message}. ` +
          'Check that queue_jobs table exists and RLS policies are configured correctly.'
      );
    }

    return data as QueueJob;
  }

  /**
   * Claim the next pending job for processing.
   * Uses the database function to ensure atomic claim operation.
   */
  async claimNext(tenantId: string, jobType?: JobType): Promise<QueueJob | null> {
    const { data, error } = await this.supabase.rpc('claim_next_job', {
      p_tenant_id: tenantId,
      p_job_type: jobType ?? null,
    });

    if (error) {
      throw new Error(
        `Failed to claim next job: ${error.message}. ` +
          'Check that claim_next_job function exists in the database.'
      );
    }

    return (data as QueueJob) ?? null;
  }

  /**
   * Mark a job as completed
   */
  async complete(jobId: string, result?: Record<string, unknown>): Promise<void> {
    const { error } = await this.supabase.rpc('complete_job', {
      p_job_id: jobId,
      p_result: result ?? null,
    });

    if (error) {
      throw new Error(
        `Failed to complete job ${jobId}: ${error.message}. ` +
          'Check that complete_job function exists in the database.'
      );
    }
  }

  /**
   * Mark a job as failed (with retry logic)
   */
  async fail(jobId: string, errorMessage: string): Promise<void> {
    const { error } = await this.supabase.rpc('fail_job', {
      p_job_id: jobId,
      p_error_message: errorMessage,
    });

    if (error) {
      throw new Error(
        `Failed to mark job ${jobId} as failed: ${error.message}. ` +
          'Check that fail_job function exists in the database.'
      );
    }
  }

  /**
   * Get job status
   */
  async getJob(jobId: string): Promise<QueueJob | null> {
    const { data, error } = await this.supabase
      .from('queue_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Job not found
      }
      throw new Error(`Failed to get job ${jobId}: ${error.message}`);
    }

    return data as QueueJob;
  }

  /**
   * Get jobs by status for a tenant
   */
  async getJobsByStatus(
    tenantId: string,
    status: QueueJob['status'],
    limit = 100
  ): Promise<QueueJob[]> {
    const { data, error } = await this.supabase
      .from('queue_jobs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(
        `Failed to get jobs: ${error.message}. ` +
          'Check that queue_jobs table exists and RLS policies are configured correctly.'
      );
    }

    return (data as QueueJob[]) ?? [];
  }
}

