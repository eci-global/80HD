/**
 * OAuth token management utilities for Edge Functions
 */

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export interface OAuthToken {
  id: string;
  tenant_id: string;
  provider: 'microsoft' | 'slack';
  access_token: string;
  refresh_token: string | null;
  expires_at: string;
  scope: string;
}

interface TokenRefreshResult {
  access_token: string;
  refresh_token?: string;
  expires_in: number; // seconds
  scope?: string;
}

/**
 * Refresh Microsoft Graph OAuth token
 */
async function refreshMicrosoftToken(refreshToken: string): Promise<TokenRefreshResult> {
  const clientId = Deno.env.get('MICROSOFT_CLIENT_ID');
  const clientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error(
      'MICROSOFT_CLIENT_ID or MICROSOFT_CLIENT_SECRET not set. ' +
      'Set these in Supabase Edge Function secrets. ' +
      'Go to Project Settings > Edge Functions > Secrets to configure.'
    );
  }

  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: 'https://graph.microsoft.com/.default',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Microsoft Graph token refresh failed: ${response.status} ${response.statusText}. ` +
      `Response: ${errorText}. ` +
      `Refresh token may be invalid or expired. Re-authenticate via OAuth flow.`
    );
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken, // Use new refresh token if provided
    expires_in: data.expires_in || 3600,
    scope: data.scope,
  };
}

/**
 * Refresh Slack OAuth token
 */
async function refreshSlackToken(refreshToken: string): Promise<TokenRefreshResult> {
  const clientId = Deno.env.get('SLACK_CLIENT_ID');
  const clientSecret = Deno.env.get('SLACK_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error(
      'SLACK_CLIENT_ID or SLACK_CLIENT_SECRET not set. ' +
      'Set these in Supabase Edge Function secrets. ' +
      'Go to Project Settings > Edge Functions > Secrets to configure.'
    );
  }

  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Slack token refresh failed: ${response.status} ${response.statusText}. ` +
      `Response: ${errorText}. ` +
      `Refresh token may be invalid or expired. Re-authenticate via OAuth flow.`
    );
  }

  const data = await response.json();
  if (!data.ok) {
    throw new Error(
      `Slack API error: ${data.error || 'Unknown error'}. ` +
      `Refresh token may be invalid or expired. Re-authenticate via OAuth flow.`
    );
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
    expires_in: data.expires_in || 3600,
    scope: data.scope,
  };
}

/**
 * Save refreshed token to database
 */
async function saveRefreshedToken(
  supabase: SupabaseClient,
  tenantId: string,
  provider: 'microsoft' | 'slack',
  refreshResult: TokenRefreshResult
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + refreshResult.expires_in);

  const { error } = await supabase
    .from('oauth_tokens')
    .upsert(
      {
        tenant_id: tenantId,
        provider,
        access_token: refreshResult.access_token,
        refresh_token: refreshResult.refresh_token || null,
        expires_at: expiresAt.toISOString(),
        scope: refreshResult.scope || '',
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'tenant_id,provider',
      }
    );

  if (error) {
    throw new Error(
      `Failed to save refreshed OAuth token: ${error.message}. ` +
      `Check database connection and RLS policies.`
    );
  }
}

/**
 * Get a valid access token for a tenant and provider.
 * Automatically refreshes if expired.
 * Throws error if token not found or refresh fails.
 */
export async function getAccessToken(
  supabase: SupabaseClient,
  tenantId: string,
  provider: 'microsoft' | 'slack'
): Promise<string> {
  const { data: token, error } = await supabase
    .from('oauth_tokens')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('provider', provider)
    .single();

  if (error || !token) {
    throw new Error(
      `OAuth token not found for tenant ${tenantId} and provider ${provider}. ` +
      `Please complete OAuth authorization flow. ` +
      `Configure OAuth tokens in Supabase Dashboard or via OAuth callback endpoint.`
    );
  }

  const expiresAt = new Date(token.expires_at);
  const now = new Date();
  const bufferMinutes = 5; // Refresh 5 minutes before expiry

  // Check if token is expired or expiring soon
  if (expiresAt <= new Date(now.getTime() + bufferMinutes * 60 * 1000)) {
    if (!token.refresh_token) {
      throw new Error(
        `OAuth token expired for tenant ${tenantId} and provider ${provider}. ` +
        `Refresh token missing or invalid. Re-authenticate via OAuth flow.`
      );
    }

    try {
      // Refresh the token
      const refreshResult = provider === 'microsoft'
        ? await refreshMicrosoftToken(token.refresh_token)
        : await refreshSlackToken(token.refresh_token);

      // Save the refreshed token
      await saveRefreshedToken(supabase, tenantId, provider, refreshResult);

      return refreshResult.access_token;
    } catch (refreshError) {
      throw new Error(
        `Failed to refresh OAuth token for tenant ${tenantId} and provider ${provider}: ` +
        `${refreshError instanceof Error ? refreshError.message : String(refreshError)}. ` +
        `Re-authenticate via OAuth flow.`
      );
    }
  }

  return token.access_token;
}

