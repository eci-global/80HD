# Integration Testing Guide

## Philosophy

Per AGENTS.md no-mocking policy, all integration tests use **real services and APIs**. Tests fail fast with clear, actionable error messages that guide developers to fix configuration issues.

## Prerequisites

### Required Test Accounts

1. **Supabase Project**: Real Supabase project (staging or production)
   - PGVector extension enabled
   - All migrations applied
   - RLS policies configured

2. **Microsoft 365 Test Account**: 
   - Test Microsoft 365 tenant
   - Azure AD app registration with Graph API permissions
   - OAuth tokens stored in `oauth_tokens` table

3. **Slack Test Workspace**:
   - Test Slack workspace
   - Slack app with required scopes
   - OAuth tokens stored in `oauth_tokens` table

4. **OpenAI API Account**:
   - Valid OpenAI API key
   - Sufficient credits for testing

### Environment Setup

Set the following environment variables:

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# AI/LLM
OPENAI_API_KEY=your-openai-api-key
EMBEDDING_MODEL=openai/text-embedding-3-large
LLM_MODEL=openai/gpt-4

# OAuth (for Edge Functions)
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret

# Web Push
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:admin@80hd.app
```

## Test Structure

### End-to-End Pipeline Test

Location: `tests/integration/pipeline.test.ts`

**Test Flow**:

1. **Setup**: Create test tenant and user in real Supabase project
2. **OAuth Configuration**: Store real OAuth tokens for test Microsoft/Slack accounts
3. **Ingestion**: Trigger real ingestion via Edge Functions (calls real Microsoft Graph/Slack APIs)
4. **Verification**: Verify activity appears in database
5. **Embeddings**: Trigger embedding processing (calls real OpenAI API)
6. **Verification**: Verify chunks get embeddings
7. **Prioritization**: Trigger prioritization (uses real activity data)
8. **Verification**: Verify escalation created for high-priority activity
9. **Notification**: Verify notification sent (uses real Web Push service)

### Error Handling in Tests

Each test step must fail fast with clear errors:

**Missing OAuth tokens**:
```
Error: OAuth token not found for tenant {id}. 
Run setup-oauth script or configure in Supabase Dashboard.
```

**API failures**:
```
Error: Microsoft Graph API error: 401 Unauthorized. 
Token expired. Refresh token required. Check oauth_tokens table.
```

**Missing configuration**:
```
Error: OPENAI_API_KEY not set. 
Set in Supabase Edge Function secrets. 
Go to Project Settings > Edge Functions > Secrets.
```

## Connector Testing

### Microsoft 365 Connector

**Setup**:
1. Create Azure AD app registration
2. Configure redirect URIs
3. Grant required Graph API permissions
4. Complete OAuth flow and store tokens

**Test Scenarios**:
- Fetch mail messages (with delta token)
- Fetch Teams chat messages
- Handle expired tokens (refresh)
- Handle rate limits
- Handle network errors

**Error Expectations**:
- OAuth token missing: Clear error with OAuth setup instructions
- Token expired: Automatic refresh attempt, error if refresh fails
- Rate limit: Error with retry-after guidance
- Network error: Error with connectivity check instructions

### Slack Connector

**Setup**:
1. Create Slack app in test workspace
2. Configure OAuth scopes
3. Complete OAuth flow and store tokens

**Test Scenarios**:
- Fetch channel messages (with cursor pagination)
- Fetch all channels
- Handle expired tokens (refresh)
- Handle rate limits
- Handle API errors

**Error Expectations**:
- OAuth token missing: Clear error with OAuth setup instructions
- Token expired: Automatic refresh attempt, error if refresh fails
- Rate limit: Error with retry-after guidance
- API error: Error with Slack API status check instructions

## Running Tests

```bash
# Run all integration tests
pnpm test:integration

# Run specific test file
pnpm test tests/integration/pipeline.test.ts

# Run with verbose output
pnpm test:integration --verbose
```

## Test Data Management

### Cleanup

Tests should clean up after themselves:
- Delete test tenants (cascades to all related data)
- Remove test OAuth tokens
- Clear test activities and escalations

### Isolation

Each test should:
- Use unique tenant IDs
- Not interfere with other tests
- Be idempotent (can run multiple times)

## Continuous Integration

Integration tests run in CI against:
- Staging Supabase project
- Test Microsoft 365 tenant
- Test Slack workspace
- Real OpenAI API (with rate limiting)

**CI Environment Variables**: Set in GitHub Actions secrets or CI platform

## Troubleshooting

### Common Issues

1. **OAuth Token Expired**: Run OAuth refresh flow or re-authenticate
2. **API Rate Limits**: Wait for rate limit window or use test accounts with higher limits
3. **Network Errors**: Check Supabase infrastructure status
4. **Missing Environment Variables**: Verify all required variables are set in test environment

### Debugging

- Check Edge Function logs in Supabase Dashboard
- Verify OAuth tokens in `oauth_tokens` table
- Check job status in `queue_jobs` table
- Review error messages in test output (they should be actionable)







