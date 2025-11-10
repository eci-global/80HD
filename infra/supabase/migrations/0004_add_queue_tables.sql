-- Migration: Add queue tables for background job processing
-- Description: Creates a task queue system for processing ingestion jobs, embeddings, and other background tasks
-- Verification: Run this migration twice and verify state is identical
--
-- Verification queries (run these after migration to confirm idempotency):
-- SELECT * FROM information_schema.tables WHERE table_name = 'queue_jobs';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'queue_jobs';

-- Queue jobs table for background task processing
CREATE TABLE IF NOT EXISTS queue_jobs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_type text NOT NULL, -- 'ingest_microsoft', 'ingest_slack', 'process_embeddings', 'generate_digest'
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  priority int NOT NULL DEFAULT 0, -- Higher numbers = higher priority
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 3,
  error_message text,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for efficient queue operations
CREATE INDEX IF NOT EXISTS idx_queue_jobs_status_scheduled 
ON queue_jobs (status, scheduled_at, priority DESC)
WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_queue_jobs_tenant_status 
ON queue_jobs (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_queue_jobs_job_type 
ON queue_jobs (job_type);

CREATE INDEX IF NOT EXISTS idx_queue_jobs_created_at 
ON queue_jobs (created_at DESC);

-- Enable RLS on queue_jobs
ALTER TABLE IF EXISTS queue_jobs ENABLE ROW LEVEL SECURITY;

-- Queue jobs policies
DO $$
BEGIN
  -- Users can only see jobs for their tenant
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'queue_jobs' AND policyname = 'queue_jobs_select_tenant'
  ) THEN
    CREATE POLICY queue_jobs_select_tenant ON queue_jobs
      FOR SELECT
      USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

    -- Service role can insert/update/delete jobs (for background processing)
    CREATE POLICY queue_jobs_service_role_all ON queue_jobs
      FOR ALL
      USING (auth.jwt()->>'role' = 'service_role')
      WITH CHECK (auth.jwt()->>'role' = 'service_role');
  END IF;
END $$;

-- Function to claim the next pending job
CREATE OR REPLACE FUNCTION claim_next_job(
  p_tenant_id uuid,
  p_job_type text DEFAULT NULL
)
RETURNS queue_jobs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job queue_jobs;
BEGIN
  -- Lock and claim the next pending job
  SELECT * INTO v_job
  FROM queue_jobs
  WHERE tenant_id = p_tenant_id
    AND status = 'pending'
    AND scheduled_at <= now()
    AND (p_job_type IS NULL OR job_type = p_job_type)
  ORDER BY priority DESC, scheduled_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- If job found, mark it as processing
  IF v_job IS NOT NULL THEN
    UPDATE queue_jobs
    SET 
      status = 'processing',
      started_at = now(),
      attempts = attempts + 1,
      updated_at = now()
    WHERE id = v_job.id;

    -- Refresh the job record
    SELECT * INTO v_job FROM queue_jobs WHERE id = v_job.id;
  END IF;

  RETURN v_job;
END;
$$;

-- Function to mark a job as completed
CREATE OR REPLACE FUNCTION complete_job(
  p_job_id uuid,
  p_result jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE queue_jobs
  SET 
    status = 'completed',
    completed_at = now(),
    payload = COALESCE(p_result, payload),
    updated_at = now()
  WHERE id = p_job_id;
END;
$$;

-- Function to mark a job as failed
CREATE OR REPLACE FUNCTION fail_job(
  p_job_id uuid,
  p_error_message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_attempts int;
  v_max_attempts int;
BEGIN
  SELECT attempts, max_attempts INTO v_attempts, v_max_attempts
  FROM queue_jobs
  WHERE id = p_job_id;

  IF v_attempts >= v_max_attempts THEN
    -- Max attempts reached, mark as failed permanently
    UPDATE queue_jobs
    SET 
      status = 'failed',
      error_message = p_error_message,
      completed_at = now(),
      updated_at = now()
    WHERE id = p_job_id;
  ELSE
    -- Retry by resetting to pending
    UPDATE queue_jobs
    SET 
      status = 'pending',
      error_message = p_error_message,
      started_at = NULL,
      scheduled_at = now() + (INTERVAL '1 minute' * POWER(2, v_attempts)), -- Exponential backoff
      updated_at = now()
    WHERE id = p_job_id;
  END IF;
END;
$$;

