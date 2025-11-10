/**
 * Server-side Supabase client for Next.js Server Components and API routes.
 * This client uses the anon key and respects Row-Level Security (RLS) policies.
 * For operations requiring elevated privileges, use the service role client.
 *
 * Usage in Server Components:
 * ```tsx
 * import { createServerClient } from '@/lib/supabase-server'
 * const supabase = await createServerClient()
 * ```
 *
 * Usage in API Routes:
 * ```tsx
 * import { createServerClient } from '@/lib/supabase-server'
 * export async function GET(request: Request) {
 *   const supabase = await createServerClient()
 *   // ...
 * }
 * ```
 */

import { createServerClient as createSupabaseServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Creates a server-side Supabase client with cookie-based session management.
 * Fails fast with clear error messages if environment variables are missing.
 */
export async function createServerClient(): Promise<SupabaseClient> {
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

  const cookieStore = await cookies();

  return createSupabaseServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch (error) {
          // Cookie setting can fail in middleware, which is expected
          // The client will handle this gracefully
        }
      },
    },
  });
}

/**
 * Creates a server-side Supabase client with service role key.
 * WARNING: This bypasses RLS policies. Only use in trusted server contexts.
 * Never expose this client to the browser or use it in client components.
 *
 * Usage:
 * ```tsx
 * import { createServiceRoleClient } from '@/lib/supabase-server'
 * const supabase = createServiceRoleClient()
 * ```
 */
export function createServiceRoleClient(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      'SUPABASE_URL is not set. ' +
        'Please set this environment variable in your .env.local file. ' +
        'Get your Supabase URL from your project settings at https://supabase.com/dashboard.'
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. ' +
        'Please set this environment variable in your .env.local file. ' +
        'Get your service role key from your project settings at https://supabase.com/dashboard. ' +
        'WARNING: This key has elevated privileges and should never be exposed to the client.'
    );
  }

  // Use createClient directly for service role usage (no SSR needed)
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

