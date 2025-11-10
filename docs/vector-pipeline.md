# Storage & Embedding Pipeline

## Data Model Highlights
- `activities` table records normalized messages with metadata, participants, attachments, and provenance hashes.
- `activity_chunks` table stores chunked message content, embedding vectors (1536 dimensions), status tracking, and error info.
- `contacts`, `conversations`, and `escalations` tables provide relational context for prioritization and alerts.

Refer to `infra/supabase/migrations/0001_create_core_tables.sql` for the full schema.

## Embedding Flow
1. **Chunking:** Each normalized activity is split into semantic chunks (≈550 tokens) using sentence boundaries.
2. **Queue:** Chunks persist with `status='pending'`. Supabase cron job triggers Edge Function to claim batches.
3. **Embedding Worker:** Worker fetches pending chunks, calls embedding provider (OpenAI `text-embedding-3-large` by default), and writes vectors back.
4. **Index:** `ivfflat` index on `activity_chunks.embedding` supports cosine similarity search for chat UI and prioritization heuristics.
5. **Audit:** `last_error` and `status` fields support retries and monitoring dashboards.

## Governance Safeguards
- Each vector row references the originating `activity_id` + tenant for traceability.
- Raw payload JSON stored in Supabase Storage; chunk content limited to text to avoid large attachments.
- Retention policy recommendation: delete vectors when source activity is purged; create Supabase row-level security policies to enforce tenant isolation.

## Next Steps
- Implement Supabase Edge Function to orchestrate chunk creation upon activity insert.
- Add observability metrics (chunks processed per minute, error rate, latency).
- Evaluate hybrid search (metadata filters + vector similarity) for chat interface.


