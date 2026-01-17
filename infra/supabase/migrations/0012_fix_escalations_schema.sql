-- Migration: Fix escalations table schema to match code expectations
-- Description: Updates escalations table to use priority_score and reason as JSONB array
-- Verification: Run this migration twice and verify state is identical
--
-- Verification queries (run these after migration to confirm idempotency):
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'escalations';

-- Rename priority to priority_score if it exists and priority_score doesn't
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'escalations' AND column_name = 'priority'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'escalations' AND column_name = 'priority_score'
  ) THEN
    ALTER TABLE escalations RENAME COLUMN priority TO priority_score;
  END IF;
END $$;

-- Change reason from text to jsonb array if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'escalations' 
    AND column_name = 'reason' 
    AND data_type = 'text'
  ) THEN
    -- Convert existing text reasons to JSONB arrays
    ALTER TABLE escalations 
      ALTER COLUMN reason TYPE jsonb 
      USING jsonb_build_array(reason);
  END IF;
END $$;

-- Add created_at if missing (for consistency)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'escalations' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE escalations ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;







