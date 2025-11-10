/**
 * Query hooks and utilities for fetching activities from Supabase.
 */

import useSWR from 'swr';
import { createClient } from '../supabase';
import { getServerUser } from '../auth';
import { createServerClient } from '../supabase-server';

export interface ActivityStats {
  contextSwitchesAvoided: number;
  criticalEscalationsHandled: number;
  focusBlocksPreserved: string;
}

/**
 * Fetch activity statistics for the dashboard.
 * Server-side function.
 */
export async function getActivityStats(tenantId: string): Promise<ActivityStats> {
  const supabase = await createServerClient();

  // Get today's date range
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Count activities today (proxy for context switches avoided)
  const { count: activitiesCount } = await supabase
    .from('activities')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('received_at', today.toISOString())
    .lt('received_at', tomorrow.toISOString());

  // Count critical escalations today
  const { count: escalationsCount } = await supabase
    .from('escalations')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'acknowledged')
    .gte('created_at', today.toISOString())
    .lt('created_at', tomorrow.toISOString());

  // Calculate focus blocks (simplified - could be more sophisticated)
  const focusBlocksMinutes = Math.floor((activitiesCount ?? 0) * 3); // Assume 3 min per activity saved
  const focusBlocksHours = Math.floor(focusBlocksMinutes / 60);
  const focusBlocksMins = focusBlocksMinutes % 60;
  const focusBlocksPreserved = `${focusBlocksHours}h ${focusBlocksMins}m`;

  return {
    contextSwitchesAvoided: activitiesCount ?? 0,
    criticalEscalationsHandled: escalationsCount ?? 0,
    focusBlocksPreserved,
  };
}

/**
 * Client-side hook to fetch activity stats.
 */
export function useActivityStats() {
  const supabase = createClient();

  return useSWR<ActivityStats>(
    'activity-stats',
    async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get tenant_id from user profile
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile?.tenant_id) {
        throw new Error('User profile not found');
      }

      return getActivityStats(profile.tenant_id);
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );
}

/**
 * Fetch recent activities for a tenant.
 */
export async function getRecentActivities(tenantId: string, limit = 10) {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('occurred_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch activities: ${error.message}`);
  }

  return data ?? [];
}

