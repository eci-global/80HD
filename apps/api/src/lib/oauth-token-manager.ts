/**
 * OAuth Token Manager
 * 
 * Handles storage and retrieval of OAuth tokens for Microsoft 365 and Slack integrations.
 * Tokens are stored in the oauth_tokens table and refreshed automatically when expired.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface OAuthToken {
  id: string;
  tenant_id: string;
  provider: 'microsoft' | 'slack';
  access_token: string;
  refresh_token: string | null;
  expires_at: string;
  scope: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TokenRefreshResult {
  access_token: string;
  refresh_token?: string;
  expires_in: number; // seconds
  scope?: string;
}

export class OAuthTokenManager {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Get a valid access token for a tenant and provider.
   * Automatically refreshes if expired.
   */
  async getAccessToken(
    tenantId: string,
    provider: 'microsoft' | 'slack',
    refreshCallback?: (refreshToken: string) => Promise<TokenRefreshResult>
  ): Promise<string> {
    const { data: token, error } = await this.supabase
      .from('oauth_tokens')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('provider', provider)
      .single();

    if (error || !token) {
      throw new Error(
        `No OAuth token found for tenant ${tenantId} and provider ${provider}. ` +
        `Please complete OAuth authorization flow.`
      );
    }

    const expiresAt = new Date(token.expires_at);
    const now = new Date();
    const bufferMinutes = 5; // Refresh 5 minutes before expiry

    // Check if token is expired or expiring soon
    if (expiresAt <= new Date(now.getTime() + bufferMinutes * 60 * 1000)) {
      if (!refreshCallback || !token.refresh_token) {
        throw new Error(
          `OAuth token expired for tenant ${tenantId} and provider ${provider}. ` +
          `Refresh token not available or refresh callback not provided.`
        );
      }

      // Refresh the token
      const refreshResult = await refreshCallback(token.refresh_token);
      await this.saveToken(tenantId, provider, {
        access_token: refreshResult.access_token,
        refresh_token: refreshResult.refresh_token || token.refresh_token,
        expires_in: refreshResult.expires_in,
        scope: refreshResult.scope || token.scope,
      });

      return refreshResult.access_token;
    }

    return token.access_token;
  }

  /**
   * Save or update an OAuth token for a tenant and provider.
   */
  async saveToken(
    tenantId: string,
    provider: 'microsoft' | 'slack',
    tokenData: TokenRefreshResult & { refresh_token?: string }
  ): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

    const { error } = await this.supabase
      .from('oauth_tokens')
      .upsert(
        {
          tenant_id: tenantId,
          provider,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || null,
          expires_at: expiresAt.toISOString(),
          scope: tokenData.scope || '',
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'tenant_id,provider',
        }
      );

    if (error) {
      throw new Error(
        `Failed to save OAuth token: ${error.message}. ` +
        `Check database connection and RLS policies.`
      );
    }
  }

  /**
   * Delete an OAuth token for a tenant and provider.
   */
  async deleteToken(tenantId: string, provider: 'microsoft' | 'slack'): Promise<void> {
    const { error } = await this.supabase
      .from('oauth_tokens')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('provider', provider);

    if (error) {
      throw new Error(`Failed to delete OAuth token: ${error.message}`);
    }
  }

  /**
   * Get token metadata for a tenant and provider.
   */
  async getToken(tenantId: string, provider: 'microsoft' | 'slack'): Promise<OAuthToken | null> {
    const { data, error } = await this.supabase
      .from('oauth_tokens')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('provider', provider)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      throw new Error(`Failed to get OAuth token: ${error.message}`);
    }

    return data as OAuthToken;
  }
}







