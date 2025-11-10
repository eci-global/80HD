/**
 * Query hooks and utilities for fetching daily digests from Supabase.
 */

import useSWR from 'swr';
import { createClient } from '../supabase';
import { createServerClient } from '../supabase-server';

export interface DailyDigest {
  id: string;
  tenant_id: string;
  date: string;
  summary: string;
  highlights: string[];
  created_at: string;
}

export interface ActionItem {
  id: string;
  tenant_id: string;
  content: string;
  source_date: string;
  status: 'pending' | 'completed' | 'cancelled';
  due_date: string | null;
  created_at: string;
}

/**
 * Fetch the most recent daily digest for a tenant.
 */
export async function getLatestDigest(tenantId: string): Promise<DailyDigest | null> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('daily_digests')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('date', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // No digest found
    }
    throw new Error(`Failed to fetch digest: ${error.message}`);
  }

  return data as DailyDigest;
}

/**
 * Fetch pending action items for a tenant.
 */
export async function getPendingActionItems(tenantId: string): Promise<ActionItem[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('action_items')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch action items: ${error.message}`);
  }

  return (data as ActionItem[]) ?? [];
}

/**
 * Client-side hook to fetch latest digest.
 */
export function useLatestDigest() {
  const supabase = createClient();

  return useSWR<DailyDigest | null>(
    'latest-digest',
    async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return null;
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile?.tenant_id) {
        return null;
      }

      return getLatestDigest(profile.tenant_id);
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );
}

/**
 * Client-side hook to fetch pending action items.
 */
export function usePendingActionItems() {
  const supabase = createClient();

  return useSWR<ActionItem[]>(
    'pending-action-items',
    async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return [];
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile?.tenant_id) {
        return [];
      }

      return getPendingActionItems(profile.tenant_id);
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );
}

