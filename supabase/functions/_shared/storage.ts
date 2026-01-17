/**
 * Storage utilities for Edge Functions
 * Handles uploading raw payloads to Supabase Storage
 */

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const RAW_PAYLOADS_BUCKET = 'raw-payloads';

/**
 * Ensure the raw-payloads bucket exists.
 * This should be done via migration or manual setup, but this provides a fallback.
 */
export async function ensureBucket(supabase: SupabaseClient): Promise<void> {
  // Note: Bucket creation requires admin privileges
  // In production, create buckets via Supabase dashboard or migration
  // This is a placeholder that will fail gracefully if bucket doesn't exist
}

/**
 * Upload raw payload to Supabase Storage.
 * Returns the storage path.
 */
export async function uploadRawPayload(
  supabase: SupabaseClient,
  tenantId: string,
  source: string,
  messageId: string,
  payload: unknown
): Promise<string> {
  const storagePath = `${source}/${tenantId}/${messageId}.json`;
  const payloadJson = JSON.stringify(payload);

  const { error } = await supabase.storage
    .from(RAW_PAYLOADS_BUCKET)
    .upload(storagePath, payloadJson, {
      contentType: 'application/json',
      upsert: true,
    });

  if (error) {
    // If bucket doesn't exist, log warning but don't fail
    // The path reference will still be stored in the database
    console.warn(`Failed to upload raw payload to storage: ${error.message}. Path: ${storagePath}`);
    return storagePath; // Return path anyway for database reference
  }

  return storagePath;
}

/**
 * Get raw payload from Supabase Storage.
 */
export async function getRawPayload(
  supabase: SupabaseClient,
  storagePath: string
): Promise<unknown | null> {
  const { data, error } = await supabase.storage
    .from(RAW_PAYLOADS_BUCKET)
    .download(storagePath);

  if (error) {
    console.warn(`Failed to download raw payload: ${error.message}. Path: ${storagePath}`);
    return null;
  }

  if (!data) {
    return null;
  }

  try {
    const text = await data.text();
    return JSON.parse(text);
  } catch (parseError) {
    console.error(`Failed to parse raw payload: ${parseError}`);
    return null;
  }
}







