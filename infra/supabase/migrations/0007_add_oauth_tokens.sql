-- Migration: Add OAuth token storage table
-- Description: Stores OAuth access and refresh tokens for Microsoft 365 and Slack integrations
-- Verification: Run this migration twice and verify state is identical
--
-- Verification queries (run these after migration to confirm idempotency):
-- SELECT * FROM information_schema.tables WHERE table_name = 'oauth_tokens';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'oauth_tokens';

-- OAuth tokens table for storing access and refresh tokens
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider text NOT NULL, -- 'microsoft' or 'slack'
  access_token text NOT NULL, -- Encrypted in application layer or use Supabase Vault
  refresh_token text, -- Encrypted in application layer or use Supabase Vault
  expires_at timestamptz NOT NULL,
  scope text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider)
);

-- Indexes for efficient token lookups
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_tenant_provider 
ON oauth_tokens (tenant_id, provider);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires_at 
ON oauth_tokens (expires_at)
WHERE expires_at < now() + INTERVAL '1 hour'; -- For finding tokens expiring soon

-- Enable RLS on oauth_tokens
ALTER TABLE IF EXISTS oauth_tokens ENABLE ROW LEVEL SECURITY;

-- RLS policies for oauth_tokens
DO $$
BEGIN
  -- Users can only see tokens for their tenant
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'oauth_tokens' AND policyname = 'oauth_tokens_select_tenant'
  ) THEN
    CREATE POLICY oauth_tokens_select_tenant ON oauth_tokens
      FOR SELECT
      USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
  END IF;

  -- Service role can insert/update/delete tokens (for backend operations)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'oauth_tokens' AND policyname = 'oauth_tokens_service_role_all'
  ) THEN
    CREATE POLICY oauth_tokens_service_role_all ON oauth_tokens
      FOR ALL
      USING (auth.jwt()->>'role' = 'service_role')
      WITH CHECK (auth.jwt()->>'role' = 'service_role');
  END IF;
END $$;

-- Function to get valid access token (refreshes if expired)
CREATE OR REPLACE FUNCTION get_valid_access_token(
  p_tenant_id uuid,
  p_provider text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token oauth_tokens;
BEGIN
  SELECT * INTO v_token
  FROM oauth_tokens
  WHERE tenant_id = p_tenant_id
    AND provider = p_provider;

  IF v_token IS NULL THEN
    RAISE EXCEPTION 'No OAuth token found for tenant % and provider %', p_tenant_id, p_provider;
  END IF;

  -- Return access token if not expired (or within 5 minute buffer)
  IF v_token.expires_at > now() + INTERVAL '5 minutes' THEN
    RETURN v_token.access_token;
  ELSE
    -- Token expired or expiring soon - caller should refresh
    RAISE EXCEPTION 'OAuth token expired for tenant % and provider %. Refresh required.', p_tenant_id, p_provider;
  END IF;
END;
$$;







