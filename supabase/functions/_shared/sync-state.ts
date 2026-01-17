/**
 * Sync state management utilities for Edge Functions
 */

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export type SyncSource = 'microsoft-mail' | 'microsoft-teams' | 'slack';

/**
 * Get sync state (delta token or cursor) for a tenant and source.
 */
export async function getSyncState(
  supabase: SupabaseClient,
  tenantId: string,
  source: SyncSource
): Promise<{ delta_token?: string | null; cursor?: string | null } | null> {
  const { data, error } = await supabase
    .from('sync_state')
    .select('delta_token, cursor')
    .eq('tenant_id', tenantId)
    .eq('source', source)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get sync state: ${error.message}`);
  }

  return data;
}

/**
 * Save sync state (delta token or cursor) for a tenant and source.
 */
export async function saveSyncState(
  supabase: SupabaseClient,
  tenantId: string,
  source: SyncSource,
  state: { delta_token?: string | null; cursor?: string | null }
): Promise<void> {
  const { error } = await supabase
    .from('sync_state')
    .upsert(
      {
        tenant_id: tenantId,
        source,
        delta_token: state.delta_token ?? null,
        cursor: state.cursor ?? null,
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'tenant_id,source',
      }
    );

  if (error) {
    throw new Error(`Failed to save sync state: ${error.message}`);
  }
}







