# 80HD

## What This Is

This is Travis's personal productivity multiplier. It's a monorepo that contains experiments, tools, and the beginnings of a product — all aimed at one problem.

## The Problem: Cave Mode

Travis has ADHD. When he's doing deep technical work (infrastructure, architecture, platform enablement), he enters hyperfocus — hours of intense, productive work where he's completely invisible to his team. No updates posted. No collaboration trail. No indication that anything is happening.

Then he emerges with a complete solution and expects adoption. His team pushes back — not because the work is bad, but because they weren't brought along. Trust erodes. The ADHD rejection sensitivity kicks in. The cycle repeats.

This is "cave mode." It's not a failure of discipline — it's an executive function problem. The brain that produces excellent focused work is the same brain that can't context-switch to post a Teams update mid-flow.

## The Solution: Make Collaboration Automatic

80HD makes being visible easier than being invisible. It monitors work context across tools (git, Linear, Teams, Outlook, browser, system activity), detects what mode Travis is in (deep focus, struggling, under pressure), and generates collaboration artifacts at the right moments — without interrupting the work.

The sacred rule: **9 AM – 12 PM is never interrupted.** That's Vyvanse peak focus time. Everything else works around this.

## What's In This Repo

This isn't a conventional product codebase. It's a lab. Some things are production-ready, some are experiments, some are tools Travis uses daily to multiply his output. Here's what actually lives here:

### The Product Layers

**`macos/`** — Native macOS menu bar app (Swift, SQLite, 100% local). This is the future client. It monitors system state every 5 minutes — active app, git commits, window switches, keyboard activity — and detects work modes. Runs completely offline. Currently in early development.

**`apps/api/src/`** — The backend intelligence pipeline (TypeScript, Supabase Edge Functions, Deno). Ingests activity from Outlook, Teams, and Slack via connectors. Normalizes, deduplicates, embeds into PGVector for semantic search. Generates daily digests with AI. Prioritizes and escalates based on urgency. This is the most mature part of the codebase.

**`apps/web/`** — Next.js frontend (Vercel). Dashboard showing context switches avoided, escalations handled, focus blocks preserved. Focus Pager PWA for urgent alerts. Natural language query interface over activity history.

**`packages/shared/`** — Shared TypeScript schemas and utilities. The `ActivityRecord` type is the canonical data model that everything normalizes to.

### The Multiplier Layer

**`.claude/`** — This is where Travis's AI automation lives. Skills and agents designed to make Claude Code sessions more effective. This IS part of solving cave mode: if Claude can handle the overhead (documentation, reviews, research, updates), Travis stays in flow longer.

- **Skills**: `/dev-team` (agent teams), `/two-claude-review` (plan review), `/compose-email`, `/initiative-manager` (Linear/Jira sync), `/github-activity-summary`, `/project-context`, `/provisioning-bedrock`, `/provisioning-vertex`
- **Agents**: `knowledge-maintainer` (available as a subagent for manual doc updates in solo sessions)

**`litellm-proxy/`** — Local LLM proxy that routes requests to the optimal Claude model based on complexity. Simple questions go to Haiku (cheap), complex architecture work goes to Opus (best). Transparent cost optimization with Langfuse tracing.

**`agents/`** — Python-based multi-agent framework. Three-agent pipeline: Planner → Implementer → Verifier. Uses worktrees for isolation. Enforces coding standards via policy guardrails. This is an experiment in autonomous implementation.

### Supporting Infrastructure

**`knowledge-base/`** — Documentation repository. Getting-started guides, how-tos, troubleshooting. Articles get ingested into PGVector for semantic search.

**`mcp-servers/`** — Custom MCP servers (currently GCP Vertex AI provisioning).

**`observability/`** — OpenTelemetry collector config for distributed tracing.

**`docs/`** — Project documentation including architecture, discovery (user needs), the mac-app design docs, and the PROJECT_REFACTOR_GUIDE that documents the evolution to a collaboration visibility agent.

## Current Direction

The project is moving toward the native macOS app as the primary client. The Supabase backend stays as the intelligence and persistence layer. The immediate priorities are:

1. **macOS app** — Get context monitoring working (system state snapshots, git activity, work mode detection)
2. **Collaboration generation** — Auto-post updates to GitHub, Teams, Linear, Confluence when cave mode is detected
3. **Backend refinement** — The ingestion pipeline and prioritization engine are functional but need hardening
4. **Claude Code automation** — Continue building skills and agent teams that multiply output

## Cross-Project Work

Travis works across multiple repos and initiatives from within this directory — 80HD, Archera, Coralogix, and others. Claude sessions opened in 80HD sometimes get asked to work on code that belongs in a different project.

**If you're asked to work on something outside 80HD**, be explicit about it. Don't silently write code into the 80HD tree that belongs elsewhere. Ask which directory or repo the work targets. The `/dev-team` agent team includes a Project Manager role specifically to track which project each task belongs to and prevent this confusion.

## How to Work Here

### Project Structure
```
80HD/
├── macos/                 ← Native macOS app (Swift)
├── apps/api/src/          ← Edge Function source (TypeScript)
│   ├── connectors/        ← Outlook, Teams, Slack integrations
│   ├── intelligence/      ← AI prioritization & summarization
│   ├── normalizer/        ← Data transformation
│   ├── scheduler/         ← Background jobs (daily digest)
│   └── workers/           ← Embedding pipeline
├── apps/web/              ← Next.js frontend (Vercel)
├── packages/shared/       ← Shared schemas & utilities
├── litellm-proxy/         ← Intelligent model routing
├── agents/                ← Python agent framework (experiment)
├── supabase/functions/    ← Auto-generated Edge Function deployment
├── knowledge-base/        ← Documentation for semantic search
├── docs/                  ← Project docs & architecture
│   └── mac-app/           ← macOS app design docs
├── .claude/               ← AI automation (skills, agents, hooks)
└── infra/                 ← Infrastructure as code
```

### Technology Stack

- **macOS app**: Swift, SwiftUI, SQLite (local-only, privacy-first)
- **Backend**: Supabase (Postgres, Edge Functions, Auth, Vault), Deno runtime
- **Frontend**: Next.js 14+, React, TypeScript, Vercel AI SDK
- **AI**: PGVector embeddings, Vercel AI SDK (never direct provider SDKs), LiteLLM routing
- **Integrations**: Linear, Jira, Slack, Microsoft 365 — via MCP servers first, direct API only as fallback
- **Automation**: Claude Code skills, agent teams, hooks, knowledge-maintainer

### Key Rules

**Write Edge Function code in `apps/api/src/`, never edit `supabase/functions/` directly** — it's auto-generated.

**MCP servers before direct APIs** — Use `@softeria/ms-365-mcp-server` for Microsoft 365, Slack MCP server for Slack, Firecrawl MCP for web scraping. Only fall back to direct APIs when MCP doesn't support a required operation.

**No mocking in production code** — Fail fast with clear, actionable errors. Never return hardcoded data. Never silently fall back to mock responses.

**Vercel AI SDK for all LLM operations** — Use `generateText`, `streamText`, `generateObject`, `embed` from the `ai` package. Never import provider SDKs directly (no `openai`, no `@anthropic-ai/sdk`).

**TypeScript strict mode, Zod for external data** — No `any` types. Validate all external inputs with Zod schemas.

**500-line file limit** — Extract utilities, split classes, move types to `packages/shared/schemas/`.

**Tenant isolation** — Always filter by `tenant_id`. Never trust client-provided tenant IDs. RLS policies enforced everywhere.

**Idempotent migrations** — Use `IF NOT EXISTS`, `IF EXISTS`, `CREATE OR REPLACE`. Run twice, verify state is identical.

See [AGENTS.md](./AGENTS.md) for the full coding standards with examples and patterns.

### Git & Jira

```bash
# Branch naming
git checkout -b feature/ITPLAT01-1234-description

# Commit format (HEREDOC for multi-line)
git commit -m "$(cat <<'EOF'
[ITPLAT01-1234] Add GitHub connector

#time: 2h
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

Every commit needs a Jira ID, time tracking, and Co-Authored-By line.

## AI Workflows

### Skills

Available via `/skill-name` commands:

- `/dev-team` — Launch Agent Team with staff engineer, security analyst, researcher, project manager, and domain knowledge roles. Use for significant implementation work.
- `/project-expert` — Deep project mentor for answering team questions about FireHydrant, Archera, Coralogix, etc. Draws from accumulated knowledge of code, docs, APIs, CI/CD, and team member patterns. Logs Q&A history and builds team profiles over time.
- `/two-claude-review` — Staff engineer plan review (one-shot subagent, lower cost). Use before implementation to catch edge cases.
- `/compose-email` — Draft Outlook emails with HTML formatting
- `/initiative-manager` — Create & sync Linear initiatives to Jira/GitHub/Confluence
- `/github-activity-summary` — Team activity summaries
- `/project-context` — Load deep project context
- `/provisioning-bedrock` — AWS Bedrock API keys
- `/provisioning-vertex` — GCP Vertex AI projects

### Agent Teams vs Subagents

**Agent Teams** (`/dev-team`): Multiple Claude Code instances that communicate with each other. Use for feature implementation with continuous review, security analysis, research, project management, and documentation. Higher token cost (~6x for full 5-agent team), higher value for complex work. Includes a Project Manager role that keeps Linear updated and tracks cross-project context when working across repos.

**Subagents** (Task tool): Independent workers that report back silently. Use for exploration, quick reviews, test running, doc updates. Lower cost, good for focused tasks.

| Scenario | Use |
|----------|-----|
| Quick plan review | `/two-claude-review` (subagent) |
| Continuous review during implementation | `/dev-team` (agent team) |
| Documentation update | `knowledge-maintainer` (subagent) |
| Feature research | `/dev-team` (agent team) |
| Bug with multiple hypotheses | `/dev-team` investigation mode |
| Team member asks about a project | `/project-expert` |
| Recurring questions from SRE teams | `/project-expert` (tracks patterns) |

### Project Expert

`/project-expert` is a Musashi-inspired project mentor. When Travis receives a question from a team member about a project (FireHydrant, Archera, Coralogix, etc.), this skill draws from deep knowledge files, Q&A history, and team member profiles to formulate responses that teach principles — not just answers. It logs every interaction and builds profiles over time so it can notice patterns (e.g., someone asking the same question repeatedly signals a mental model gap, not a memory problem).

Usage: "I just received a question from Sarah about the FireHydrant project: how do I add a new service?"

Knowledge files live in `.claude/skills/project-expert/references/projects/<project>/`. Each project gets an EXPERT.md (deep knowledge), qa-log.jsonl (interaction history), and team/ directory (member profiles).

### Plan Mode

Use for: multiple files affected (3+), multiple valid approaches, architectural decisions, unclear requirements.

**Always run `/two-claude-review` after planning.** Write the plan → get staff engineer critique → address issues → iterate → implement.

When implementation starts failing, **stop and re-plan.** Don't patch forward. Start fresh with what you've learned.

## Session Context System

Context from Cowork desktop sessions and Claude Code terminal sessions persists across sessions via these files:

- **`CLAUDE.local.md`** (project root) — The primary handoff file. Contains last session summary, active threads, key insights, and next steps. Read this at session start to pick up where the last session left off.

- **`.claude/context/`** — Topic-specific context files for deep threads that span multiple sessions. Reference these from `CLAUDE.local.md` when a topic outgrows a single section.

### Incremental Context Saving

**Do not wait until end-of-session to save context.** Session limits can cut conversations off without warning. Instead, save incrementally:

- **After any exchange that produces a decision, insight, or direction change** — update `CLAUDE.local.md` immediately. This is the most important rule.
- **After completing a significant task or milestone** — update the "Last Session" section and any relevant "Active Threads".
- **After research or exploration that produced findings worth keeping** — add to "Key Insights" or create a `.claude/context/` file.
- **Trivial back-and-forth doesn't need saving.** Use judgment — if the next session would benefit from knowing it, save it. If not, skip it.

The goal: if the session dies mid-conversation, the last meaningful exchange is already on disk. The next session loses nothing important.

### Skills

- **`/load-context`** — Run at the start of any Cowork session. Reads `CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md`, and `.claude/context/` files. Presents a brief orientation.
- **`/save-context`** — Run explicitly to dump full context, or triggered proactively by the incremental saving convention above.

**Mid-session refresh**: If you're told "check the latest context" or "re-read CLAUDE.local.md", do it — a Cowork session may have updated it since this session started.

## Reference

- **[AGENTS.md](./AGENTS.md)** — Full coding standards with examples
- **[CLAUDE.local.md](./CLAUDE.local.md)** — Session context handoff (gitignored)
- **[docs/architecture/](./docs/architecture/)** — System design
- **[docs/discovery.md](./docs/discovery.md)** — User needs and requirements
- **[docs/mac-app/](./docs/mac-app/)** — macOS app design docs and the project refactor guide
- **[.claude/skills/](./.claude/skills/)** — Skill documentation
- **[.claude/agents/](./.claude/agents/)** — Agent configurations
