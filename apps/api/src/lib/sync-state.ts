/**
 * Sync State Manager
 * 
 * Handles storage and retrieval of sync state (delta tokens, cursors) for incremental synchronization.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type SyncSource = 'microsoft-mail' | 'microsoft-teams' | 'slack';

export interface SyncState {
  id: string;
  tenant_id: string;
  source: SyncSource;
  delta_token: string | null;
  cursor: string | null;
  last_sync_at: string;
  updated_at: string;
}

export class SyncStateManager {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Get sync state for a tenant and source.
   */
  async getSyncState(tenantId: string, source: SyncSource): Promise<SyncState | null> {
    const { data, error } = await this.supabase
      .from('sync_state')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('source', source)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      throw new Error(`Failed to get sync state: ${error.message}`);
    }

    return data as SyncState;
  }

  /**
   * Save or update sync state for a tenant and source.
   */
  async saveSyncState(
    tenantId: string,
    source: SyncSource,
    state: {
      delta_token?: string | null;
      cursor?: string | null;
    }
  ): Promise<void> {
    const { error } = await this.supabase
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

  /**
   * Delete sync state for a tenant and source.
   */
  async deleteSyncState(tenantId: string, source: SyncSource): Promise<void> {
    const { error } = await this.supabase
      .from('sync_state')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('source', source);

    if (error) {
      throw new Error(`Failed to delete sync state: ${error.message}`);
    }
  }
}







