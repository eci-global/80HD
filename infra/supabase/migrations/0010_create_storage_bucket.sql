-- Migration: Create storage bucket for raw payloads
-- Description: Creates the raw-payloads bucket in Supabase Storage for storing raw message payloads
-- Verification: Check bucket exists in Supabase Storage dashboard
--
-- Note: Supabase Storage buckets are typically created via the dashboard or API
-- This migration documents the required bucket but may need manual creation
-- Verification: SELECT * FROM storage.buckets WHERE name = 'raw-payloads';

-- Storage bucket creation is typically done via Supabase dashboard or API
-- This migration serves as documentation
-- To create the bucket manually:
-- 1. Go to Supabase Dashboard > Storage
-- 2. Create new bucket named 'raw-payloads'
-- 3. Set it as public or private based on security requirements
-- 4. Configure RLS policies as needed

-- RLS policies for raw-payloads bucket (if bucket is created)
-- These should be configured via Supabase dashboard or API, not SQL
-- Policy: Users can only access files in their tenant's folder
-- Policy: Service role can read/write all files







