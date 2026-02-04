# Feedback Aggregation

**Purpose:** Aggregate comments and feedback from across all connected platforms into a single view.

This extends the `discover` subcommand with a `--comments` flag to show recent feedback alongside initiative status.

## Usage

```bash
# Show comments from last 7 days
/sync-linear-jira discover GitOps --comments

# Show comments since specific date
/sync-linear-jira discover GitOps --comments --since=2026-01-25

# Show only pending responses (questions without my reply)
/sync-linear-jira discover GitOps --comments --pending
```

## Output Format

### Basic Comments Output (--comments)

```markdown
# GitOps Feedback - Last 7 Days

## Pending Responses (2)
Questions without your reply - respond promptly!

| Platform | Item | Author | Comment | Age |
|----------|------|--------|---------|-----|
| JIRA | ITPLAT01-1749 | PMO Lead | "When is the deadline?" | 1d |
| GitHub | Issue #55 | John D. | "Question about scope?" | 5h |

## Recent Comments (6)

### GitHub (3 comments)
- **PR #67**: Jane S. - "Approved with suggestions" (2h ago)
- **Issue #55**: John D. - "Question about scope?" (5h ago)
- **Discussion**: Alex M. - "What about ADO teams?" (1d ago)

### JIRA (1 comment)
- **ITPLAT01-1749**: PMO Lead - "When is the deadline?" (1d ago)

### Confluence (2 comments)
- **Outcomes Checklist**: Stakeholder A - "Suggest adding..." (3h ago)
- **CCOE Page**: Ted Edgar - Posted collaboration comment (2d ago)

## Quick Links
- GitHub Notifications: https://github.com/notifications
- JIRA Filter: https://eci-solutions.atlassian.net/issues/?filter=...
- Confluence: https://eci-solutions.atlassian.net/wiki/spaces/CGIP

**Note:** Teams channel messages not included - check manually via Teams UI.
```

## Data Sources and Tools

| Platform | What | Tool | Notes |
|----------|------|------|-------|
| GitHub PRs | Review comments | `gh api repos/{owner}/{repo}/pulls/{pr}/comments` | Via Bash |
| GitHub PRs | Reviews | `gh api repos/{owner}/{repo}/pulls/{pr}/reviews` | Via Bash |
| GitHub Issues | Issue comments | `gh api repos/{owner}/{repo}/issues/{issue}/comments` | Via Bash |
| GitHub Discussions | Discussion replies | `gh api graphql` (discussions query) | Via Bash |
| JIRA | Task comments | `mcp__atlassian__jira_get_issue` | Comments in response |
| Confluence | Page comments | `mcp__atlassian__confluence_get_comments` | Requires page_id |
| MS Teams | Channel messages | Manual check via Teams UI | MCP integration requires excessive permissions (see Security note below) |

### Security Note: MS Teams Integration

**Current status:** Teams channel messages are NOT included in automated `--comments` aggregation.

**Why:** Available third-party MS 365 MCP servers (e.g., `@softeria/ms-365-mcp-server`) request excessive OAuth permissions including:
- Send mail as user / on behalf of others
- Send Teams/chat messages
- Create/modify OneNote notebooks
- Read/write all groups
- Modify user files

For read-only feedback monitoring, we only need `ChannelMessage.Read.All` and `Team.ReadBasic.All`.

**Alternatives:**
1. **Manual Teams checking** (current approach) - Check Teams channel via UI during morning routine
2. **Custom Azure AD app** - Request IT to create app with read-only Teams permissions
3. **Wait for official Microsoft Teams MCP** - Microsoft is developing official MCP servers with proper scoping

If Teams integration is critical, work with your IT/Security team to register a custom Azure AD application with minimal read-only permissions.

## Workflow Phases

### Phase 1: Collect Platform References

Before fetching comments, discover collects references from the initiative:

1. **From Linear externalLinks:**
   - GitHub Repo URL → extract owner/repo
   - JIRA Parent ID → extract epic key
   - JIRA Project ID → extract project key

2. **From JIRA discovery:**
   - List of task keys (ITPLAT01-XXXX)
   - List of epic keys

3. **From Confluence discovery:**
   - Parent page ID
   - Child page IDs (limit 5 most recent)

### Phase 2: Fetch Comments

**GitHub Comments (via gh CLI):**

```bash
# PR comments (review comments on code)
gh api repos/{owner}/{repo}/pulls/{pr}/comments --jq '.[] | {author: .user.login, body: .body, created_at: .created_at}'

# PR reviews (approve/request changes)
gh api repos/{owner}/{repo}/pulls/{pr}/reviews --jq '.[] | {author: .user.login, body: .body, state: .state, created_at: .submitted_at}'

# Issue comments
gh api repos/{owner}/{repo}/issues/{issue}/comments --jq '.[] | {author: .user.login, body: .body, created_at: .created_at}'

# Discussions (GraphQL)
gh api graphql -f query='
  query {
    repository(owner: "{owner}", name: "{repo}") {
      discussions(first: 10, orderBy: {field: UPDATED_AT, direction: DESC}) {
        nodes {
          title
          comments(first: 10) {
            nodes {
              author { login }
              body
              createdAt
            }
          }
        }
      }
    }
  }
'
```

**JIRA Comments (via MCP):**

```
mcp__atlassian__jira_get_issue(issue_key="ITPLAT01-1749")
# Response includes: fields.comment.comments[]
```

**Confluence Comments (via MCP):**

```
mcp__atlassian__confluence_get_comments(page_id="1744666626")
# Response includes: results[].body.storage.value, results[].version.by.displayName
```

### Phase 3: Filter and Classify

**Time filtering:**
- Default: Last 7 days
- With `--since=YYYY-MM-DD`: Since specified date

**Question detection (simple heuristic):**
```
isQuestion = comment.body.trim().endsWith('?')
```

**Pending response detection:**
```
isPending = isQuestion && !hasReplyFromMe(comment, myUsernames)
```

Where `myUsernames` is configured per platform (see Configuration section).

### Phase 4: Format Output

1. **Pending Responses section** (if --pending or any pending exists)
   - Show questions without my reply first
   - Sorted by age (oldest first - they've been waiting longest)

2. **Recent Comments section**
   - Grouped by platform
   - Sorted by recency (newest first)
   - Truncate long comments to 100 chars

3. **Quick Links section**
   - Direct links to each platform's notification/filter view

## Configuration

### Username Configuration

To detect "pending responses" (questions you haven't replied to), configure your username on each platform.

**Location:** `~/.claude/sync-linear-jira-config.json`

```json
{
  "usernames": {
    "github": "tedgar",
    "jira": "tedgar@eci-solutions.com",
    "confluence": "tedgar@eci-solutions.com"
  }
}
```

**Without configuration:**
- Question detection still works (shows all questions)
- "Pending" classification disabled (all questions shown equally)
- Warning displayed: "Configure usernames in ~/.claude/sync-linear-jira-config.json for pending response detection"

### Quick Link Configuration

**Location:** Same config file

```json
{
  "quickLinks": {
    "jiraFilter": "https://eci-solutions.atlassian.net/issues/?filter=12345",
    "confluenceSpace": "https://eci-solutions.atlassian.net/wiki/spaces/CGIP"
  }
}
```

## Scope Constraints

**Phase 2a (this implementation):**
- READ-ONLY (no replying inline)
- No state tracking (always fetches fresh)
- Limit Confluence to top 5 most recent pages
- Simple question heuristic (ends in `?`)
- No LLM-based classification

**Future enhancements (Phase 2b+):**
- LLM-based question/request classification
- "Mark as handled" tracking
- Response templates
- Email digest delivery

## Error Handling

| Error | Behavior |
|-------|----------|
| GitHub API rate limit | Show cached data if available, warn user |
| JIRA MCP unavailable | Skip JIRA comments with note |
| Confluence MCP unavailable | Skip Confluence comments with note |
| No comments found | Show "No comments in the last 7 days" |
| No usernames configured | Disable pending detection, show warning |

## Examples

### Example 1: Morning Check-in

```bash
/sync-linear-jira discover GitOps --comments
```

Output shows all feedback from last 7 days, highlighting pending questions.

### Example 2: Weekly Review

```bash
/sync-linear-jira discover GitOps --comments --since=2026-01-27
```

Output shows feedback since Monday, useful for weekly sync.

### Example 3: Focus on Pending Only

```bash
/sync-linear-jira discover GitOps --comments --pending
```

Output shows only questions without your reply - action items only.

## Integration with Existing Discovery

The `--comments` flag extends the existing discovery output:

```markdown
# Initiative Discovery: GitOps

## Overview
[... existing initiative overview ...]

## Feedback Summary (--comments)
**Last 7 Days:** 8 comments across 4 platforms
**Pending Responses:** 2 questions awaiting reply

[... detailed feedback sections ...]

## Linear (Source of Truth)
[... existing Linear section ...]

## JIRA (PMO View)
[... existing JIRA section ...]

## GitHub (Developer View)
[... existing GitHub section ...]

## Confluence (Documentation)
[... existing Confluence section ...]

## Cross-System Sync Status
[... existing sync status ...]
```

The feedback summary appears after Overview but before the detailed platform sections.
