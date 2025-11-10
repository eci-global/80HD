/**
 * Supabase client for Edge Functions.
 * This client uses the service role key for backend operations.
 * Edge Functions run in a trusted server context, so service role is appropriate.
 *
 * Usage in Edge Functions:
 * ```ts
 * import { createEdgeClient } from '../lib/supabase.ts'
 * const supabase = createEdgeClient()
 * ```
 */

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/**
 * Creates or returns the existing Supabase client for Edge Functions.
 * Uses service role key for backend operations.
 * Fails fast with clear error messages if environment variables are missing.
 */
export function createEdgeClient(): SupabaseClient {
  if (client) {
    return client;
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl) {
    throw new Error(
      'SUPABASE_URL is not set in Edge Function environment. ' +
        'Please set this environment variable in your Supabase project settings. ' +
        'Go to Project Settings > Edge Functions > Secrets to configure environment variables. ' +
        'Get your Supabase URL from your project settings at https://supabase.com/dashboard.'
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set in Edge Function environment. ' +
        'Please set this environment variable in your Supabase project settings. ' +
        'Go to Project Settings > Edge Functions > Secrets to configure environment variables. ' +
        'Get your service role key from your project settings at https://supabase.com/dashboard. ' +
        'WARNING: This key has elevated privileges and should never be exposed to the client.'
    );
  }

  client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return client;
}

