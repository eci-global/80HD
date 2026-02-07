# 80HD Project Guide for Claude Code

Quick reference for navigating the 80HD project. For detailed coding standards, see [AGENTS.md](./AGENTS.md).

## Mission

80HD is a **collaboration visibility agent** for ADHD professionals in technical roles. It solves the "cave mode" problem: when deep in hyperfocus on complex work (IaC, infrastructure, architecture), collaboration becomes invisible despite great work being done. This causes trust erosion and anxiety.

**The Core Problem:** Friction. Stopping mid-flow to post updates feels insurmountable, so we don't. Then stakeholders wonder what we're doing.

**The Solution:** Make collaboration easier than cave mode by monitoring work context, learning patterns, and auto-generating updates at the right time for the right channels (GitHub Discussions, Teams, Linear, Confluence).

**Strategic Context:** Part of Q1 2026 GitOps initiative requiring high visibility with 5 teams (2 favorable, 3 resistant) during Platform Enablement's cultural transformation.

## User Context: Travis Thompson

**Role:** Platform Enablement Team Lead @ ECI Solutions (Fredericton, NB, Canada)  
**Condition:** ADHD (on Vyvanse)  
**Primary Challenge:** Collaboration visibility during hyperfocus states

### Physical Setup
```
LEFT Monitor (Horizontal):
├── Desktop 1: Claude Code (primary workspace)
└── Desktop 2: Teams + Outlook (comms hub)

RIGHT Monitor (Vertical):  
├── Top: Safari browsers (research, tools)
└── Bottom: Terminals (git, builds, ssh)
```

### Tool Ecosystem
- **Version Control:** Azure DevOps + GitHub
- **Project Management:** Linear (source of truth) → syncs to GitHub Issues + Jira
- **Communication:** Teams (primary, all-day chat + meetings), Outlook (calendar)
- **Documentation:** Confluence
- **Development:** Claude Code, Git, Azure DevOps pipelines

### Daily Schedule
- **8:00-9:00 AM:** House time (NOT work - ignore)
- **9:00-12:00 PM:** SACRED FOCUS (prime deep work, Vyvanse peak)
- **12:00-2:00 PM:** Tapering energy (gentle nudges okay)
- **2:00 PM+:** Collaborative time (full intervention capability)

### Cave Mode Triggers
1. **Hyperfocus** - Interesting technical problems (IaC, infrastructure)
2. **Pressure** - Deadlines, urgent fixes
3. **Struggling** - Stuck on complex problems, need help but don't ask

### Fear: Being Ignored
Travis's biggest concern is posting updates that get ignored, reinforcing the feeling that collaboration doesn't matter. This is why 80HD uses multi-channel distribution—making it impossible to miss updates.

## Quick Navigation

### Project Structure
```
80HD (monorepo)
├── apps/api/src/          ← Edge Function SOURCE CODE (TypeScript)
│   ├── connectors/        ← External service integrations
│   ├── intelligence/      ← AI/LLM processing
│   ├── normalizer/        ← Data transformation
│   ├── scheduler/         ← Background jobs
│   └── workers/           ← Event processors
├── supabase/functions/    ← Edge Function DEPLOYMENT (Deno, auto-generated)
├── apps/web/              ← Next.js frontend (Vercel)
├── packages/shared/       ← Shared TypeScript libraries
├── infra/                 ← Infrastructure as code
└── .claude/               ← AI automation (agents, hooks, skills)
```

### Key Workflow: Edge Functions
**Write code in `apps/api/src/`, deploy to `supabase/functions/`**

Never edit `supabase/functions/` directly - it's auto-generated from `apps/api/src/`.

### Technology Stack
- **Frontend**: Next.js 14+, React, TypeScript, Vercel AI SDK
- **Backend**: Supabase (Postgres, Edge Functions, Auth), Deno runtime
- **AI**: PGVector embeddings, Vercel AI SDK (never direct provider SDKs)
- **Integrations**: Linear, Jira, Slack, Microsoft 365 via MCP servers

## Common Tasks

### Adding a New Edge Function

1. Create source in `apps/api/src/connectors/`:
   ```typescript
   import { createClient } from '@supabase/supabase-js';
   import { z } from 'zod';

   const RequestSchema = z.object({ /* ... */ });

   export async function handler(req: Request): Promise<Response> {
     const input = RequestSchema.parse(await req.json()); // Validate
     const supabase = createClient(/* ... */);
     // Real implementation - NO MOCKING
     return new Response(JSON.stringify({ success: true }));
   }
   ```

2. Test locally: `supabase functions serve <name>`
3. Deploy: `supabase functions deploy <name>`

See [AGENTS.md](./AGENTS.md) lines 28-55 for no-mocking policy.

## 80HD-Specific Concepts

### Work Mode Detection

80HD identifies four primary work states:

1. **Deep Focus** - Steady commits, low app switching, extended desktop focus
   - Strategy: Don't interrupt, capture context silently
   
2. **Struggling** - No commits for 2+ hours, high browser switching (20+/15min), heavy Firecrawl usage, long Claude conversations
   - Strategy: Suggest posting question or asking for help
   
3. **Pressure** - Commits to main (bypassing feature branch), ignoring comms (4+ hours), working off-hours
   - Strategy: Offer to handle comms, don't interrupt the work
   
4. **Communication** - Active in Teams/Outlook, typing, in calls
   - Strategy: No nudges, collaboration already happening

### Collaboration Debt

**Formula:** `debt_score = hours_since_last_update × work_intensity_factor`

**Levels:**
- LOW: < 24 hours since last update
- MEDIUM: 24-48 hours
- HIGH: > 48 hours

**What counts as update:** Git push, GitHub Discussion post, Teams channel message, Linear comment, PR created/commented, Confluence page update

**What doesn't count:** Local commits, reading messages (not responding), viewing Linear (not updating), private DMs

### Sacred Time Protection

**9:00-12:00 PM: Prime Focus Window**
- NEVER interrupt unless critical emergency
- Vyvanse peak effectiveness window
- Most valuable hours to protect
- Queue nudges for 12pm+ if needed

**8:00-9:00 AM: House Time**
- Not work time (dishes, laundry, dinner prep)
- Don't track or consider activity as work

**2:00 PM+: Collaborative Time**
- Energy lower, naturally more social
- Perfect for nudges and updates
- Central timezone colleagues online

### Multi-Channel Distribution Strategy

When generating updates, ALWAYS post to multiple channels to fight fear of being ignored:

1. **GitHub Discussion** - Technical depth, code context, architectural decisions (for developers)
2. **Teams Post** - 2-sentence awareness update + link to discussion (for broad team)
3. **Linear Comment** - Project status, links to discussion and Teams (for PM view)
4. **Confluence** - ADRs or runbooks if architectural decision (for long-term reference)

**Why all channels:** One channel = easy to miss. Multiple = impossible to ignore. Builds trust through omnipresence.

### Creating a Database Migration

1. Generate migration: `supabase migration new description`
2. Write idempotent SQL with `DO $$` blocks (see [AGENTS.md](./AGENTS.md) lines 228-286):
   ```sql
   DO $$
   BEGIN
     IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'new_table') THEN
       CREATE TABLE new_table (...);
       ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;
       CREATE POLICY "tenant_policy" ON new_table USING (tenant_id = auth.tenant_id());
     END IF;
   END $$;
   ```
3. Apply: `supabase db reset` (local) or `supabase db push` (prod)

### Testing with Local Supabase

```bash
supabase start                              # Start local instance
supabase status                             # Get credentials
supabase functions serve <name> --env-file .env.local
```

### Using MCP Servers

**Always prefer MCP servers over direct API calls** (see [AGENTS.md](./AGENTS.md) lines 379-465):

- **Slack**: Use MCP server via ToolSearch, not `@slack/web-api`
- **Microsoft 365**: Use `@softeria/ms-365-mcp-server`, not `@microsoft/microsoft-graph-client`
- **Firecrawl**: Use MCP for web scraping

**Example:**
```typescript
// ❌ Don't: Direct API
import { WebClient } from '@slack/web-api';

// ✅ Do: MCP server
// Use ToolSearch to load Slack MCP tools, then call them
```

### Working with Shared Packages

```typescript
// ✅ Import from shared packages
import { ActivitySchema } from '@80hd/shared/schemas';
import { logger } from '@80hd/shared/telemetry';
import { createSupabaseClient } from '@80hd/shared/clients';

// ❌ Don't duplicate code or use relative paths across apps
```

### PGVector Embeddings

```typescript
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';

const { embedding } = await embed({
  model: openai.embedding('text-embedding-3-small'),
  value: 'Text to embed',
});

await supabase.from('activities').insert({ content: 'text', embedding });

// Query by similarity
const { data } = await supabase.rpc('match_activities', {
  query_embedding: embedding,
  match_threshold: 0.8,
});
```

See [AGENTS.md](./AGENTS.md) lines 124-166 for Vercel AI SDK patterns.

## AI Workflows

### When to Use Skills

Available via `/skill-name` commands (see `.claude/skills/`):

- `/sync-linear-jira` - Sync Linear to Jira with natural language
- `/github-activity-summary` - Team activity summaries
- `/two-claude-review` - Staff engineer plan review
- `/project-context` - Load deep context
- `/provisioning-bedrock` - AWS Bedrock API keys
- `/provisioning-vertex` - GCP Vertex AI projects

### When to Spawn Subagents

**Use Task tool with subagents for:**
- **Explore**: Thorough codebase exploration ("Where are Slack errors handled?")
- **Plan**: Complex features requiring architectural decisions
- **test-runner**: Run tests after writing code
- **knowledge-maintainer**: Update documentation after changes

**Don't use for:**
- Reading specific files (use Read)
- Searching for known class (use Glob/Grep)
- Simple tasks you can do directly

### Plan Mode vs Normal Mode

**Use EnterPlanMode when:**
- Multiple files affected (3+)
- Multiple valid approaches
- Architectural decisions needed
- Requirements unclear

**CRITICAL: Always use `/two-claude-review` after planning:**
1. Write the plan (or have Claude write it)
2. Run `/two-claude-review <plan-file>` to get staff engineer critique
3. Address critical issues and important improvements
4. Iterate until the review is satisfied
5. Only then proceed to implementation

This catches edge cases, simpler alternatives, and assumptions before implementation starts.

**Stay in Normal Mode when:**
- Simple fixes (1-2 lines)
- Clear instructions
- Research only (use Explore subagent)

## Git & Jira Integration

### Commit Format (Required)

```bash
git commit -m "$(cat <<'EOF'
[ITPLAT01-1234] Add GitHub connector

#time: 2h
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

**Rules:**
- Include Jira ID: `[ITPLAT01-1234]`
- Include time: `#time: 2h`
- Include Co-Authored-By line
- Use HEREDOC for multi-line

See [AGENTS.md](./AGENTS.md) lines 288-356 for full Git workflow.

### Branch Naming

```bash
git checkout -b feature/ITPLAT01-1234-description
```

## .claude/ Automation

### Agents
- **knowledge-maintainer**: Auto-updates docs after code changes

### Hooks
- **trigger-docs-update.sh**: Suggests doc updates after Write/Edit
  - Excludes: `/docs/`, `README`, `AGENTS`, `CLAUDE` (prevents loops)

### How It Works
1. You edit TypeScript file
2. Hook detects change
3. Hook suggests knowledge-maintainer
4. You decide whether to update docs

## Critical Patterns

### No Mocking Policy ([AGENTS.md](./AGENTS.md) lines 28-55)

```typescript
// ❌ Bad: Mock fallback
const activities = data || [{ id: 1, title: 'Mock' }];

// ✅ Good: Fail fast
if (!data) throw new Error('Failed to fetch. Check SUPABASE_URL env var.');
```

### Always Vercel AI SDK ([AGENTS.md](./AGENTS.md) lines 124-166)

```typescript
// ❌ Bad: Direct OpenAI
import OpenAI from 'openai';

// ✅ Good: Vercel AI SDK
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
```

### TypeScript Strict Mode ([AGENTS.md](./AGENTS.md) lines 4-9)

```typescript
// ❌ Bad: any type
const data: any = await response.json();

// ✅ Good: Zod validation
const data = DataSchema.parse(await response.json());
```

### 500-Line File Limit ([AGENTS.md](./AGENTS.md) lines 11-26)

If file exceeds 500 lines:
1. Extract utilities → separate module
2. Split classes → smaller components
3. Move types → `packages/shared/schemas/`
4. Break functions → composable pieces

## Common Pitfalls

1. **Editing deployment configs**: Don't edit `supabase/functions/`, edit `apps/api/src/`
2. **Using direct APIs**: Use MCP servers (Slack, M365) instead of API clients
3. **Missing tenant isolation**: Always filter by `tenant_id = auth.tenant_id()`
4. **Mocking in production**: Throw errors instead of returning mock data
5. **Missing Jira ID**: Commits require `[ITPLAT01-1234]` format
6. **Hardcoded secrets**: Use env vars, never hardcode credentials
7. **Skipping validation**: Always validate external data with Zod

## Reference Documentation

### Key Files
- **[AGENTS.md](./AGENTS.md)** - Detailed coding standards (697 lines)
- **[docs/architecture/system.md](./docs/architecture/system.md)** - System design
- **[docs/discovery.md](./docs/discovery.md)** - User needs, requirements
- **[.claude/skills/](/.claude/skills/)** - Skill documentation

### Specific Sections in AGENTS.md
- Lines 28-55: No mocking policy
- Lines 74-99: Architectural patterns
- Lines 124-166: Vercel AI SDK requirement
- Lines 228-286: Idempotent migrations
- Lines 288-356: Git workflow
- Lines 379-465: MCP server integration (Slack, M365, Firecrawl)

## Troubleshooting

**"Supabase client not initialized"**
→ Check `SUPABASE_URL` and `SUPABASE_KEY` env vars

**"Table does not exist"**
→ Run `supabase db reset` to apply migrations

**"Edge Function not found"**
→ Deploy with `supabase functions deploy <name>`

**"Hook triggered infinite loop"**
→ Verify CLAUDE/README/AGENTS excluded in `.claude/hooks/trigger-docs-update.sh`

## Next Steps

1. Read [AGENTS.md](./AGENTS.md) for detailed standards
2. Explore `docs/architecture/` for system design
3. Try `/project-context` skill for deep context
4. Review `.claude/agents/` for automation
5. Check recent commits for real examples

---

*This guide complements [AGENTS.md](./AGENTS.md). When in doubt, refer to AGENTS.md for authoritative coding standards.*
