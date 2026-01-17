-- Supabase Cron Jobs Configuration
-- Description: Scheduled tasks for ingestion, embeddings, digests, and queue processing
-- 
-- To apply these cron jobs, run them in Supabase SQL Editor or via migration
-- Verification: SELECT * FROM cron.job; (after applying)

-- Note: Supabase Cron uses pg_cron extension
-- Ensure pg_cron is enabled: SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- Queue Worker: Process pending jobs every minute
SELECT cron.schedule(
  'queue-worker',
  '* * * * *', -- Every minute
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/queue-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key')
      ),
      body := jsonb_build_object(
        'maxJobs', 10
      )
    ) AS request_id;
  $$
);

-- Microsoft 365 Ingestion: Every 15 minutes
SELECT cron.schedule(
  'ingest-microsoft',
  '*/15 * * * *', -- Every 15 minutes
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/ingest-microsoft',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key')
      ),
      body := jsonb_build_object()
    ) AS request_id;
  $$
);

-- Slack Ingestion: Every 15 minutes
SELECT cron.schedule(
  'ingest-slack',
  '*/15 * * * *', -- Every 15 minutes
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/ingest-slack',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key')
      ),
      body := jsonb_build_object()
    ) AS request_id;
  $$
);

-- Embedding Processing: Every 5 minutes
SELECT cron.schedule(
  'process-embeddings',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/process-embeddings',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key')
      ),
      body := jsonb_build_object()
    ) AS request_id;
  $$
);

-- Daily Digest: Every day at 6 PM (18:00)
SELECT cron.schedule(
  'daily-digest',
  '0 18 * * *', -- Daily at 6 PM
  $$
  -- Generate digest for all tenants
  DO $$
  DECLARE
    tenant_record RECORD;
  BEGIN
    FOR tenant_record IN SELECT id FROM tenants LOOP
      PERFORM
        net.http_post(
          url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-digest',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key')
          ),
          body := jsonb_build_object(
            'tenantId', tenant_record.id,
            'date', CURRENT_DATE::text
          )
        );
    END LOOP;
  END $$;
  $$
);

-- Note: The above cron jobs use net.http_post which requires the http extension
-- 
-- SETUP INSTRUCTIONS:
-- 
-- 1. Enable pg_cron extension:
--    CREATE EXTENSION IF NOT EXISTS pg_cron;
--
-- 2. Enable http extension (if using net.http_post):
--    CREATE EXTENSION IF NOT EXISTS http;
--    -- OR use pg_net extension (preferred for Supabase):
--    CREATE EXTENSION IF NOT EXISTS pg_net;
--
-- 3. Set database settings for Supabase URL and service role key:
--    ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project.supabase.co';
--    ALTER DATABASE postgres SET app.settings.supabase_service_role_key = 'your-service-role-key';
--
-- 4. Verify cron jobs are scheduled:
--    SELECT * FROM cron.job;
--
-- ALTERNATIVE APPROACH (Recommended for Supabase):
-- Use Supabase Dashboard > Database > Cron Jobs UI to configure scheduled tasks.
-- This avoids the need for http/pg_net extensions and database settings.
--
-- ERROR HANDLING:
-- If cron jobs fail, check:
-- 1. pg_cron extension enabled: SELECT * FROM pg_extension WHERE extname = 'pg_cron';
-- 2. Database settings configured: SHOW app.settings.supabase_url;
-- 3. Edge Functions deployed and accessible
-- 4. Service role key valid and has permissions
--
-- Common errors:
-- - "function net.http_post does not exist": Enable http or pg_net extension
-- - "setting app.settings.supabase_url does not exist": Set database settings
-- - "401 Unauthorized": Check service role key is correct
-- - "404 Not Found": Verify Edge Function URLs are correct

