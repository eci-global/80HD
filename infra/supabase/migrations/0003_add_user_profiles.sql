-- Migration: Add user_profiles table to link auth.users to tenants
-- Description: Creates a user_profiles table that connects Supabase Auth users to tenant records
-- Verification: Run this migration twice and verify state is identical
--
-- Verification queries (run these after migration to confirm idempotency):
-- SELECT * FROM information_schema.tables WHERE table_name = 'user_profiles';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'user_profiles';

-- User profiles table linking auth.users to tenants
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email text,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

-- Enable RLS on user_profiles
ALTER TABLE IF EXISTS user_profiles ENABLE ROW LEVEL SECURITY;

-- User profiles policies
DO $$
BEGIN
  -- Users can only see their own profile
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_profiles' AND policyname = 'user_profiles_select_own'
  ) THEN
    CREATE POLICY user_profiles_select_own ON user_profiles
      FOR SELECT
      USING (id = auth.uid());
  END IF;

  -- Users can update their own profile
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_profiles' AND policyname = 'user_profiles_update_own'
  ) THEN
    CREATE POLICY user_profiles_update_own ON user_profiles
      FOR UPDATE
      USING (id = auth.uid());
  END IF;

  -- Service role can insert/update profiles (for user creation)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_profiles' AND policyname = 'user_profiles_service_role_all'
  ) THEN
    CREATE POLICY user_profiles_service_role_all ON user_profiles
      FOR ALL
      USING (auth.jwt()->>'role' = 'service_role')
      WITH CHECK (auth.jwt()->>'role' = 'service_role');
  END IF;
END $$;

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_tenant_id uuid;
BEGIN
  -- Get or create a default tenant (for single-user setup)
  -- In production, you may want to create a tenant per user or assign to existing tenant
  SELECT id INTO default_tenant_id FROM tenants LIMIT 1;
  
  -- If no tenant exists, create one
  IF default_tenant_id IS NULL THEN
    INSERT INTO tenants (name, timezone)
    VALUES ('Default Tenant', 'America/Los_Angeles')
    RETURNING id INTO default_tenant_id;
  END IF;

  -- Create user profile
  INSERT INTO public.user_profiles (id, tenant_id, email, display_name)
  VALUES (
    NEW.id,
    default_tenant_id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

