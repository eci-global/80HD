-- Migration: Add thread_id and channel_id to activities table
-- Description: Adds thread_id and channel_id columns for Slack and Teams thread/channel tracking
-- Verification: Run this migration twice and verify state is identical
--
-- Verification queries (run these after migration to confirm idempotency):
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'activities' AND column_name IN ('thread_id', 'channel_id');

-- Add thread_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'activities' AND column_name = 'thread_id'
  ) THEN
    ALTER TABLE activities ADD COLUMN thread_id text;
  END IF;
END $$;

-- Add channel_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'activities' AND column_name = 'channel_id'
  ) THEN
    ALTER TABLE activities ADD COLUMN channel_id text;
  END IF;
END $$;

-- Create index for channel_id queries
CREATE INDEX IF NOT EXISTS idx_activities_channel_id 
ON activities (tenant_id, channel_id, occurred_at DESC);







