/**
 * Query hooks and utilities for fetching escalations from Supabase.
 */

import useSWR from 'swr';
import { createClient } from '../supabase';
import { createServerClient } from '../supabase-server';

export interface Escalation {
  id: string;
  tenant_id: string;
  activity_id: string;
  priority_score: number;
  reason: string[];
  status: 'pending' | 'acknowledged' | 'dismissed';
  created_at: string;
  acknowledged_at: string | null;
}

/**
 * Fetch pending escalations for a tenant.
 */
export async function getPendingEscalations(tenantId: string): Promise<Escalation[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('escalations')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'pending')
    .order('priority_score', { ascending: false })
    .order('dispatched_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch escalations: ${error.message}`);
  }

  // Transform database records to match Escalation interface
  // Reason should be JSONB array per migration 0012
  return (data?.map((e: any) => {
    // Handle reason format - should be JSONB array, but handle legacy formats defensively
    let reasons: string[] = [];
    if (Array.isArray(e.reason)) {
      reasons = e.reason;
    } else if (typeof e.reason === 'string') {
      // Legacy text format - log warning and convert
      console.warn(`Escalation ${e.id} has non-array reason format. Converting to array.`);
      reasons = [e.reason];
    } else if (e.reason !== null && e.reason !== undefined) {
      // Try to parse as JSON if it's a stringified array
      try {
        const parsed = typeof e.reason === 'string' ? JSON.parse(e.reason) : e.reason;
        reasons = Array.isArray(parsed) ? parsed : [String(parsed)];
      } catch {
        reasons = [String(e.reason)];
      }
    }

    return {
      id: e.id,
      tenant_id: e.tenant_id,
      activity_id: e.activity_id || '',
      priority_score: e.priority_score || e.priority || 0,
      reason: reasons,
      status: e.status || 'pending',
      created_at: e.created_at || e.dispatched_at,
      acknowledged_at: e.acknowledged_at,
    };
  }) || []) as Escalation[];
}

/**
 * Client-side hook to fetch pending escalations.
 */
export function usePendingEscalations() {
  const supabase = createClient();

  return useSWR<Escalation[]>(
    'pending-escalations',
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

      return getPendingEscalations(profile.tenant_id);
    },
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      refreshInterval: 30000, // Refresh every 30 seconds
    }
  );
}

/**
 * Acknowledge an escalation.
 */
export async function acknowledgeEscalation(escalationId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('escalations')
    .update({
      status: 'acknowledged',
      acknowledged_at: new Date().toISOString(),
    })
    .eq('id', escalationId);

  if (error) {
    throw new Error(`Failed to acknowledge escalation: ${error.message}`);
  }
}

/**
 * Dismiss an escalation (mark as noise).
 */
export async function dismissEscalation(escalationId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('escalations')
    .update({
      status: 'dismissed',
    })
    .eq('id', escalationId);

  if (error) {
    throw new Error(`Failed to dismiss escalation: ${error.message}`);
  }
}

