# Sync Workflow: Best Practices & Efficient Execution

## Overview

This document defines the efficient, best-practice workflow for syncing between Linear, JIRA, and GitHub based on:
- Real sync experience (2026-01-25 test run)
- MCP server best practices from Anthropic
- Tool chaining patterns for multi-server operations

## Key Learnings from Test Run

### Issue: Linear Issues Were Missing
- JIRA Epic and Tasks already existed (ITPLAT01-1673, 1678-1680)
- GitHub Issues already existed (#1, #2, #3)
- **Linear issues were missing** - had to create ECI-33, ECI-34, ECI-35

**Root Cause**: Previous sync created JIRA/GitHub without creating Linear issues first.

**Solution**: Always check Linear FIRST. Linear is the source of truth for planning.

## MCP Best Practices Applied

### 1. Tool Budget Management

**Principle**: Load only the tools needed for the current operation.

**Implementation**:
- Don't load all Linear, JIRA, and GitHub tools at once
- Use ToolSearch to load specific tools on-demand
- Example: Load `linear_search_issues` before `linear_create_issue`

**Token Savings**: Can reduce context from ~150K to ~2K tokens (98.7% reduction)

### 2. Tool Chaining Pattern

**Pattern**: Cross-server sequential chaining
```
Linear (source) → JIRA (PMO view) → GitHub (dev workspace) → Update Linear (close loop)
```

**Best Practice**: Use clear namespacing
- ✓ `mcp__linear__linear_create_issue`
- ✓ `mcp__atlassian__jira_create_issue`
- ✓ `mcp__github__create_issue`

### 3. Error Handling & Retry Logic

**Principle**: Implement retry for transient failures, circuit breaking for unavailable servers.

**Implementation**:
```python
try:
    result = mcp__linear__linear_create_issue(...)
except MCP_SERVER_UNAVAILABLE:
    # Circuit breaker: Skip Linear sync, continue with JIRA/GitHub
    log_warning("Linear MCP unavailable, continuing with JIRA/GitHub only")
except TRANSIENT_ERROR:
    # Retry with exponential backoff
    retry_with_backoff(mcp__linear__linear_create_issue, max_retries=3)
```

### 4. Health Checks

**Best Practice**: Verify all MCP servers are available before starting bulk operations.

**Pre-Sync Check**:
1. Test Linear MCP: `linear_get_teams()` (lightweight query)
2. Test JIRA MCP: `jira_get_project_versions(project_key)` (cached)
3. Test GitHub MCP: `get_repository(owner, repo)` (quick metadata)

If any server is down, inform user and offer degraded mode.

### 5. Idempotency Across All Platforms

**Critical**: Check for existing items in ALL platforms before creating.

## Efficient Sync Workflow

### Phase 1: Discovery (Minimize API Calls)

```
1. Get Linear project via MCP (cached)
2. Get Linear milestones via GraphQL (MCP doesn't support)
3. Search Linear issues for milestone (single query with filter)
4. Get JIRA version via MCP (single query)
5. Search JIRA Epic via JQL (single query)
6. Search JIRA tasks via JQL with Epic Link filter (single query)
7. Search GitHub issues via title prefix (single query)
```

**Optimization**: Use batch queries where possible to reduce round trips.

### Phase 2: Gap Analysis

**Determine what's missing**:
```javascript
const gaps = {
  linearIssues: milestoneTasksFromDescription.filter(task =>
    !existingLinearIssues.some(issue => issue.title.includes(task.title))
  ),
  jiraTasks: linearIssues.filter(issue =>
    !existingJiraTasks.some(task => task.description.includes(issue.identifier))
  ),
  githubIssues: jiraTasks.filter(task =>
    !existingGithubIssues.some(issue => issue.title.includes(task.key))
  )
}
```

### Phase 3: Create Missing Items (Forward Sync)

**Order matters**: Linear → JIRA → GitHub → Update Linear

```
For each missing task:
  1. Create Linear issue (if missing)
     - Associate with milestone
     - Initial description without cross-refs

  2. Create JIRA task (if missing)
     - Link to Epic via jira_link_to_epic
     - Set fixVersions to project version
     - Add Linear URL to description

  3. Create GitHub issue (if missing)
     - Title: [JIRA-KEY] task title
     - Body: description + Linear/JIRA cross-refs

  4. Update Linear issue with JIRA/GitHub links (GraphQL mutation)
     - Add JIRA link
     - Add GitHub link
```

### Phase 4: Verify Linkage

**Quality Check**:
```
For each Linear issue:
  ✓ Has JIRA link in description
  ✓ Has GitHub link in description

For each JIRA task:
  ✓ Has Linear link in description
  ✓ Has GitHub link in description
  ✓ Linked to Epic
  ✓ Associated with Version

For each GitHub issue:
  ✓ Has [JIRA-KEY] prefix in title
  ✓ Has JIRA link in body
  ✓ Has Linear link in body
```

## Reverse Sync Workflow (GitHub → Linear → JIRA)

### Trigger: On-demand or Scheduled

**Command**: `/sync-linear-jira reverse-sync repo eci-global/gitops`

### Efficient Pattern

```
1. List GitHub issues with JIRA prefix (single query with filter)
   gh issue list --repo eci-global/gitops --search "[ITPLAT01-" --json number,title,state

2. For each issue, extract JIRA key from title (no API call)

3. Batch get JIRA tasks (single query per 50 tasks)
   jira_search(jql="key IN (ITPLAT01-1678, ITPLAT01-1679, ...)")

4. Batch get Linear issues via GraphQL (single query)
   Extract Linear URLs from JIRA descriptions
   Query Linear issues by IDs

5. Compare states and update only changed items
   Only call update APIs for items with state mismatches
```

**Optimization**: Group updates into batches to minimize API calls.

## MCP Server Configuration

### Recommended Priority Order

```json
{
  "mcpServers": {
    "linear": { ... },      // Most frequently used (source of truth)
    "atlassian": { ... },   // Second (PMO tracking)
    "github": { ... }       // Third (dev workspace)
  }
}
```

**Rationale**: MCP clients resolve tools in configuration order. List most-used servers first.

### Environment Variables

**Current (Correct)**:
- `LINEAR_API_KEY` ✓
- `ATLASSIAN_EMAIL` ✓
- `ATLASSIAN_API_TOKEN` ✓
- `ATLASSIAN_DOMAIN` ✓
- `GITHUB_TOKEN` ✓

**Security**: Use `.env` for local, secrets manager for production. Never commit tokens.

## Error Handling Patterns

### Scenario 1: Linear MCP Unavailable

```
Action: Continue with JIRA/GitHub sync only
Warning: "Linear MCP unavailable. JIRA/GitHub will be updated but Linear issues won't be created."
Recovery: Retry Linear sync when server is back
```

### Scenario 2: JIRA API Rate Limit

```
Action: Exponential backoff with retry
Max retries: 3
Backoff: 1s, 2s, 4s
Fallback: Queue for later batch processing
```

### Scenario 3: GitHub Issue Already Exists

```
Action: Update existing issue instead of creating
Verify: JIRA key prefix in title
Update: Add/restore cross-references if missing
```

## Performance Metrics

### Target Performance

| Operation | Target | Notes |
|-----------|--------|-------|
| Discover existing items | < 5 API calls | Use batch queries, filters |
| Create 10 issues | < 40 API calls | 1 Linear + 1 JIRA + 1 GitHub + 1 update per issue |
| Reverse sync 50 issues | < 10 API calls | Batch GitHub list, batch JIRA get, batch Linear query |
| Full sync 1 milestone | < 2 minutes | 5 tasks typical |

### Current Performance (2026-01-25 Test)

- **Discovery**: 6 API calls ✓
- **Create 3 Linear issues**: 1 batch call ✓
- **Update 3 Linear issues**: 3 GraphQL calls (could batch)
- **Delete 1 duplicate JIRA**: 1 call
- **Total**: ~15 API calls for 3-issue sync ✓ Good

**Improvement Opportunity**: Batch Linear updates into single GraphQL mutation.

## Token Usage Optimization

### Before (Naive Approach)
```
- Load all Linear tools: 30K tokens
- Load all JIRA tools: 50K tokens
- Load all GitHub tools: 40K tokens
- Context: 30K tokens
Total: 150K tokens
```

### After (On-Demand Loading)
```
- Load only needed tools via ToolSearch: 2K tokens
- Context: 30K tokens
Total: 32K tokens (78% reduction)
```

**Implementation**: Use ToolSearch at start of each phase to load only required tools.

## Best Practice Checklist

### Before Sync
- [ ] Verify all MCP servers are available (health check)
- [ ] Load only required tools via ToolSearch
- [ ] Get user confirmation for bulk operations (>10 items)

### During Sync
- [ ] Check for existing items BEFORE creating (Linear, JIRA, GitHub)
- [ ] Create in correct order: Linear → JIRA → GitHub → Update Linear
- [ ] Use batch operations where available
- [ ] Log all API calls for debugging
- [ ] Handle errors gracefully with retries

### After Sync
- [ ] Verify bidirectional linkage
- [ ] Report metrics (items created, updated, skipped)
- [ ] Clean up any duplicates created

## Anti-Patterns to Avoid

❌ **Creating JIRA/GitHub before checking Linear**
- Always check Linear first (source of truth)

❌ **Not checking for existing items**
- Always search before create to avoid duplicates

❌ **Loading all MCP tools at once**
- Use ToolSearch on-demand to minimize token usage

❌ **Individual API calls instead of batch**
- Use JQL `key IN (...)` for JIRA, GraphQL for Linear batching

❌ **Ignoring MCP server failures**
- Implement circuit breakers and retry logic

❌ **Not verifying cross-references**
- Always validate links after creation

## References

- [MCP Server Best Practices - Docker](https://www.docker.com/blog/mcp-server-best-practices/)
- [Scaling AI with Multiple MCP Servers](https://www.getknit.dev/blog/scaling-ai-capabilities-using-multiple-mcp-servers-with-one-agent)
- [MCP Security Best Practices](https://modelcontextprotocol.io/specification/draft/basic/security_best_practices)
- [Tool Chaining Patterns](https://deepwiki.com/iddv/mcp-example/8.2-tool-chaining)
- [Code Execution with MCP - Anthropic](https://www.anthropic.com/engineering/code-execution-with-mcp)
