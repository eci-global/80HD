-- Migration: Add Row-Level Security (RLS) policies for all tables
-- Description: Enables RLS and creates policies to ensure tenant isolation and data security
-- Verification: Run this migration twice and verify state is identical
-- 
-- Verification queries (run these after migration to confirm idempotency):
-- SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('tenants', 'contacts', 'conversations', 'activities', 'activity_chunks', 'escalations', 'daily_digests', 'action_items');

-- Enable RLS on all tables (idempotent - no error if already enabled)
ALTER TABLE IF EXISTS tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS activity_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS daily_digests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS action_items ENABLE ROW LEVEL SECURITY;

-- Tenants table policies
-- Users can only see their own tenant record
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'tenants' AND policyname = 'tenants_select_own'
  ) THEN
    CREATE POLICY tenants_select_own ON tenants
      FOR SELECT
      USING (id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'tenants' AND policyname = 'tenants_update_own'
  ) THEN
    CREATE POLICY tenants_update_own ON tenants
      FOR UPDATE
      USING (id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- Contacts table policies
-- Users can only see contacts associated with their tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'contacts' AND policyname = 'contacts_select_tenant'
  ) THEN
    CREATE POLICY contacts_select_tenant ON contacts
      FOR SELECT
      USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

    CREATE POLICY contacts_insert_tenant ON contacts
      FOR INSERT
      WITH CHECK (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

    CREATE POLICY contacts_update_tenant ON contacts
      FOR UPDATE
      USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

    CREATE POLICY contacts_delete_tenant ON contacts
      FOR DELETE
      USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- Conversations table policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'conversations' AND policyname = 'conversations_select_tenant'
  ) THEN
    CREATE POLICY conversations_select_tenant ON conversations
      FOR SELECT
      USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

    CREATE POLICY conversations_insert_tenant ON conversations
      FOR INSERT
      WITH CHECK (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

    CREATE POLICY conversations_update_tenant ON conversations
      FOR UPDATE
      USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

    CREATE POLICY conversations_delete_tenant ON conversations
      FOR DELETE
      USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- Activities table policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'activities' AND policyname = 'activities_select_tenant'
  ) THEN
    CREATE POLICY activities_select_tenant ON activities
      FOR SELECT
      USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

    CREATE POLICY activities_insert_tenant ON activities
      FOR INSERT
      WITH CHECK (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

    CREATE POLICY activities_update_tenant ON activities
      FOR UPDATE
      USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

    CREATE POLICY activities_delete_tenant ON activities
      FOR DELETE
      USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- Activity chunks table policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'activity_chunks' AND policyname = 'activity_chunks_select_tenant'
  ) THEN
    CREATE POLICY activity_chunks_select_tenant ON activity_chunks
      FOR SELECT
      USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

    CREATE POLICY activity_chunks_insert_tenant ON activity_chunks
      FOR INSERT
      WITH CHECK (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

    CREATE POLICY activity_chunks_update_tenant ON activity_chunks
      FOR UPDATE
      USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

    CREATE POLICY activity_chunks_delete_tenant ON activity_chunks
      FOR DELETE
      USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- Escalations table policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'escalations' AND policyname = 'escalations_select_tenant'
  ) THEN
    CREATE POLICY escalations_select_tenant ON escalations
      FOR SELECT
      USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

    CREATE POLICY escalations_insert_tenant ON escalations
      FOR INSERT
      WITH CHECK (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

    CREATE POLICY escalations_update_tenant ON escalations
      FOR UPDATE
      USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

    CREATE POLICY escalations_delete_tenant ON escalations
      FOR DELETE
      USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- Daily digests table policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'daily_digests' AND policyname = 'daily_digests_select_tenant'
  ) THEN
    CREATE POLICY daily_digests_select_tenant ON daily_digests
      FOR SELECT
      USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

    CREATE POLICY daily_digests_insert_tenant ON daily_digests
      FOR INSERT
      WITH CHECK (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

    CREATE POLICY daily_digests_update_tenant ON daily_digests
      FOR UPDATE
      USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

    CREATE POLICY daily_digests_delete_tenant ON daily_digests
      FOR DELETE
      USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- Action items table policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'action_items' AND policyname = 'action_items_select_tenant'
  ) THEN
    CREATE POLICY action_items_select_tenant ON action_items
      FOR SELECT
      USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

    CREATE POLICY action_items_insert_tenant ON action_items
      FOR INSERT
      WITH CHECK (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

    CREATE POLICY action_items_update_tenant ON action_items
      FOR UPDATE
      USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

    CREATE POLICY action_items_delete_tenant ON action_items
      FOR DELETE
      USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
  END IF;
END $$;

