-- Migration: Add notification subscriptions table for Web Push
-- Description: Stores Web Push subscription endpoints for sending notifications to users
-- Verification: Run this migration twice and verify state is identical
--
-- Verification queries (run these after migration to confirm idempotency):
-- SELECT * FROM information_schema.tables WHERE table_name = 'notification_subscriptions';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'notification_subscriptions';

-- Notification subscriptions table
CREATE TABLE IF NOT EXISTS notification_subscriptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notification_subscriptions_user 
ON notification_subscriptions (user_id);

CREATE INDEX IF NOT EXISTS idx_notification_subscriptions_tenant 
ON notification_subscriptions (tenant_id);

-- Enable RLS
ALTER TABLE IF EXISTS notification_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS policies
DO $$
BEGIN
  -- Users can only see their own subscriptions
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'notification_subscriptions' AND policyname = 'notification_subscriptions_select_own'
  ) THEN
    CREATE POLICY notification_subscriptions_select_own ON notification_subscriptions
      FOR SELECT
      USING (user_id = auth.uid());

    CREATE POLICY notification_subscriptions_insert_own ON notification_subscriptions
      FOR INSERT
      WITH CHECK (user_id = auth.uid());

    CREATE POLICY notification_subscriptions_update_own ON notification_subscriptions
      FOR UPDATE
      USING (user_id = auth.uid());

    CREATE POLICY notification_subscriptions_delete_own ON notification_subscriptions
      FOR DELETE
      USING (user_id = auth.uid());

    -- Service role can access all subscriptions (for sending notifications)
    CREATE POLICY notification_subscriptions_service_role_all ON notification_subscriptions
      FOR ALL
      USING (auth.jwt()->>'role' = 'service_role')
      WITH CHECK (auth.jwt()->>'role' = 'service_role');
  END IF;
END $$;

