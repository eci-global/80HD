# Staging Verification Checklist

## Purpose

Before promoting a deployment to production, run through this checklist to verify the staging environment behaves correctly with real integrations and scheduled automation.

## 1. Supabase Cron Jobs
- [ ] `cron.job` table shows entries for `queue-worker`, `ingest-microsoft`, `ingest-slack`, `process-embeddings`, and `daily-digest`
- [ ] Each job's `last_success` timestamp is recent (<= 15 minutes for ingest jobs, <= 5 minutes for queue worker)
- [ ] Review Supabase Edge Function logs for each job run to confirm HTTP 200 responses
- [ ] If a job fails, capture the error and follow the remediation guidance in `infra/supabase/cron.sql`

## 2. Connector Integrations
- [ ] Microsoft 365 ingestion (`ingest-microsoft`) pulls at least one recent message into `activities`
  - Verify by querying `activities` filtered on `source = 'microsoft'` and recent timestamps
  - Confirm `oauth_tokens` row for the staging tenant has a non-expired `expires_at`
- [ ] Slack ingestion (`ingest-slack`) pulls at least one recent message into `activities`
  - Query `activities` with `source = 'slack'`
  - Confirm Slack OAuth token refresh succeeded (check `oauth_tokens.updated_at`)
- [ ] For any connector failure, run the relevant Edge Function manually and capture the error output for debugging

## 3. Embeddings and Prioritization Pipeline
- [ ] `process-embeddings` job marks pending chunks as processed (check `activity_chunks.status = 'processed'` for recent rows)
- [ ] `prioritize-activities` job creates new escalations for qualifying activities
  - Verify records in `escalations` with recent `created_at`
  - Confirm `reason` field is populated with a JSON array

## 4. Notifications and Focus Pager
- [ ] Ensure at least one staging user has an active push subscription in `notification_subscriptions`
- [ ] Trigger `queue-worker` manually with a `prioritize_activities` payload and confirm a notification reaches the device (browser push or SMS, depending on channel)
- [ ] Inspect `apps/web` logs for successful POST to `/api/notifications/send`
- [ ] Remove stale push subscriptions returned as failures during notification sending

## 5. Documentation and Secrets
- [ ] Reconcile environment variables against `docs/architecture/edge-functions.md`
  - Confirm Supabase secrets include every variable listed in the "Required Edge Function secrets" section
  - Confirm hosting provider (e.g., Vercel) contains the client-side variables (`NEXT_PUBLIC_*` keys)
- [ ] Record any deviations or temporary overrides directly in the deployment notes for the release

## 6. Sign-off
- [ ] Identify any failing checks and open tracking issues before release
- [ ] Capture log snapshots, database query outputs, and manual test results in the release runbook
- [ ] Record the date, time, and reviewer responsible for staging sign-off
