# Edge Functions Architecture

## Deno Runtime

Supabase Edge Functions run on Deno runtime. All Edge Functions are located in `supabase/functions/`.

## JSR Imports

Edge Functions use JSR (JavaScript Registry) imports for Supabase client:

```typescript
import { createClient } from 'jsr:@supabase/supabase-js@2';
```

**JSR imports work natively** in Supabase Edge Functions without requiring a `deno.json` configuration file. Supabase's Deno runtime has built-in support for JSR imports.

### Verification

All Edge Functions in this codebase use JSR imports:
- `supabase/functions/queue-worker/index.ts`
- `supabase/functions/process-embeddings/index.ts`
- `supabase/functions/daily-digest/index.ts`
- `supabase/functions/prioritize-activities/index.ts`
- `supabase/functions/ingest-microsoft/index.ts`
- `supabase/functions/ingest-slack/index.ts`
- `supabase/functions/send-notification/index.ts`

These functions deploy successfully without a `deno.json` file.

### When deno.json Might Be Needed

A `deno.json` file would only be needed if:
- JSR imports fail to resolve during deployment
- Custom import maps are required for non-JSR packages
- Type definitions need explicit configuration

If import resolution fails, create `supabase/functions/deno.json`:

```json
{
  "imports": {
    "@supabase/supabase-js": "jsr:@supabase/supabase-js@2"
  },
  "compilerOptions": {
    "lib": ["deno.window"]
  }
}
```

## Shared Code

Shared utilities are located in `supabase/functions/_shared/`:
- `cors.ts` - CORS headers
- `oauth.ts` - OAuth token management
- `model-config.ts` - AI model configuration
- `retry.ts` - Retry logic with exponential backoff
- `storage.ts` - Storage bucket utilities
- `sync-state.ts` - Sync state management
- `prioritization.ts` - Activity prioritization logic

These are imported using relative paths:

```typescript
import { corsHeaders } from '../_shared/cors.ts';
```

## Environment Variables

Edge Functions access environment variables via `Deno.env.get()`:

```typescript
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
```

**Important**: Environment variables for Edge Functions must be set in Supabase Dashboard:
1. Go to Project Settings > Edge Functions > Secrets
2. Add each environment variable
3. Variables are not read from `.env.local` files

Required Edge Function secrets:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `MICROSOFT_CLIENT_ID` (for Microsoft ingestion)
- `MICROSOFT_CLIENT_SECRET` (for Microsoft ingestion)
- `SLACK_CLIENT_ID` (for Slack ingestion)
- `SLACK_CLIENT_SECRET` (for Slack ingestion)
- `LLM_MODEL` (optional, defaults to `openai/gpt-4`)
- `EMBEDDING_MODEL` (optional, defaults to `openai/text-embedding-3-large`)
- `MAX_RETRIES` (optional, defaults to `3`)
- `RETRY_DELAY_MS` (optional, defaults to `1000`)

### Local environment files

- The repository's `.env.example` file contains comprehensive documentation of all environment variables needed for the project.
- It includes variables for both Edge Functions and Next.js, with descriptions, example values, and setup instructions.
- **Note**: Edge Function secrets must still be set in Supabase Dashboard (not read from `.env.local` files).
- For local development, copy `.env.example` to `.env.local` and fill in your actual values.

## Deployment

Deploy Edge Functions using Supabase CLI:

```bash
# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy queue-worker

# Deploy with environment variables (for local testing)
supabase functions deploy queue-worker --env-file .env.local
```

## Error Handling

All Edge Functions follow the fail-fast pattern with clear error messages:

```typescript
if (!supabaseUrl) {
  throw new Error(
    'SUPABASE_URL is not set in Edge Function environment. ' +
    'Please set this environment variable in your Supabase project settings. ' +
    'Go to Project Settings > Edge Functions > Secrets to configure environment variables.'
  );
}
```

Error messages guide developers to:
- What failed
- Why it failed
- How to fix it (specific steps)

## Testing

Edge Functions can be tested locally:

```bash
# Start Supabase locally
supabase start

# Serve functions locally
supabase functions serve

# Test specific function
curl -X POST http://localhost:54321/functions/v1/queue-worker \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "test-tenant-id"}'
```

For integration testing, see `docs/testing/integration-tests.md`.

