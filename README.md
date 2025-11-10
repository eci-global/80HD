# 80HD

80HD is an interruption shield for knowledge workers with ADHD, consolidating Microsoft 365 (Outlook, Teams) and Slack activity into a focused stream that surfaces only what matters. The project combines Supabase (Postgres + PGVector + Edge Functions) with a Vercel-hosted interface for querying, daily digests, and smart escalations.

## Project Structure
- `apps/api` — Supabase Edge Function sources, ingestion pipelines, scheduled jobs.
- `apps/web` — Next.js application for chat UX, dashboards, and the Focus Pager PWA.
- `packages/shared` — Shared TypeScript libraries (schemas, telemetry, clients).
- `infra` — Infrastructure-as-code (Supabase, Vercel, observability).
- `docs` — Discovery, architecture, security, and operations references.

Refer to `docs/discovery.md` for user needs and `docs/architecture/` for system design and developer workflow.


