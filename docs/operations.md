# Operations & Observability

## Monitoring Stack
- **Metrics:** Supabase performance insights + custom OpenTelemetry traces exported to Logflare (Vercel) or Honeycomb.
- **Logs:** Structured JSON logging from Edge Functions, workers, and Next API routes. Centralize in Supabase `logs` schema with retention policies and shipping to external sink.
- **Alerts:** PagerDuty integration for ingestion failures, embedding backlog growth, high escalation rate, or Focus Pager downtime.

## Health Checks
- `/api/health` (Next.js) returns build info and Supabase connectivity status.
- Scheduled Supabase cron job that verifies connectors (Slack RTM heartbeat, Microsoft delta token freshness) and raises alert if stale.

## Runbooks
- **Ingestion Failure:** Retry queue, validate OAuth tokens, check API rate limits, replay using stored raw payloads.
- **Embedding Backlog:** Scale worker concurrency, throttle ingestion, fall back to keyword search until caught up.
- **Notification Miss:** Check Focus Pager service worker registration, verify push provider (Web Push/SMS) credentials, inspect escalation audit table.

## QA & Testing
- Unit tests via Vitest (connectors, normalization, prioritization).
- Integration tests using Supabase test harness + Mock Service Worker for Slack/Microsoft APIs.
- Synthetic monitoring hitting `/focus-pager` and `/api/query` to ensure availability.

## Deployment Workflow
- GitHub Actions pipeline:
  - `lint` → `test` → `typecheck`.
  - Deploy preview to Vercel (`apps/web`).
  - Apply Supabase migrations via `supabase db push` to staging; manual approval for production.
- Versioning via tags; maintain changelog capturing user-facing improvements and trust-related fixes.

## Incident Response
- Define severity matrix (S1 missed critical escalation, S2 delayed digest, S3 UI bug).
- On-call rotation with escalation to founder (user).
- Post-incident review template capturing timeline, root cause, follow-up tasks.


