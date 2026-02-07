# 80HD - ADHD Collaboration Agent

**Making collaboration easier than cave mode for ADHD professionals in technical roles.**

80HD is a collaboration visibility agent that monitors work context, learns ADHD patterns, and proactively suggests collaboration touchpoints with near-zero friction. It solves the "cave mode" problem where ADHD professionals enter hyperfocus, do great work, but collaboration becomes invisible—causing trust issues despite good intentions.

## The Cave Mode Problem

**What happens:**
1. Enter hyperfocus on interesting technical problem
2. Spend hours/days in deep flow state doing excellent work
3. Emerge with completed work but no collaboration trail
4. Receive feedback about poor collaboration despite good intentions
5. Anxiety about being perceived as non-collaborative

**The core issue:** It's not laziness or lack of care—it's **friction**. When deep in flow, stopping to post updates feels like climbing a mountain. So we don't. Then trust erodes.

## The Solution

80HD makes collaboration **easier than not collaborating** by:

- **Monitoring full work context** - Code commits, Teams activity, browser research, project management
- **Learning ADHD patterns** - Detects deep focus, struggling, pressure modes
- **Proactive suggestions** - Nudges at the right time (never during sacred focus hours)
- **Auto-generating updates** - Creates tailored content for GitHub, Teams, Linear, Confluence
- **Multi-channel distribution** - Posts everywhere to fight the fear of being ignored
- **Adaptive learning** - Gets smarter about your patterns and preferences

## Features

- **Work Mode Detection** - Identifies deep focus, struggling, pressure, and communication states
- **Sacred Time Protection** - Never interrupts during prime focus windows (9am-12pm)
- **Multi-Channel Posting** - GitHub Discussions (technical depth) + Teams (awareness) + Linear (status) + Confluence (docs)
- **Struggle Detection** - Notices research loops, AI-assisted iteration, build failures and suggests asking for help
- **Pressure Signal Detection** - Identifies deadline stress (commits to main, ignoring comms) and offers to handle updates
- **Meeting Prep Automation** - Auto-generates 1:1 prep notes (wins, blockers, questions)
- **Collaboration Debt Tracking** - Measures hours since last update weighted by work intensity
- **Natural Language Chat** - Ask "Should I share something?" or "Draft an update for the team"

## Technology Stack

**Current Phase - Backend Services & Integrations:**
- Supabase (Postgres + Edge Functions + Auth) for activity storage and API
- PGVector for semantic search and pattern matching
- Vercel AI SDK for content generation and chat
- MCP (Model Context Protocol) servers for tool integrations

**Future Phase - Native Client:**
- Native macOS app (Swift + SwiftUI) for system monitoring and notifications
- Safari App Extension for browser activity tracking
- Local-first data with sync to backend services

**AI & Intelligence:**
- Vercel AI SDK (unified LLM interface)
- Anthropic Claude for content generation and conversation
- OpenAI embeddings (text-embedding-3-small) for semantic matching
- Pattern learning for work mode detection

**Integrations:**
- Linear (source of truth for project management)
- GitHub (code + discussions + issues)
- Jira (synced from Linear)
- Microsoft Teams (primary communication)
- Outlook (calendar + email metadata)
- Azure DevOps (version control + pipelines)
- Confluence (documentation)

## Strategic Context

**Part of Q1 2026 GitOps Initiative**

80HD is a strategic enablement tool supporting cultural transformation within Platform Enablement. The GitOps initiative involves 5 teams (2 favorable, 3 resistant) and requires high visibility to build trust during Infrastructure as Code adoption.

**The Challenge:**
- Complex IaC work (Spacelift, Terraform, AWS) happens in deep focus
- Resistant teams need consistent visibility to build trust
- "Learn, do, teach" flywheel requires visible progress
- Platform Enablement success measured by delivered materials and adoption dashboards, not by controlling team choices

**How 80HD Helps:**
1. **Ensures Regular Updates** - IaC/GitOps work stays visible across channels
2. **Multi-Channel Distribution** - Updates reach all stakeholders (GitHub + Teams + Linear + Confluence)
3. **Reduces Friction** - Makes collaboration automatic, not overhead
4. **Builds Trust** - Consistent visibility → increased team confidence
5. **Demonstrates Cultural Change** - Shows platform team transparency and accessibility

**Success Metrics:**
- **Primary:** Trust increases (with teams, leadership) + Anxiety decreases (about collaboration)
- **Secondary:** Collaboration debt stays low, work visible by default, zero overhead time on "collaboration work"

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
