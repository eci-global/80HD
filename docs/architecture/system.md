# 80HD System Architecture

## High-Level Topology
```mermaid
flowchart LR
    subgraph External Integrations
        Outlook[Microsoft 365 Outlook]
        Teams[Microsoft Teams]
        Slack[Slack Workspace]
    end

    Outlook -->|OAuth + Graph API| EdgeIngest
    Teams -->|Graph/Events API| EdgeIngest
    Slack -->|Events/Web API| EdgeIngest

    subgraph Supabase Project
        EdgeIngest[Supabase Edge Functions<br/>Connectors]
        Queue[Supabase Queue (pgmq/cron)]
        DB[(Postgres + PGVector)]
        Storage[(Supabase Storage)]
        Cron[Supabase Cron Jobs]
    end

    EdgeIngest --> Queue
    Queue -->|Normalize + Enrich| DB
    Queue -->|Blob archive| Storage
    DB --> Embeddings[Embedding Worker]
    Embeddings --> DB
    Cron --> Summaries[Summaries & Alerts Function]
    Summaries --> DB

    subgraph User Surfaces
        VercelApp[Vercel Chat & Dashboard]
        FocusPager[80HD Focus Pager<br/>(PWA notifications)]
        SMSFallback[Critical SMS/Voice Fallback]
    end

    DB -->|Query + RLS| VercelApp
    Summaries -->|Escalations| FocusPager
    Summaries -->|Failsafe| SMSFallback
```

## Component Breakdown
- **Supabase Edge Functions (Connectors):** Poll or subscribe to Microsoft Graph (mail + Teams) and Slack Events, performing scope‑limited OAuth with token refresh stored in Supabase Vault. Outputs canonical ingestion events.
- **Ingestion Queue:** Durable task queue (pgmq or Supabase task tables) buffering normalization jobs, enforcing rate limits, and guarding against duplicate messages.
- **Normalization & Governance Jobs:** Convert each source payload into the canonical `activity` schema, extract metadata (participants, tags, urgency signals), and apply sensitive-field tagging.
- **Postgres Core:** Stores structured entities (contacts, conversations, messages, interruptions, escalations). PGVector extension holds embeddings and semantic indexes. Row Level Security enforces per-user tenancy.
- **Embedding Worker:** Background worker (Edge Function or serverless container) generating embeddings via OpenAI/Anthropic, chunking long content, and recording provenance pointers.
- **Summaries & Alert Functions:** Scheduled jobs run prioritization heuristics, produce daily digest artifacts, and trigger escalations that push notifications to the Focus Pager or fallback channel.
- **User Surfaces:** 
  - `apps/web` on Vercel for chat-style query interface, dashboards, and controls.
  - Lightweight Focus Pager PWA (could live inside the same Vercel app) configured for Web Push notifications, allowing email/Teams/SMS clients to stay closed.
  - Optional SMS/voice failsafe (e.g., Twilio) for highest urgency events while dedicated app matures.
- **Identity & Auth:** Supabase Auth with external provider support; service tokens stored in Supabase secrets vault; RBAC distinguishes owner vs. collaborators (future).
- **Observability:** Supabase logs, structured edge function telemetry, OpenTelemetry exporters feeding Logflare or other sink, plus application metrics dashboards.

## Data Flow Summary
1. OAuth tokens obtained via secure consent flow and stored in Supabase.
2. Edge Function connectors receive new message events (webhooks, incremental sync, or polling).
3. Events are enqueued with idempotency keys; normalization jobs map them to canonical schema.
4. Messages persist into Postgres; attachments metadata uploaded to Supabase Storage if required.
5. Embedding worker batches new records, creates vector embeddings, and stores them alongside provenance references in PGVector.
6. Scheduled heuristics evaluate importance (“signal”) and produce alerts or digests.
7. Alerts push to Focus Pager (Web Push) and optionally SMS; digests stored and surfaced in the Vercel UI.
8. User queries through chat UI orchestrate semantic search + LLM summarization with guardrails and audit logging.

## Deployment & Environments
- **Supabase:** Primary backend (Postgres, Edge Functions, Storage, Auth, Cron) with staging + production projects.
- **Vercel:** Hosts React/Next.js application with environment-bound configuration and Web Push service worker.
- **CI/CD:** GitHub Actions (or Vercel/Supabase native pipelines) running lint/tests, deploying infrastructure definitions from `infra/`.
- **Secret Management:** Supabase secrets for runtime tokens; local `.env` files managed via Doppler/1Password CLI for developers.

## Open Architectural Decisions
- Final selection of queue mechanism (pgmq vs. external like Upstash/Qstash).
- Notification fallback provider (Twilio vs. Apple/Google push bridging).
- Long-term storage strategy for attachments (keep hashed references vs. full binary).


