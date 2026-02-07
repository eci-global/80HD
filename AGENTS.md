# AI Agent Guidelines for 80HD

Coding standards and technical conventions for the 80HD codebase. Read [CLAUDE.md](./CLAUDE.md) first to understand what this project is and why it exists — these standards exist to serve that mission.

80HD is a personal productivity multiplier that solves "cave mode" — the ADHD pattern of going invisible during deep work. This repo contains a native macOS app, a Supabase backend, a Next.js frontend, AI automation tools, and various experiments. The code quality standards below apply across all of these workstreams because reliability matters when the system is supposed to run autonomously in the background of someone's work.

## Documentation Navigation

- **[CLAUDE.md](./CLAUDE.md)** — Start here. Vision, project structure, what's in the repo, how to work here.
- **AGENTS.md** (this file) — Coding standards, security patterns, technical conventions.
- **[docs/architecture/](./docs/architecture/)** — System design and data flow.
- **[docs/mac-app/](./docs/mac-app/)** — macOS app design docs, including the PROJECT_REFACTOR_GUIDE.
- **[.claude/skills/](./.claude/skills/)** — Workflow automation (agent teams, reviews, provisioning, etc.).
- **[.claude/agents/](./.claude/agents/)** — Autonomous agents (knowledge-maintainer).

## Table of Contents

1. [Documentation Navigation](#documentation-navigation)
2. [Language & Type System](#language--type-system)
3. [Code Organization & File Size](#code-organization--file-size)
4. [No Mocking Policy](#no-mocking-policy) ⚠️ Critical
5. [Security Best Practices](#security-best-practices) ⚠️ Critical
6. [Architectural Patterns](#architectural-patterns)
7. [AI & LLM Integration](#ai--llm-integration) - Vercel AI SDK requirement
8. [Database & Data Access](#database--data-access) - Supabase, migrations, RLS
9. [Frontend Patterns](#frontend-patterns)
10. [Testing Philosophy](#testing-philosophy)
11. [Git Operations](#git-operations) - Commit format, Jira integration
12. [Tooling & Integration](#tooling--integration) - MCP servers, external services
13. [.claude/ Automation System](#claude-automation-system) - Agents, hooks, skills
14. [Code Review Checklist](#code-review-checklist)
15. [Examples](#examples)

## Language & Type System

- **TypeScript Only**: All code must be written in TypeScript. No JavaScript files unless absolutely necessary (e.g., legacy config files).
- **Strict Type Safety**: Leverage TypeScript's type system fully. Avoid `any` types; use `unknown` with proper type guards when necessary.
- **Type Inference**: Prefer type inference where possible, but explicitly type function parameters, return types, and public APIs.
- **Zod for Runtime Validation**: Use Zod schemas for all external data (API responses, user inputs, database records). Never trust external data without validation.

## Code Organization & File Size

- **Maximum File Length**: No single file should exceed **500 lines**. If a file approaches this limit, refactor by:
  - Extracting utility functions into separate modules
  - Splitting large classes into smaller, focused components
  - Moving type definitions to dedicated schema files
  - Breaking complex functions into smaller, composable functions

- **Modularity**: Keep files focused on a single responsibility. Each module should have a clear, single purpose.

- **Directory Structure**: Follow the established monorepo structure:
  - `apps/api/` - Supabase Edge Functions and backend logic
  - `apps/web/` - Next.js frontend application
  - `packages/shared/` - Shared TypeScript utilities, schemas, and types
  - `infra/` - Infrastructure definitions (Supabase migrations, etc.)
  - `docs/` - Documentation

## No Mocking Policy

**Critical Rule**: Do not mock data or endpoints by default. The codebase should fail fast and surface real errors.

### Principles:
- **Real Integrations First**: Always attempt to connect to real services (Supabase, external APIs) before considering mocks.
- **Fail Explicitly**: If an integration is missing or misconfigured, the code should throw clear, actionable errors that indicate what needs to be fixed.
- **Error Messages**: Error messages must be descriptive and include:
  - What operation failed
  - Why it failed (missing config, network error, etc.)
  - How to fix it (what environment variable to set, what service to configure)

### When Mocking is Acceptable:
- **Unit Tests Only**: Mocks are acceptable in isolated unit tests for pure functions.
- **Integration Test Fixtures**: Use real test data fixtures (e.g., Supabase test database) rather than mocks.
- **Development Stubs**: Temporary stubs are acceptable only if they immediately throw errors indicating what needs to be implemented.

### Anti-Patterns to Avoid:
- ❌ Mock API responses in production code
- ❌ Return hardcoded data arrays that look like real responses
- ❌ Silent fallbacks to mock data when real data fails
- ❌ Placeholder functions that return mock data without throwing errors

### Correct Patterns:
- ✅ Throw errors when Supabase client is not initialized
- ✅ Validate environment variables and fail fast if missing
- ✅ Use real Supabase queries that will error if tables don't exist
- ✅ Implement real API calls that will fail if credentials are wrong

## Security Best Practices

### Authentication & Authorization
- **Never Hardcode Credentials**: All secrets must come from environment variables or Supabase Vault.
- **Row-Level Security (RLS)**: Always assume RLS policies are enforced. Never bypass RLS by using service role keys in user-facing code.
- **Tenant Isolation**: Always filter queries by `tenant_id` derived from authenticated user context. Never trust client-provided tenant IDs.

### Input Validation
- **Validate All Inputs**: Use Zod schemas to validate all user inputs, API request bodies, and database query parameters.
- **Sanitize User Content**: Before storing user-generated content or passing it to LLMs, sanitize to prevent injection attacks.
- **Type-Safe Database Queries**: Use Supabase's typed client or explicit type assertions with validation.

### Secrets Management
- **Environment Variables**: Use `.env.example` to document required variables. Never commit `.env` files.
- **Supabase Vault**: Store OAuth refresh tokens and other sensitive data in Supabase Vault, not in code or environment variables.
- **Service Role Keys**: Only use service role keys in backend Edge Functions, never expose them to the frontend.

## Architectural Patterns

### Dependency Injection
- Use dependency injection for testability and flexibility:
  ```typescript
  interface ServiceDependencies {
    supabase: SupabaseClient;
    embeddings: EmbeddingProvider;
  }
  
  class Service {
    constructor(private deps: ServiceDependencies) {}
  }
  ```

### Error Handling
- **Explicit Error Types**: Create custom error classes for different failure modes:
  ```typescript
  class IngestionError extends Error {
    constructor(message: string, public readonly source: string) {
      super(message);
      this.name = 'IngestionError';
    }
  }
  ```

- **Never Swallow Errors**: Always log errors and propagate them unless you have a specific recovery strategy.

### Async Operations
- **Use Async/Await**: Prefer async/await over promise chains for readability.
- **Error Boundaries**: Wrap async operations in try/catch blocks with meaningful error messages.
- **Concurrency Control**: Use proper batching and rate limiting for external API calls.

## AI & LLM Integration

**Critical Rule**: All AI/LLM operations must use the Vercel AI SDK (`ai` package). Never use provider-specific SDKs directly.

### Vercel AI SDK Requirements

- **Unified API**: Use Vercel AI SDK for all LLM interactions (text generation, structured data, embeddings, streaming).
- **Provider Abstraction**: The AI SDK provides a unified interface that abstracts differences between providers (OpenAI, Anthropic, etc.).
- **Type Safety**: Leverage TypeScript types provided by the AI SDK for type-safe AI operations.
- **Streaming Support**: Use `streamText` for streaming responses to improve user experience.
- **Structured Output**: Use `generateObject` with Zod schemas for type-safe structured data generation.

### Installation

```bash
pnpm add ai
# For specific providers (if needed)
pnpm add @ai-sdk/openai @ai-sdk/anthropic
```

### Usage Patterns

**✅ Good: Using Vercel AI SDK**
```typescript
import { generateText, streamText, generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

// Text generation
const { text } = await generateText({
  model: openai('gpt-4'),
  prompt: 'Summarize this conversation',
});

// Streaming text
const { textStream } = await streamText({
  model: openai('gpt-4'),
  prompt: 'Explain quantum computing',
});

// Structured output with Zod
const { object } = await generateObject({
  model: openai('gpt-4'),
  schema: z.object({
    summary: z.string(),
    actionItems: z.array(z.string()),
  }),
  prompt: 'Extract key points from this message',
});
```

**❌ Bad: Direct Provider SDK Usage**
```typescript
// DON'T DO THIS - Using OpenAI SDK directly
import OpenAI from 'openai';
const openai = new OpenAI();
const completion = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello' }],
});

// DON'T DO THIS - Using Anthropic SDK directly
import Anthropic from '@anthropic-ai/sdk';
const anthropic = new Anthropic();
const message = await anthropic.messages.create({
  model: 'claude-3-opus-20240229',
  messages: [{ role: 'user', content: 'Hello' }],
});
```

### Embeddings

For embeddings, use the AI SDK's embedding functions:
```typescript
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';

const { embedding } = await embed({
  model: openai.embedding('text-embedding-3-large'),
  value: 'Text to embed',
});
```

### Benefits of Vercel AI SDK

- **Provider Portability**: Switch between providers by changing a single line of code
- **Streaming Built-in**: Native support for streaming responses without additional boilerplate
- **Type Safety**: Full TypeScript support with Zod schema validation
- **Tool Calling**: Built-in support for function calling and tool execution
- **Error Handling**: Consistent error handling across all providers
- **Framework Integration**: Seamless integration with Next.js, React, and other frameworks

### When Provider-Specific SDKs Are Acceptable

- **Embeddings Only**: If the AI SDK doesn't support a specific embedding model, provider SDKs may be used temporarily with a TODO to migrate
- **Legacy Code**: Existing code using provider SDKs should be migrated to AI SDK as part of refactoring
- **Edge Cases**: Document why AI SDK cannot be used and create an issue to track migration

### Migration Path

If you encounter existing code using provider SDKs:
1. Identify the use case (text generation, embeddings, structured output)
2. Map to equivalent AI SDK function (`generateText`, `streamText`, `generateObject`, `embed`)
3. Refactor to use AI SDK with proper error handling
4. Test thoroughly to ensure behavior matches
5. Remove provider SDK dependency

## Database & Data Access

### Supabase Client Usage
- **Typed Queries**: Use Supabase's TypeScript types where available. For custom queries, define types explicitly.
- **Transaction Safety**: Use transactions for multi-step operations that must be atomic.
- **Query Optimization**: Always include necessary filters (tenant_id, date ranges) to avoid full table scans.

### Migrations

**Critical Rule**: All database migrations must be idempotent and verified after completion.

#### Idempotency Requirements

- **Idempotent Operations**: Every migration must be safe to run multiple times without causing errors or duplicate changes.
- **Use Conditional Statements**: Always use `IF NOT EXISTS`, `IF EXISTS`, `CREATE OR REPLACE`, and similar conditional constructs.
- **Check Before Modify**: Verify the current state before making changes (e.g., check if column exists before adding it).
- **No Side Effects**: Running a migration twice should produce the same result as running it once.

#### Idempotency Patterns

**✅ Good: Idempotent Table Creation**
```sql
CREATE TABLE IF NOT EXISTS my_table (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

**✅ Good: Idempotent Column Addition**
```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'activities' AND column_name = 'new_column'
  ) THEN
    ALTER TABLE activities ADD COLUMN new_column text;
  END IF;
END $$;
```

**✅ Good: Idempotent Index Creation**
```sql
CREATE INDEX IF NOT EXISTS idx_activities_tenant_time 
ON activities (tenant_id, received_at DESC);
```

**✅ Good: Idempotent RLS Policy**
```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'activities' AND policyname = 'activities_tenant_policy'
  ) THEN
    CREATE POLICY activities_tenant_policy ON activities 
    FOR SELECT USING (tenant_id = current_setting('app.tenant_id')::uuid);
  END IF;
END $$;
```

**❌ Bad: Non-Idempotent Operations**
```sql
-- DON'T DO THIS - Will fail on second run
CREATE TABLE my_table (id uuid PRIMARY KEY);
ALTER TABLE activities ADD COLUMN new_column text;
CREATE INDEX idx_activities_tenant ON activities(tenant_id);
CREATE POLICY activities_policy ON activities FOR SELECT USING (true);
```

#### Migration Verification

**Mandatory Step**: After every migration is completed, verify idempotency:

1. **Run Migration Twice**: Execute the migration, then run it again to ensure no errors occur.
2. **Check State Consistency**: Verify that the database state is identical after both runs.
3. **Test Rollback**: If rollback is provided, test that rollback works correctly.
4. **Document Verification**: Include verification queries in migration comments.

**Verification Query Examples**:
```sql
-- Include these in migration comments for verification:
-- SELECT * FROM information_schema.tables WHERE table_name = 'my_table';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'new_column';
-- SELECT indexname FROM pg_indexes WHERE tablename = 'activities' AND indexname = 'idx_activities_tenant_time';
-- SELECT policyname FROM pg_policies WHERE tablename = 'activities' AND policyname = 'activities_tenant_policy';
```

#### Other Migration Requirements

- **Version Control**: All schema changes must be in migration files in `infra/supabase/migrations/`.
- **Naming Convention**: Use sequential numbering and descriptive names: `0001_create_core_tables.sql`, `0002_add_activity_indexes.sql`, etc.
- **Rollback Safety**: Write migrations that can be rolled back safely. Include rollback logic when possible.
- **RLS Policies**: Include RLS policy creation/updates in migrations, not in application code. Always use idempotent patterns.
- **Transaction Safety**: Wrap migrations in transactions when possible to ensure atomicity.
- **Documentation**: Include comments explaining what the migration does and why it's needed.

## Frontend Patterns

### Next.js App Router
- **Server Components by Default**: Use Server Components unless interactivity is required.
- **Client Components**: Mark components with `"use client"` only when necessary (state, event handlers, browser APIs).
- **API Routes**: Use Next.js API routes for server-side operations. Never expose Supabase service role keys to the client.

### State Management
- **Server State**: Use React Server Components and Server Actions for server state.
- **Client State**: Use React hooks (`useState`, `useReducer`) for local UI state.
- **Shared State**: Consider SWR or React Query for client-side data fetching with caching.

## Testing Philosophy

- **Real Services**: Prefer integration tests with real Supabase test database over unit tests with mocks.
- **Test Data**: Use factories or fixtures to create test data, but connect to real services.
- **Error Scenarios**: Test error paths explicitly (missing env vars, network failures, invalid data).

## Git Operations

**Critical Rule**: All Git operations must include Jira ticket IDs for traceability and time tracking.

### Branch Naming

Use prefixes followed by Jira ID and descriptive name:
- `feature/ITPLAT01-1234-my-cool-feature`
- `fix/ITPLAT01-1234-resolve-auth-bug`
- `patch/ITPLAT01-1234-security-update`
- `chore/ITPLAT01-1234-update-dependencies`

**Format**: `{type}/{JIRA-ID}-{kebab-case-description}`

### Commit Messages

Every commit must include the Jira ID in brackets and use time tracking:
```
[ITPLAT01-1234] Summarize the work and give helpful descriptions #time: 1d
```

**Components**:
- `[ITPLAT01-1234]` - Jira ticket ID in brackets
- Descriptive summary of changes
- `#time: {duration}` - Time tracking using smart commits format (e.g., `1d`, `2h`, `30m`)

**Examples**:
```
[ITPLAT01-1234] Add Supabase client initialization with error handling #time: 2h
[ITPLAT01-1234] Implement RLS policies for activities table #time: 1d
[ITPLAT01-1234] Fix Microsoft Graph connector authentication flow #time: 3h
```

### Pull Request Titles

Use the same format as commit messages:
```
[ITPLAT01-1234] Implement Focus Pager notification system #time: 2d
```

**Best Practices**:
- Keep PR titles concise but descriptive
- Include time estimate for the entire PR
- Reference Jira ticket in description for full context
- Link related tickets if work spans multiple issues

## Tooling & Integration

### Integration Priority for External Services

**Preference Order**:
1. **MCP Servers First (for Slack & Microsoft 365)**: For Slack and Microsoft 365 data fetching, MCP servers are the **preferred** method
   - **Slack**: Use official Slack MCP server (when available) or community implementations
     - Official Slack MCP server: Currently in partner rollout, provides search, message retrieval/sending, canvas management, user management
     - Check availability: https://docs.slack.dev/ai/mcp-server
   - **Microsoft 365**: Use `@softeria/ms-365-mcp-server` for comprehensive Microsoft 365 access
     - Provides access to Outlook (email), Teams (chats/channels), Calendar, OneDrive, SharePoint, and more
     - Supports organization mode for Teams and work account features
     - Installation: `npx @softeria/ms-365-mcp-server --org-mode`
     - Documentation: https://github.com/Softeria/ms-365-mcp-server
   - **Why MCP Servers**: Standardized protocol, built-in authentication handling, structured tooling, better error handling

2. **Command-Line Tools**: For infrastructure and deployment operations
   - Supabase CLI (`supabase`) for database operations
   - Vercel CLI (`vercel`) for deployments
   - GitHub CLI (`gh`) for repository operations
   - Platform-specific CLIs (AWS CLI, Azure CLI, etc.)

3. **Direct API Calls**: Only use direct API calls when:
   - No MCP server exists for the service
   - MCP server doesn't support required functionality
   - CLI tool doesn't exist and MCP server is not applicable

### MCP Server Usage for 80HD

**Critical Rule**: For Slack and Microsoft 365 data ingestion, **always check for MCP server availability first** before implementing direct API integrations.

#### Slack Integration
- **Preferred**: Slack MCP server (official or community)
- **Fallback**: Slack Web API (`@slack/web-api`) only if MCP server unavailable or missing required features
- **Documentation**: Check Slack MCP server capabilities before implementing direct API calls

#### Microsoft 365 Integration
- **Preferred**: `@softeria/ms-365-mcp-server` for all Microsoft 365 operations
  - Email (Outlook): `list-mail-messages`, `get-mail-message`, `send-mail`, etc.
  - Teams: `list-chats`, `list-chat-messages`, `list-team-channels`, `list-channel-messages`, etc.
  - Calendar: `list-calendar-events`, `get-calendar-event`, etc.
  - **Organization Mode**: Use `--org-mode` flag for Teams and work account features
- **Fallback**: Microsoft Graph API (`@microsoft/microsoft-graph-client`) only if:
  - MCP server doesn't support specific required operation
  - MCP server has limitations that prevent required functionality
- **Authentication**: MCP server handles OAuth flows automatically; prefer this over manual token management

### Examples

**✅ Good: Using MCP Servers for Data Fetching**
```typescript
// DO THIS - Use MCP server for Microsoft 365 data
// Configure: npx @softeria/ms-365-mcp-server --org-mode
// Access Teams messages, Outlook email, Calendar events via MCP tools

// DO THIS - Use Slack MCP server when available
// Access Slack channels, messages, users via MCP tools
```

**✅ Good: Using CLI Tools for Infrastructure**
```bash
# Database migrations
supabase db push

# Deployments
vercel deploy --prod

# Repository operations
gh pr create --title "[ITPLAT01-1234] Add feature" --body "Description"
```

**❌ Bad: Direct API Calls When MCP Server Exists**
```typescript
// DON'T DO THIS - Using Microsoft Graph API directly when MCP server available
import { Client } from '@microsoft/microsoft-graph-client';
// Use: @softeria/ms-365-mcp-server instead

// DON'T DO THIS - Using Slack Web API directly when MCP server available
import { WebClient } from '@slack/web-api';
// Use: Slack MCP server instead
```

**✅ Good: Fallback to Direct API When MCP Unavailable**
```typescript
// DO THIS - Only when MCP server doesn't support required operation
// Document why MCP server cannot be used
// TODO: Migrate to MCP server when feature becomes available
import { WebClient } from '@slack/web-api';
```

## .claude/ Automation System

The project includes a comprehensive automation system in `.claude/` that helps maintain documentation and streamline workflows:

### Agents

**knowledge-maintainer** (`.claude/agents/knowledge-maintainer.md`):
- Autonomous documentation agent
- Auto-triggered after code changes via hooks
- Updates documentation in `docs/architecture/` to reflect code changes
- Maintains consistency between code and documentation

**Usage:**
```typescript
// After making significant code changes:
// The hook system will suggest running knowledge-maintainer
// You can also invoke it manually via the Task tool with subagent_type="knowledge-maintainer"
```

### Hooks

**trigger-docs-update.sh** (`.claude/hooks/trigger-docs-update.sh`):
- PostToolUse hook - triggers after Write or Edit tool calls
- Monitors code changes in TypeScript, Python, SQL, and JSON files
- Suggests running knowledge-maintainer subagent when appropriate
- **Excluded paths** (to prevent infinite loops):
  - Files in `/docs/` directory
  - `README.md`, `AGENTS.md`, `CLAUDE.md`

### Skills

Available via `/skill-name` commands (see `.claude/skills/`):

- **`/sync-linear-jira`** - Sync Linear issues to Jira with natural language instructions
  - Files: `SKILL.md`, `EXAMPLES.md`, `GRAPHQL.md`, `IDEMPOTENCY.md`, `SYNC-WORKFLOW.md`, `REVERSE-SYNC.md`
  - Use when syncing projects, milestones, issues between Linear and Jira

- **`/github-activity-summary`** - Summarize commits and PRs across team repos
  - Use when asked "who's doing what" or "team activity"

- **`/two-claude-review`** - Two-Claude pattern for plan review
  - Uses one Claude to write plans, subagent to review as staff engineer
  - Use for complex features or architectural decisions

- **`/project-context`** - Load deep project context
  - Core project context for documentation agents

- **`/provisioning-bedrock`** - Provision AWS Bedrock API keys
  - Supports short-term tokens (12h, auto-refresh) and long-term IAM keys

- **`/provisioning-vertex`** - Provision GCP Vertex AI projects
  - Dead simple setup with API keys and environment configuration

### When to Use Automation

**Use skills when:**
- Task matches a specialized workflow (syncing Linear/Jira, team activity summaries)
- You need deep project context
- User explicitly requests a skill with `/skill-name`

**Let hooks work automatically:**
- Hooks trigger automatically - no manual intervention needed
- If hook suggests knowledge-maintainer, evaluate whether docs need updating
- Hook exclusions prevent infinite loops for documentation files

**Invoke agents manually when:**
- You need to update documentation after major changes
- Knowledge-maintainer should review architectural changes
- Testing new documentation patterns

## Code Review Checklist

Before submitting code, ensure:
- [ ] All files are under 500 lines
- [ ] No mock data in production code paths
- [ ] All errors are explicit and actionable
- [ ] TypeScript types are properly defined
- [ ] Zod schemas validate all external data
- [ ] All AI/LLM operations use Vercel AI SDK (`ai` package), not provider-specific SDKs
- [ ] Streaming responses use `streamText` from AI SDK when appropriate
- [ ] Structured outputs use `generateObject` with Zod schemas
- [ ] No hardcoded secrets or credentials
- [ ] All database migrations are idempotent (use IF NOT EXISTS, IF EXISTS, etc.)
- [ ] Migration idempotency has been verified (run twice, check state consistency)
- [ ] Migration verification queries are included in migration comments
- [ ] RLS policies are considered for all database queries
- [ ] RLS policies use idempotent creation patterns
- [ ] Git branch name includes Jira ID (e.g., `feature/ITPLAT01-1234-description`)
- [ ] Commit messages include Jira ID and time tracking (e.g., `[ITPLAT01-1234] Message #time: 2h`)
- [ ] PR title includes Jira ID and time estimate
- [ ] MCP servers checked and used for Slack and Microsoft 365 data fetching (preferred method)
- [ ] Direct API calls only used when MCP server unavailable or missing required functionality
- [ ] MCP server usage documented with TODO if fallback to direct API is necessary
- [ ] CLI tools used when available (Supabase CLI, Vercel CLI, etc.)
- [ ] Environment variables are documented in `.env.example`
- [ ] Error messages explain what failed and how to fix it

## Examples

### ❌ Bad: Mock Data in Production Code
```typescript
// DON'T DO THIS
export function getActivities() {
  // TODO: Connect to Supabase
  return [
    { id: '1', message: 'Mock activity' }
  ];
}
```

### ✅ Good: Real Integration with Clear Errors
```typescript
// DO THIS
export async function getActivities(supabase: SupabaseClient, tenantId: string) {
  if (!supabase) {
    throw new Error('Supabase client not initialized. Ensure SUPABASE_URL and SUPABASE_ANON_KEY are set.');
  }
  
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('tenant_id', tenantId);
    
  if (error) {
    throw new Error(`Failed to fetch activities: ${error.message}. Check RLS policies and database connection.`);
  }
  
  return data ?? [];
}
```

### ❌ Bad: File Too Long
```typescript
// 800-line file with everything mixed together
```

### ✅ Good: Modular, Focused Files
```typescript
// connectors/microsoft365.ts (200 lines)
// connectors/slack.ts (170 lines)
// normalizer/activity-normalizer.ts (150 lines)
// Each file has a single, clear responsibility
```

### ❌ Bad: Non-Idempotent Migration
```sql
-- DON'T DO THIS - Migration will fail on second run
-- File: infra/supabase/migrations/0002_add_index.sql

CREATE INDEX idx_activities_tenant ON activities(tenant_id);
ALTER TABLE activities ADD COLUMN priority_score numeric;
CREATE POLICY activities_policy ON activities FOR SELECT USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

### ✅ Good: Idempotent Migration with Verification
```sql
-- DO THIS - Safe to run multiple times
-- File: infra/supabase/migrations/0002_add_index.sql
-- Migration: Add tenant index and priority score column
-- Verification: Run this migration twice and verify state is identical

-- Idempotent index creation
CREATE INDEX IF NOT EXISTS idx_activities_tenant 
ON activities(tenant_id);

-- Idempotent column addition
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'activities' AND column_name = 'priority_score'
  ) THEN
    ALTER TABLE activities ADD COLUMN priority_score numeric(5,4);
  END IF;
END $$;

-- Idempotent RLS policy creation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'activities' AND policyname = 'activities_policy'
  ) THEN
    CREATE POLICY activities_policy ON activities 
    FOR SELECT USING (tenant_id = current_setting('app.tenant_id')::uuid);
  END IF;
END $$;

-- Verification queries (run these after migration to confirm idempotency):
-- SELECT indexname FROM pg_indexes WHERE tablename = 'activities' AND indexname = 'idx_activities_tenant';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'priority_score';
-- SELECT policyname FROM pg_policies WHERE tablename = 'activities' AND policyname = 'activities_policy';
```

### ❌ Bad: Git Operations Without Jira IDs
```bash
# DON'T DO THIS
git checkout -b add-feature
git commit -m "Added new feature"
gh pr create --title "New feature" --body "Description"
```

### ✅ Good: Git Operations With Jira IDs
```bash
# DO THIS
git checkout -b feature/ITPLAT01-1234-add-supabase-client
git commit -m "[ITPLAT01-1234] Add Supabase client initialization with error handling #time: 2h"
gh pr create --title "[ITPLAT01-1234] Implement Supabase client #time: 2h" --body "Description"
```

### ❌ Bad: Direct Provider SDK Usage
```typescript
// DON'T DO THIS - Using OpenAI SDK directly
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const completion = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Summarize this conversation' }],
});

// DON'T DO THIS - Using Anthropic SDK directly
import Anthropic from '@anthropic-ai/sdk';
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
```

### ✅ Good: Using Vercel AI SDK
```typescript
// DO THIS - Unified API with provider abstraction
import { generateText, streamText, generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

// Text generation
const { text } = await generateText({
  model: openai('gpt-4'),
  prompt: 'Summarize this conversation',
});

// Streaming for better UX
const { textStream } = await streamText({
  model: openai('gpt-4'),
  prompt: 'Explain the key points',
});

// Structured output with type safety
const { object } = await generateObject({
  model: openai('gpt-4'),
  schema: z.object({
    summary: z.string(),
    actionItems: z.array(z.string()),
  }),
  prompt: 'Extract key information',
});

// Easy provider switching - just change the import and model
// import { anthropic } from '@ai-sdk/anthropic';
// model: anthropic('claude-3-opus-20240229'),
```

### ❌ Bad: Direct API Calls When MCP Server Available
```typescript
// DON'T DO THIS - Using Microsoft Graph API directly
import { Client } from '@microsoft/microsoft-graph-client';

const client = Client.init({
  authProvider: async (done) => {
    // Manual token management
    done(null, accessToken);
  }
});

const messages = await client.api('/me/messages').get();
// Use: @softeria/ms-365-mcp-server MCP tools instead

// DON'T DO THIS - Using Slack Web API directly
import { WebClient } from '@slack/web-api';

const slack = new WebClient(process.env.SLACK_TOKEN);
const result = await slack.conversations.history({ channel: 'C123456' });
// Use: Slack MCP server instead
```

### ✅ Good: Using MCP Servers for External Data
```typescript
// DO THIS - Use MCP server for Microsoft 365
// Configure MCP server: npx @softeria/ms-365-mcp-server --org-mode
// Access via MCP tools: list-mail-messages, list-chat-messages, list-team-channels, etc.

// DO THIS - Use Slack MCP server when available
// Access via MCP tools: search Slack, read channels, retrieve messages, etc.

// DO THIS - Fallback to direct API only when MCP unavailable
// TODO: Migrate to MCP server when feature becomes available
// Reason: MCP server doesn't support [specific feature] yet
import { WebClient } from '@slack/web-api';
```

---

**Remember**: The goal is to build a production-ready system that fails fast, surfaces errors clearly, and maintains high code quality through modularity and type safety.

