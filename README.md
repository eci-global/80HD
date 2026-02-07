# 80HD - Interruption Shield for ADHD

80HD is an interruption shield for knowledge workers with ADHD, consolidating Microsoft 365 (Outlook, Teams) and Slack activity into a focused stream that surfaces only what matters. The project combines Supabase (Postgres + PGVector + Edge Functions) with a Vercel-hosted interface for querying, daily digests, and smart escalations.

## Features

- **Smart Activity Consolidation** - Aggregates Outlook, Teams, and Slack into a unified stream
- **AI-Powered Focus Mode** - Semantic filtering using PGVector embeddings to surface only relevant interruptions
- **Intelligent Escalations** - Routes urgent items while batching low-priority notifications
- **Daily Digests** - Summarized activity reports for catching up without context switching
- **Natural Language Queries** - Ask about your activity stream using conversational search

## Technology Stack

**Frontend:**
- Next.js 14+ with App Router
- React with TypeScript
- Vercel AI SDK for chat interfaces

**Backend:**
- Supabase (Postgres + Edge Functions + Auth + Storage)
- PGVector for semantic search and embeddings
- Deno runtime for Edge Functions

**AI & Intelligence:**
- Vercel AI SDK (unified interface for LLMs)
- OpenAI embeddings via text-embedding-3-small
- Semantic similarity search with PGVector

**Integrations:**
- Linear, Jira, GitHub (project management)
- Slack, Microsoft 365 (Outlook, Teams) via MCP servers
- Firecrawl (web scraping and content extraction)

## Project Structure

```
80HD (monorepo)
├── apps/
│   ├── api/              ← Supabase Edge Function sources
│   │   └── src/          ← TypeScript source code
│   │       ├── connectors/   ← External service integrations
│   │       ├── intelligence/ ← AI/LLM processing
│   │       ├── normalizer/   ← Data transformation
│   │       ├── scheduler/    ← Background jobs
│   │       └── workers/      ← Event processors
│   │
│   └── web/              ← Next.js application
│       └── app/          ← App router pages
│
├── supabase/functions/   ← Edge Function deployment configs (generated)
├── packages/shared/      ← Shared TypeScript libraries
├── infra/                ← Infrastructure as code
├── docs/                 ← Architecture and discovery docs
└── .claude/              ← AI automation (agents, hooks, skills)
```

**Key Workflow:** Write Edge Function code in `apps/api/src/`, deploy to `supabase/functions/`.

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd 80HD
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up local Supabase**
   ```bash
   supabase start
   supabase db reset  # Runs migrations
   ```

4. **Configure environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your Supabase credentials
   ```

5. **Run development servers**
   ```bash
   # Terminal 1: Start web app
   cd apps/web
   pnpm dev

   # Terminal 2: Serve Edge Functions locally
   supabase functions serve
   ```

## Documentation

- **[CLAUDE.md](./CLAUDE.md)** - Quick reference for Claude Code (AI workflows, common tasks, project navigation)
- **[AGENTS.md](./AGENTS.md)** - Detailed coding standards for AI agents (TypeScript, testing, security)
- **[docs/architecture/](./docs/architecture/)** - System design, data flow, security model
- **[docs/discovery.md](./docs/discovery.md)** - User needs, product requirements, personas
- **[.claude/skills/](./.claude/skills/)** - Available skills for specialized workflows

## Contributing

See [AGENTS.md](./AGENTS.md) for detailed coding standards. Key principles:

- **TypeScript only** with strict type safety
- **No mocking** - use real integrations and fail fast
- **Vercel AI SDK** - never use provider SDKs directly
- **500-line file limit** - refactor if exceeded
- **Git commits require Jira ID**: `[ITPLAT01-1234] Message #time: 2h`

## License

[License information here]
