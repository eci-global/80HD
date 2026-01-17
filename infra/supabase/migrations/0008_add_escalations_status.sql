-- Migration: Add status field to escalations table
-- Description: Adds status field to track escalation state (pending, acknowledged, dismissed)
-- Verification: Run this migration twice and verify state is identical
--
-- Verification queries (run these after migration to confirm idempotency):
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'escalations' AND column_name = 'status';

-- Add status column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'escalations' AND column_name = 'status'
  ) THEN
    ALTER TABLE escalations ADD COLUMN status text NOT NULL DEFAULT 'pending';
    
    -- Add check constraint for valid status values
    ALTER TABLE escalations ADD CONSTRAINT escalations_status_check 
      CHECK (status IN ('pending', 'acknowledged', 'dismissed'));
    
    -- Create index for status queries
    CREATE INDEX IF NOT EXISTS idx_escalations_status 
      ON escalations (tenant_id, status, dispatched_at DESC);
  END IF;
END $$;







