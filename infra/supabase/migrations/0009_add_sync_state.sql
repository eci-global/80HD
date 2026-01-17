-- Migration: Add sync state table for delta tokens and cursors
-- Description: Stores sync state (delta tokens, cursors) for incremental data synchronization
-- Verification: Run this migration twice and verify state is identical
--
-- Verification queries (run these after migration to confirm idempotency):
-- SELECT * FROM information_schema.tables WHERE table_name = 'sync_state';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'sync_state';

-- Sync state table for storing delta tokens and cursors
CREATE TABLE IF NOT EXISTS sync_state (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source text NOT NULL, -- 'microsoft-mail', 'microsoft-teams', 'slack'
  delta_token text, -- Microsoft Graph delta token
  cursor text, -- Slack cursor
  last_sync_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, source)
);

-- Indexes for efficient sync state lookups
CREATE INDEX IF NOT EXISTS idx_sync_state_tenant_source 
ON sync_state (tenant_id, source);

CREATE INDEX IF NOT EXISTS idx_sync_state_last_sync 
ON sync_state (last_sync_at DESC);

-- Enable RLS on sync_state
ALTER TABLE IF EXISTS sync_state ENABLE ROW LEVEL SECURITY;

-- RLS policies for sync_state
DO $$
BEGIN
  -- Users can only see sync state for their tenant
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sync_state' AND policyname = 'sync_state_select_tenant'
  ) THEN
    CREATE POLICY sync_state_select_tenant ON sync_state
      FOR SELECT
      USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
  END IF;

  -- Service role can insert/update/delete sync state (for backend operations)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sync_state' AND policyname = 'sync_state_service_role_all'
  ) THEN
    CREATE POLICY sync_state_service_role_all ON sync_state
      FOR ALL
      USING (auth.jwt()->>'role' = 'service_role')
      WITH CHECK (auth.jwt()->>'role' = 'service_role');
  END IF;
END $$;







