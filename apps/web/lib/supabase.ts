/**
 * Client-side Supabase client for browser usage.
 * This client uses the anon key and respects Row-Level Security (RLS) policies.
 *
 * Usage in Client Components:
 * ```tsx
 * 'use client'
 * import { createClient } from '@/lib/supabase'
 * const supabase = createClient()
 * ```
 */

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/**
 * Creates or returns the existing browser Supabase client.
 * Fails fast with clear error messages if environment variables are missing.
 */
export function createClient(): SupabaseClient {
  if (client) {
    return client;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL is not set. ' +
        'Please set this environment variable in your .env.local file. ' +
        'Get your Supabase URL from your project settings at https://supabase.com/dashboard.'
    );
  }

  if (!supabaseAnonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. ' +
        'Please set this environment variable in your .env.local file. ' +
        'Get your Supabase anon key from your project settings at https://supabase.com/dashboard.'
    );
  }

  client = createBrowserClient(supabaseUrl, supabaseAnonKey);
  return client;
}

