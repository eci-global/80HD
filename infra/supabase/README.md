# Supabase Infrastructure

## Migrations
Run migrations locally with Supabase CLI:

```bash
supabase start
supabase db reset --linked && supabase db push
```

The initial migration (`0001_create_core_tables.sql`) provisions:
- Tenancy, contacts, conversations, and normalized activity tables.
- `activity_chunks` with PGVector (1536 dimensions) for semantic search.
- Escalation audit trail.

Ensure PGVector is enabled on the Supabase project: `supabase db remote commit --use-vector`.

## Secrets & Configuration
- Store OAuth secrets (Microsoft, Slack) in Supabase secrets manager.
- Configure service role key and database URL via Doppler/1Password for local development.
- Set environment variables:
  - `EMBEDDING_MODEL=openai/text-embedding-3-large`
  - `SUPABASE_SERVICE_ROLE_KEY=...`
  - `SUPABASE_URL=...`
  - `OPENAI_API_KEY=...`


