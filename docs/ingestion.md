# Ingestion & Normalization Design

## Connector Responsibilities
- **Microsoft 365 (Mail + Teams):** Use Microsoft Graph delta queries to capture new mail and chat messages with least-privilege scopes (`Mail.Read`, `Chat.Read`, `ChatMessage.Read`). Edge Functions run on Supabase, refresh tokens from Supabase Vault, and enqueue normalized events.
- **Slack:** Subscribe to Events API (and optionally Slack Socket Mode for low-latency). Normalize channel and DM traffic, perform mention detection, and handle rate limits via cursor-based pagination.
- Each connector creates a canonical `ActivityRecord` structure prior to normalization to simplify downstream processing and testing.

## Normalization Pipeline
1. **Validate:** Incoming activities validated against Zod schema (`ActivityRecordSchema`) to reject malformed payloads early.
2. **Enrich:** Compute stable hash for idempotency, clamp urgency, ensure timestamps normalized to ISO.
3. **Persist:** Store normalized activity plus provenance hash per tenant, with raw payload archived in Supabase Storage.
4. **Notify:** Emit queue event for embedding worker to process asynchronously.

## Idempotency & Ordering
- Stable hash built from source message IDs + content checksum prevents duplicates across retries.
- Queue ordering per source ensures deterministic processing while allowing cross-source concurrency.
- Delta tokens (Microsoft) and cursors (Slack) stored per connector in Postgres to recover after failures.

## Error Handling
- Retries: exponential backoff for API failures; poison queue for repeated schema violations.
- Telemetry: structured logs include tenant, connector, source, and hash to trace issues quickly.
- Secrets: connectors fetch tokens from Supabase secrets at runtime; no secrets committed to repo.

## Open Items
- Evaluate Teams change notifications vs. `/getAllMessages` polling for efficiency.
- Confirm Slack workspace limits to choose between Events API + HTTP vs. RTM/Socket Mode.
- Determine archive retention for raw payload JSON (default 90 days).


