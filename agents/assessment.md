# Agent Automation Framework - Repository Assessment

## Date: 2025-01-29

## Plan Specs Inventory

### Primary Plan File
- **Location**: `/80.plan.md` (root level)
- **Format**: Markdown with structured Q&A format
- **Content**: 12 implementation questions (Q1-Q12) organized by category
- **Status**: All items marked as completed (✅) in implementation priority phases
- **Structure**: 
  - Category 1: Critical Code Fixes (Q1-Q5)
  - Category 2: Architecture & Configuration (Q6-Q7)
  - Category 3: Testing & Monitoring (Q8-Q9)
  - Category 4: UX & Data Format (Q10)
  - Category 5: Documentation & Configuration (Q11-Q12)

### Plan Entry Format
Each plan entry contains:
- Question/Issue description
- Action type (IMPLEMENT, DOCUMENT, VERIFY, STANDARDIZE)
- File paths to create/modify
- Implementation details
- Error handling requirements
- Testing requirements

### Key Patterns Identified
- Tasks reference specific files and line numbers
- Success criteria are explicit (e.g., "create escalation for critical/important")
- Error messages must follow fail-fast pattern with actionable guidance
- Integration points clearly defined (queue worker, Edge Functions, etc.)

## AGENTS.md Policy Inventory

### Critical Rules to Codify

1. **No Mocking Policy** (Lines 29-56)
   - Block patterns: `TODO: mock`, `return [{`, hardcoded data arrays
   - Require: Real integrations, fail-fast errors
   - Exception: Unit tests only

2. **Fail-Fast Error Messages** (Lines 36-39)
   - Must include: What failed, why failed, how to fix
   - Pattern: Descriptive error with actionable steps

3. **Vercel AI SDK Only** (Lines 110-214)
   - Block: Direct provider SDKs (OpenAI, Anthropic)
   - Require: `ai` package with provider abstractions
   - Exception: Embeddings only if AI SDK doesn't support

4. **MCP-First Integration** (Lines 382-423)
   - Preferred: MCP servers for Slack and Microsoft 365
   - Fallback: Direct API only if MCP unavailable
   - Require: TODO comment explaining fallback reason

5. **File Size Limit** (Line 14)
   - Maximum: 500 lines per file
   - Action: Refactor if exceeded

6. **Idempotent Migrations** (Lines 224-312)
   - Require: `IF NOT EXISTS`, `IF EXISTS`, conditional checks
   - Verify: Run migration twice, check state consistency

7. **Git Operations** (Lines 333-375)
   - Require: Jira ticket ID in branch names and commits
   - Format: `feature/ITPLAT01-1234-description`
   - Time tracking: `#time: 1d` in commit messages

8. **Environment Variables** (Line 71)
   - Require: Document all variables in `.env.example`
   - Never commit: `.env.local` or secrets

9. **TypeScript Only** (Line 7)
   - Block: JavaScript files (except legacy configs)
   - Require: Strict type safety, Zod validation

10. **RLS & Security** (Lines 60-73)
    - Require: RLS policies for all queries
    - Block: Service role keys in client code
    - Require: Tenant isolation via `tenant_id`

## Current Tooling Assessment

### Package Management
- **Tool**: pnpm workspace (v9.7.0)
- **Structure**: Monorepo with apps/, packages/, infra/
- **Scripts**: `dev`, `lint`, `test` (workspace-level)

### Language Stack
- **Primary**: TypeScript (strict mode)
- **Runtime**: Node 20 LTS, Deno (Edge Functions)
- **Testing**: Vitest
- **Linting**: Biome (apps/api), ESLint (apps/web)

### Python Dependencies
- **Status**: None currently installed
- **Requirement**: Need to add Python 3.11+ for agent automation
- **Recommendation**: Create `agents/requirements.txt` for dependencies

### Git Configuration
- **Worktree Support**: Available (Git 2.5+)
- **Branch Naming**: Enforced via AGENTS.md (Jira ID required)
- **Commit Format**: Enforced via AGENTS.md (Jira ID + time tracking)

### Cursor SDK Integration
- **Status**: Available via Cursor IDE
- **Capabilities**: 
  - File operations (read_file, write, edit)
  - Terminal commands (run_terminal_cmd)
  - Code search (codebase_search, grep)
  - MCP tools (Supabase, Slack, Microsoft 365)
- **Model Selection**: Configurable per agent role

### MCP Server Status
- **Supabase**: Available (tested - can get project URL and keys)
- **Slack**: Not yet configured (per AGENTS.md, preferred method)
- **Microsoft 365**: Not yet configured (per AGENTS.md, preferred method)

## Directory Structure Analysis

### Existing Structure
```
/
├─ apps/              # Application code (api, web)
├─ packages/          # Shared packages
├─ infra/             # Infrastructure (Supabase migrations)
├─ docs/              # Documentation
├─ supabase/          # Supabase Edge Functions
├─ tests/             # Test files
└─ [root files]       # Config files, AGENTS.md, 80.plan.md
```

### Proposed Addition
```
agents/               # NEW: Agent automation framework
├─ __init__.py
├─ control.py         # CLI orchestrator
├─ config/            # Configuration files
├─ spec/              # Plan spec loaders
├─ pipeline/          # Agent implementations
├─ worktree/          # Git worktree management
├─ observability/     # Logging and telemetry
└─ utils/             # Shared utilities
```

## Key Requirements Extracted

### From Plan Specs
1. Tasks reference specific files and line numbers
2. Success criteria are explicit and testable
3. Error handling must follow fail-fast pattern
4. Integration points must be verified (queue worker, Edge Functions)

### From AGENTS.md
1. No mocking in production code (block patterns)
2. Fail-fast errors with actionable messages
3. Vercel AI SDK only (block direct provider SDKs)
4. MCP-first for external services (Slack, Microsoft 365)
5. File size limits (500 lines max)
6. Idempotent migrations
7. Git operations with Jira IDs
8. Environment variable documentation
9. TypeScript only
10. RLS and security enforcement

### From Tooling Assessment
1. Python 3.11+ required for agent framework
2. Git worktree support available
3. Cursor SDK available for file/terminal operations
4. MCP servers partially configured (Supabase available)
5. pnpm workspace for dependency management

## Next Steps

1. **Define Structure**: Create `agents/` directory layout with modules
2. **Codify Policies**: Translate AGENTS.md rules into `agents/config/policies.json`
3. **Build Spec Loader**: Parse `/80.plan.md` into structured task objects
4. **Implement Orchestrator**: Create `agents/control.py` CLI

