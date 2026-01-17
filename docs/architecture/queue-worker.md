# Queue Worker Architecture

## Overview

The queue worker (`supabase/functions/queue-worker/index.ts`) is responsible for processing asynchronous jobs across all tenants. It uses HTTP calls to invoke other Edge Functions, enabling independent scaling and deployment.

## Architecture Decision: HTTP Calls vs Direct Function Calls

### Why HTTP Calls?

**Edge Functions are isolated**: Supabase Edge Functions run in isolated Deno runtime environments. There is no shared memory or direct function invocation mechanism between functions.

**Standard inter-function communication**: HTTP is the standard protocol for communication between distributed services. This aligns with microservices architecture principles.

**Independent scaling**: Each Edge Function can scale independently based on its own load patterns. The queue worker can process jobs at a different rate than ingestion functions.

**Monitoring and observability**: HTTP calls provide:
- Clear request/response boundaries
- Status codes for success/failure
- Latency metrics via Supabase Edge Function logs
- Retry logic at the HTTP level

**Deployment flexibility**: Functions can be deployed independently without affecting others. A bug in one function doesn't require redeploying all functions.

### Trade-offs

**Latency**: Each HTTP call adds ~50-100ms overhead (acceptable for async background jobs)

**Failure isolation**: Each function can fail independently, which is actually a benefit for resilience

**Network dependency**: Functions must be accessible via HTTP (handled by Supabase's infrastructure)

## Job Processing Flow

1. **Fetch Pending Jobs**: Query `queue_jobs` table for pending jobs across all tenants (or specific tenant if provided)

2. **Claim Jobs**: Use database function `claim_next_job()` to atomically claim and lock jobs (prevents duplicate processing)

3. **Route to Handler**: Based on `job_type`, make HTTP POST request to appropriate Edge Function:
   - `ingest_microsoft` → `ingest-microsoft` function
   - `ingest_slack` → `ingest-slack` function
   - `process_embeddings` → `process-embeddings` function
   - `generate_digest` → `daily-digest` function
   - `prioritize_activities` → `prioritize-activities` function

4. **Handle Response**: 
   - Success: Mark job as completed via `complete_job()` RPC
   - Failure: Mark job as failed via `fail_job()` RPC with error message

5. **Retry Logic**: Jobs automatically retry based on `max_attempts` and `attempts` counter

## Error Handling

HTTP failures surface as actionable errors:

- **401 Unauthorized**: "Authorization failed. Check SUPABASE_SERVICE_ROLE_KEY configuration."
- **404 Not Found**: "Edge Function not found. Verify function deployment: {functionName}"
- **500 Internal Server Error**: "Function execution failed: {error}. Check function logs."
- **Network errors**: "Network error calling {functionName}: {error}. Check Supabase infrastructure status."

## Monitoring

- **Edge Function Logs**: View logs in Supabase Dashboard > Edge Functions > Logs
- **Job Status**: Query `queue_jobs` table to see job status, attempts, and error messages
- **Latency**: Monitor HTTP call duration in Edge Function logs
- **Failure Rate**: Track failed jobs via `queue_jobs.status = 'failed'`

## Performance Considerations

- **Batch Processing**: Processes up to `maxJobs` (default: 10) per tenant per run
- **Concurrent Processing**: Can process multiple tenants concurrently
- **Rate Limiting**: Respects external API rate limits (handled by individual functions)
- **Database Load**: Uses efficient queries with indexes on `status`, `scheduled_at`, `tenant_id`

## Future Improvements

- **Dead Letter Queue**: Move jobs that exceed max attempts to a separate table for manual review
- **Priority Queues**: Process high-priority jobs first
- **Scheduled Jobs**: Support cron-like scheduling via `scheduled_at` field
- **Job Dependencies**: Support job chains where one job depends on another completing







