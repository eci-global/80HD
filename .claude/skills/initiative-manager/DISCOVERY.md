# Discovery Workflow

**Purpose:** Comprehensive initiative discovery across Linear, JIRA, GitHub, and Confluence.

This is the READ/DISCOVERY complement to the WRITE/SYNC operations. Use it to:
- See current state of an initiative across all platforms
- Identify sync gaps and broken links
- Monitor health and progress
- Verify sync operations completed successfully
- Generate status updates

## Workflow Phases

### Phase 0: Pre-flight Checks

**Purpose:** Validate authentication and API access before executing discovery.

**Checks performed:**

1. **Linear (REQUIRED):** Lightweight API test
   ```bash
   curl -H "Authorization: $LINEAR_API_KEY" https://api.linear.app/graphql \
     -d '{"query":"{ viewer { id name } }"}'
   ```
   - If fails: ABORT - Linear is source of truth, required for all operations
   - Error message: "Linear API authentication failed. Check LINEAR_API_KEY in .mcp.json"

2. **JIRA (OPTIONAL):** Test MCP connection
   ```
   jira_get_user_profile()
   ```
   - If fails: WARN and continue with available data
   - Discovery will show: "⚠️ JIRA unavailable, skipping PMO view"

3. **GitHub (OPTIONAL):** Check rate limit
   ```bash
   gh api rate_limit
   ```
   - If <100 remaining: WARN user about potential throttling
   - If fails: WARN and continue
   - Discovery will show: "⚠️ GitHub unavailable, skipping developer view"

4. **Confluence (OPTIONAL):** Test if linked and accessible
   - Only test if initiative has "Confluence Wiki" link
   - Test with: `confluence_search(cql="type=page", limit=1)`
   - If fails: WARN and continue
   - Discovery will show: "⚠️ Confluence unavailable, skipping documentation view"

**Result:** Proceed with available systems, gracefully degrade if optional systems unavailable.

### Phase 1: Input Parsing & Normalization

**Detect input type and resolve to Linear initiative:**

| Input Type | Pattern | Resolution Strategy |
|------------|---------|---------------------|
| Initiative name | "GitOps" | GraphQL query: `{ initiatives { nodes { id name } } }`, fuzzy match |
| Full initiative name | "2026 Q1 - Establish GitOps" | GraphQL query with exact match |
| JIRA key | "ITPLAT01-1619" | Get JIRA task, extract Linear URL from description, resolve to initiative |
| GitHub repo | "eci-global/gitops" | Search issues for JIRA prefix, trace to Linear via JIRA |

**Caching check:**
1. Generate cache key: `/tmp/linear-cache-{initiative-id}-{YYYY-MM-DD}.json`
2. Check if cache exists and TTL valid (5 minutes)
3. If `--no-cache` flag: Skip cache, force fresh fetch
4. If cache valid: Load cached data and skip Linear API calls
5. If cache invalid/missing: Proceed with Phase 2 and cache results

**Baseline check for comparison modes:**
1. If `--since=YYYY-MM-DD`: Load baseline from `/tmp/linear-baseline-{initiative-id}-{date}.json`
   - If baseline missing: Error "No baseline found for {date}. Run discovery first to create baseline."
2. If `--verify`: Load verify baseline from `/tmp/linear-verify-{initiative-id}.json`
   - If baseline missing: Note "No pre-sync baseline found, showing current state only"
3. If first discovery run (no --since, no --verify): Save baseline for future comparisons

### Phase 2: Linear Discovery (Source of Truth - REQUIRED)

**Purpose:** Fetch comprehensive initiative data from Linear.

**Tool loading (on-demand MCP pattern):**
```
ToolSearch query: "linear"
# Loads: linear_search_projects, linear_get_project
```

**Steps:**

1. **Search initiatives:**
   - Try Linear MCP first: `linear_search_projects` (may not support initiatives)
   - Fallback to GraphQL (reuse from GRAPHQL.md):
     ```graphql
     { initiatives { nodes { id name description content targetDate } } }
     ```

2. **Fetch full initiative with documents, projects, links:**
   ```graphql
   { initiative(id: "X") {
       id name description content targetDate
       documents { nodes { id title content url } }
       links { nodes { id label url } }
       projects(first: 50) {
         nodes {
           id name startDate targetDate
           externalLinks { nodes { id label url } }
         }
       }
   }}
   ```

3. **For each project, fetch milestones:**
   ```graphql
   { project(id: "X") {
       projectMilestones {
         nodes { id name description targetDate sortOrder }
       }
   }}
   ```

4. **Extract configuration from externalLinks (reuse existing logic):**
   - JIRA Parent ID: Extract from `/browse/ITPMO01-1619`
   - JIRA Project ID: Extract from `/projects/ITPLAT01/`
   - GitHub Repo: Extract owner/repo from URL

5. **Cache results:**
   ```bash
   echo "$LINEAR_DATA" > /tmp/linear-cache-{initiative-id}-{date}.json
   ```

### Phase 3: JIRA Discovery (PMO View - OPTIONAL)

**Purpose:** Fetch JIRA versions, epics, tasks for PMO reporting view.

**Tool loading:**
```
ToolSearch query: "+jira"
# Loads: jira_get_project_versions, jira_search, jira_get_issue
```

**Steps:**

1. **For each JIRA project key found in Linear externalLinks:**

   a. **Get versions:**
   ```
   jira_get_project_versions(project_key="ITPLAT01")
   ```
   - Match versions to Linear projects by name
   - Extract releaseDate, startDate, released status

   b. **Search epics:**
   ```
   jira_search(jql="project = ITPLAT01 AND issuetype = Epic AND parent = ITPMO01-1619")
   ```
   - Match epics to Linear milestones by name

   c. **Search tasks:**
   ```
   jira_search(jql="project = ITPLAT01 AND issuetype = Task", max_results=50)
   ```
   - Group by fixVersion
   - Count by status (To Do, In Progress, Done)

2. **Run sync status algorithm (see below)**

3. **Detect orphaned epics:**
   - For each JIRA epic under parent
   - Check if matching Linear milestone exists
   - If no match: Mark as "⚠️ Orphaned JIRA Epic"

4. **Cache results:**
   ```bash
   echo "$JIRA_DATA" > /tmp/jira-cache-{project-key}-{date}.json
   ```

### Phase 4: GitHub Discovery (Developer View - OPTIONAL)

**Purpose:** Fetch GitHub issues, PRs, wiki status for developer workspace view.

**No MCP needed - use gh CLI:**

1. **For each GitHub repo found in Linear externalLinks:**

   a. **List issues:**
   ```bash
   gh issue list --repo owner/repo --limit 100 --json number,title,state,labels
   ```
   - Filter for issues with JIRA prefix: `grep "\[ITPLAT01-"`
   - Count by state (open, closed)

   b. **List PRs:**
   ```bash
   gh pr list --repo owner/repo --limit 50 --json number,title,state
   ```
   - Count by state (open, closed, merged)

   c. **Check wiki:**
   ```bash
   gh repo view owner/repo --json hasWikiEnabled
   gh api repos/owner/repo/wiki --jq 'length' # If wiki enabled
   ```

   d. **Count branches:**
   ```bash
   gh api repos/owner/repo/branches --jq 'length'
   ```

2. **Run sync status checks for GitHub issues (see algorithm below)**

3. **Detect dangling issues:**
   - For each issue with JIRA prefix
   - Extract JIRA key
   - Check if JIRA task exists (404 = dangling)
   - If 404: Mark as "⚠️ Dangling GitHub Issue"

4. **GitHub CLI caches automatically (no manual caching needed)**

### Phase 5: Confluence Discovery (Documentation - OPTIONAL)

**Purpose:** Fetch Confluence documentation pages for enterprise knowledge base view.

**Tool loading:**
```
ToolSearch query: "+confluence"
# Loads: confluence_get_page, confluence_get_page_children, confluence_search
```

**Steps:**

1. **Check for "Confluence Wiki" link in initiative:**
   - Extract space_key and parent_id from URL
   - URL pattern: `https://*.atlassian.net/wiki/spaces/{space_key}/pages/{parent_id}/...`

2. **If Confluence link present:**

   a. **Get parent page:**
   ```
   confluence_get_page(page_id="{parent_id}")
   ```

   b. **Get child pages:**
   ```
   confluence_get_page_children(page_id="{parent_id}")
   ```

   c. **Compare with Linear documents:**
   - For each Linear document with Confluence URL
   - Try to fetch Confluence page
   - If 404: Mark as "❌ Broken Confluence Link"

3. **If Confluence link not present:**
   - Skip with note: "ℹ️ No Confluence documentation linked"

### Phase 5.5: Feedback Collection (--comments flag)

**Purpose:** Aggregate comments from all platforms into a unified feedback view.

**Skip if:** `--comments` flag not provided

**Tool loading:**
```
# GitHub: No MCP needed - use gh CLI
# JIRA: Already loaded from Phase 3
# Confluence: Already loaded from Phase 5
```

**Steps:**

1. **Calculate time window:**
   - Default: 7 days ago to now
   - With `--since=YYYY-MM-DD`: From specified date to now

2. **Collect GitHub comments:**

   a. **PR comments and reviews:**
   ```bash
   # Get recent PRs
   gh pr list --repo {owner}/{repo} --limit 10 --json number,title,updatedAt --state all

   # For each PR updated in time window:
   gh api repos/{owner}/{repo}/pulls/{pr}/comments \
     --jq '.[] | select(.created_at >= "{since_date}") | {author: .user.login, body: .body, created_at: .created_at, type: "pr_comment", item: "PR #{pr}"}'

   gh api repos/{owner}/{repo}/pulls/{pr}/reviews \
     --jq '.[] | select(.submitted_at >= "{since_date}") | {author: .user.login, body: .body, created_at: .submitted_at, state: .state, type: "pr_review", item: "PR #{pr}"}'
   ```

   b. **Issue comments:**
   ```bash
   # Get issues with JIRA prefix
   gh issue list --repo {owner}/{repo} --limit 50 --json number,title,updatedAt --state all

   # For each issue updated in time window:
   gh api repos/{owner}/{repo}/issues/{issue}/comments \
     --jq '.[] | select(.created_at >= "{since_date}") | {author: .user.login, body: .body, created_at: .created_at, type: "issue_comment", item: "Issue #{issue}"}'
   ```

   c. **Discussion comments:**
   ```bash
   gh api graphql -f query='
     query {
       repository(owner: "{owner}", name: "{repo}") {
         discussions(first: 10, orderBy: {field: UPDATED_AT, direction: DESC}) {
           nodes {
             title
             number
             comments(first: 20) {
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
   # Filter comments by createdAt >= since_date
   ```

3. **Collect JIRA comments:**
   ```
   # For each JIRA task discovered in Phase 3:
   # Comments are already in the jira_get_issue response: fields.comment.comments[]

   # For the parent epic:
   mcp__atlassian__jira_get_issue(issue_key="{parent_epic}")
   # Extract: fields.comment.comments[].author.displayName, fields.comment.comments[].body, fields.comment.comments[].created
   ```

   - Filter by `created >= since_date`
   - Limit to 50 most recent comments across all tasks

4. **Collect Confluence comments:**
   ```
   # For each page discovered in Phase 5 (limit 5 pages):
   mcp__atlassian__confluence_get_comments(page_id="{page_id}")
   # Extract: results[].body.storage.value, results[].version.by.displayName, results[].version.when
   ```

   - Filter by `when >= since_date`

5. **Classify comments:**

   a. **Question detection (simple heuristic):**
   ```python
   def is_question(body):
       return body.strip().endswith('?')
   ```

   b. **Pending response detection (if usernames configured):**
   ```python
   def is_pending(comment, all_comments, my_usernames):
       if not is_question(comment.body):
           return False
       # Check if I replied after this comment
       for reply in all_comments:
           if reply.created_at > comment.created_at:
               if reply.author in my_usernames:
                   return False  # I replied
       return True  # No reply from me
   ```

   c. **Username configuration:**
   - Read from `~/.claude/sync-linear-jira-config.json`
   - If not configured: Skip pending detection, show warning

6. **Aggregate and sort:**
   - Group by platform (GitHub, JIRA, Confluence)
   - Sort by created_at (newest first within each group)
   - Separate pending responses (oldest first - longest waiting)

7. **Store for output:**
   ```json
   {
     "total_comments": 15,
     "pending_count": 2,
     "comments": [
       {
         "platform": "github",
         "type": "pr_review",
         "item": "PR #67",
         "author": "jane.doe",
         "body": "Approved with suggestions",
         "created_at": "2026-02-03T10:30:00Z",
         "is_question": false,
         "is_pending": false
       },
       ...
     ],
     "pending": [
       {
         "platform": "jira",
         "item": "ITPLAT01-1749",
         "author": "PMO Lead",
         "body": "When is the deadline?",
         "created_at": "2026-02-02T09:00:00Z",
         "is_question": true,
         "is_pending": true
       },
       ...
     ]
   }
   ```

**Error handling:**

| Error | Behavior |
|-------|----------|
| GitHub rate limit | Show cached comments if available, warn user |
| JIRA comments unavailable | Skip JIRA comments with note |
| Confluence comments unavailable | Skip Confluence comments with note |
| No usernames configured | Disable pending detection, show warning |
| No comments found | Show "No comments in time window" |

**Note on MS Teams:** Teams channel messages are NOT automatically aggregated due to security concerns with available MCP servers (excessive OAuth permissions). Check Teams manually via UI or work with IT to set up a custom read-only Azure AD app.

### Phase 6: Output Generation

**Primary format: Markdown summary**

**With --comments flag, insert Feedback Summary after Overview:**

```markdown
# Initiative Discovery: [Name]

## Overview
**Status:** Active | **Target:** 2026-03-31 | **Last Updated:** 2026-01-25
**Health:** 🟢 Green (92% sync health)

[255-char description from Linear]

## Feedback Summary (--comments)
**Last 7 Days:** 15 comments across 4 platforms
**Pending Responses:** 2 questions awaiting reply

### Pending Responses (2)
Questions without your reply - respond promptly!

| Platform | Item | Author | Comment | Age |
|----------|------|--------|---------|-----|
| JIRA | ITPLAT01-1749 | PMO Lead | "When is the deadline?" | 1d |
| GitHub | Issue #55 | John D. | "Question about scope?" | 5h |

### Recent Comments

**GitHub (8 comments)**
- **PR #67**: Jane S. - "Approved with suggestions" (2h ago)
- **Issue #55**: John D. - "Question about scope?" (5h ago) ⚠️

**JIRA (2 comments)**
- **ITPLAT01-1749**: PMO Lead - "When is the deadline?" (1d ago) ⚠️

**Confluence (5 comments)**
- **Outcomes Checklist**: Stakeholder A - "Suggest adding..." (3h ago)

### Quick Links
- **GitHub Notifications:** https://github.com/notifications
- **JIRA Filter:** https://eci-solutions.atlassian.net/issues/?filter=...
- **Confluence:** https://eci-solutions.atlassian.net/wiki/spaces/CGIP

**Note:** Teams channel messages not included - check manually via Teams UI.

---

## Linear (Source of Truth)
**Initiative ID:** 3617f995... | **URL:** https://linear.app/...

### Projects (4)
| Project | Start | Target | Milestones | Issues |
|---------|-------|--------|------------|--------|
| GitOps Reference Architecture | 2026-01-15 | 2026-03-31 | 5 | 16 |
| Phase 1 Team Enablement | 2026-01-01 | 2026-02-27 | 3 | 12 |
⚠️ Showing 4 of 4 projects

### Documents (9)
- [Overview](url) - Initiative overview and goals
- [FAQs](url) - Common concerns addressed
(7 more...)

## JIRA (PMO View)
**Project:** ITPLAT01 | **Parent:** [ITPMO01-1619](url)

### Versions (4)
| Version | Release Date | Epics | Tasks | Status |
|---------|--------------|-------|-------|--------|
| GitOps Reference Architecture | 2026-03-31 | 5 | 16 | 10 done, 6 in progress |

### Issue Summary
- **Total:** 45 issues
- **Open:** 23 (51%)
- **In Progress:** 12 (27%)
- **Done:** 10 (22%)

## GitHub (Developer View)
**Repository:** [eci-global/gitops](url)

- **Issues:** 18 open, 27 closed
- **PRs:** 3 open, 42 merged
- **Branches:** 8 active feature branches
- **Wiki:** Enabled (9 pages, last updated 2026-01-24)

## Confluence (Documentation)
**Space:** CGIP | **Parent:** [Establish GitOps](url)
- **Pages:** 8 documentation pages
- **Last Updated:** 2026-01-24

## Cross-System Sync Status

| System | Synced | Connected | Not Synced | Health |
|--------|--------|-----------|------------|--------|
| Linear → JIRA | 42/45 (93%) | 2 | 1 | 🟢 |
| Linear → GitHub | 40/45 (89%) | 3 | 2 | 🟢 |
| Linear → Confluence | 8/9 (89%) | 0 | 1 | 🟢 |

**Overall Health:** 🟢 Green (92%)

## Cleanup Needed
⚠️ 2 orphaned JIRA epics: ITPLAT01-999, ITPLAT01-1000
⚠️ 1 dangling GitHub issue: #45 (JIRA task deleted)
❌ 1 broken Confluence link in document "FAQs"

## Suggested Actions

**To sync missing items:**
```bash
/sync-linear-jira sync milestone "Define the Operating Model"
```

**To fix JIRA key prefixes:**
```bash
/sync-linear-jira verify-github-jira-links repo eci-global/gitops
```

**To clean up orphans:**
- Archive JIRA epics: ITPLAT01-999, ITPLAT01-1000
- Close or update GitHub issue #45

## Quick Links
- **Linear:** [Initiative](url) | [Projects](url)
- **JIRA:** [Parent Epic](url) | [All Issues](jql-url)
- **GitHub:** [Repo](url) | [Issues](url) | [Wiki](url)
- **Confluence:** [Documentation](url)
```

**Alternative formats:**

| Format | Usage | Output |
|--------|-------|--------|
| `--format=json` | Machine-readable | JSON with all data structures |
| `--format=minimal` | Quick check | Just stats and links, no tables |

## Sync Status Algorithm

**Purpose:** Determine sync status for each Linear issue across JIRA and GitHub.

### For Linear → JIRA Sync

For each Linear issue in initiative:

1. **Extract JIRA reference from Linear issue description:**
   - Parse for JIRA key: regex `/ITPLAT01-\d+/`
   - If not found: Status = "Not Synced"
   - If found: Proceed to verification

2. **Verify JIRA sync quality:**
   - Fetch JIRA task by key
   - Check ✓ Title matches Linear (word overlap >= 80%)
     - Formula: `(matching_words / total_words) >= 0.8`
     - Fallback: Exact substring match
   - Check ✓ Description contains Linear URL
   - Check ✓ fixVersions matches project version
   - Check ✓ Epic link matches milestone (if milestone exists)

3. **Assign status:**
   - **"Synced"**: All checks pass
   - **"Connected"**: JIRA link exists but checks fail
   - **"Not Synced"**: No JIRA link found

### For Linear → GitHub Sync

For each Linear issue in initiative:

1. **Extract GitHub reference from Linear issue description:**
   - Parse for GitHub URL: regex `/github\.com\/[^\/]+\/[^\/]+\/issues\/\d+/`
   - If not found: Status = "Not Synced to GitHub"
   - If found: Proceed to verification

2. **Verify GitHub sync quality:**
   - Fetch GitHub issue by number
   - Check ✓ Title starts with `[{JIRA-KEY}]`
   - Check ✓ Body contains Linear URL
   - Check ✓ Body contains JIRA URL
   - Check ✓ State matches (open/closed mapped correctly)

3. **Assign status:**
   - **"Synced"**: All checks pass
   - **"Connected"**: GitHub link exists but checks fail
   - **"Not Synced"**: No GitHub link found

### Aggregate Counts

For each system (JIRA, GitHub):
- Count Synced: All checks pass
- Count Connected: Links exist but checks fail
- Count Not Synced: No links found

**Display:** "45/50 synced (90%), 3 connected, 2 not synced"

## Orphaned Items Detection

### JIRA Orphans (Epics without Linear Milestones)

**Detection:**
```
jira_search(jql="project = ITPLAT01 AND issuetype = Epic AND parent = ITPMO01-1619")
```

For each epic:
- Extract epic name
- Search Linear milestones for name match
- If no match: Mark as "⚠️ Orphaned JIRA Epic"

**Suggestion:** "Consider archiving or linking to Linear milestone"

### GitHub Orphans (Issues with JIRA prefix but deleted task)

**Detection:**
```bash
gh issue list --repo owner/repo --limit 100 --json number,title
# Filter for [ITPLAT01-*] prefix
```

For each issue with JIRA prefix:
- Extract JIRA key from title
- Try to fetch JIRA task
- If 404: Mark as "⚠️ Dangling GitHub Issue"

**Suggestion:** "Remove JIRA prefix or close issue"

### Broken Confluence Links

**Detection:**

For each Linear document with Confluence URL in content:
- Extract Confluence page ID from URL
- Try to fetch page: `confluence_get_page(page_id)`
- If 404: Mark as "❌ Broken Confluence Link"

**Suggestion:** "Remove link or recreate page"

**Output section:**
```markdown
## Cleanup Needed
⚠️ 2 orphaned JIRA epics: ITPLAT01-999, ITPLAT01-1000
⚠️ 1 dangling GitHub issue: #45 (JIRA task ITPLAT01-888 deleted)
❌ 1 broken Confluence link in document "FAQs"
```

## Health Scoring

**Purpose:** Single metric to assess initiative sync health.

### Sync Health (0-100%)

**Formula:**
```
synced_count = Linear issues with valid JIRA/GitHub links passing all checks
total_count = Total Linear issues in initiative
sync_health = (synced_count / total_count) * 100
```

**Thresholds:**
- 🔴 Red: <70% - Critical sync gaps
- 🟡 Yellow: 70-90% - Some gaps exist
- 🟢 Green: >90% - Healthy sync

### Completeness (0-100%)

**Formula:**
```
complete_count = Milestones with targetDate set
total_milestones = Total milestones in initiative
completeness = (complete_count / total_milestones) * 100
```

### Staleness (Days)

**Formula:**
```
last_update = Most recent Linear issue update in initiative
staleness_days = today - last_update
```

**Warning:** If staleness > 14 days, warn "⚠️ Initiative appears stale (no updates in {days} days)"

### Overall Health

**Calculation:**
- If sync_health < 70%: 🔴 Red
- If sync_health < 90%: 🟡 Yellow
- If sync_health >= 90%: 🟢 Green

**Display:** "Overall Health: 🟢 Green (92%)"

## Caching Strategy

**Purpose:** Reduce API calls, improve performance, support comparison modes.

### Discovery Cache (Short-lived)

**Location:** `/tmp/linear-cache-{initiative-id}-{YYYY-MM-DD}.json`
**TTL:** 5 minutes
**Purpose:** Avoid re-fetching same data during single discovery run

**Behavior:**
- First discovery: Fetch from APIs, cache results
- Subsequent discoveries within 5 min: Use cached data
- `--no-cache` flag: Force fresh fetch, overwrite cache
- Auto-cleared: Deleted after sync operations complete

**Content:**
```json
{
  "initiative": { /* Linear initiative data */ },
  "projects": [ /* Linear projects */ ],
  "milestones": [ /* Linear milestones */ ],
  "cached_at": "2026-02-02T10:30:00Z"
}
```

### JIRA Cache

**Location:** `/tmp/jira-cache-{project-key}-{YYYY-MM-DD}.json`
**TTL:** 2 minutes
**Purpose:** Reduce JIRA API calls

### Comparison Baselines (Persistent)

**Location:** `/tmp/linear-baseline-{initiative-id}-{YYYY-MM-DD}.json`
**TTL:** Never auto-deleted (manual cleanup)
**Purpose:** Support `--since` flag for progress tracking

**Creation:**
- Created on first discovery run (if --since not used)
- One baseline per date
- Includes full initiative state snapshot

**Usage:**
```bash
/sync-linear-jira discover GitOps --since=2026-01-25
```
- Loads baseline from 2026-01-25
- Compares with current state
- Shows diff: "3 new milestones, 2 completed projects"

**Error handling:**
- If baseline missing: "No baseline found for 2026-01-25. Run discovery first to create baseline."

### Verify Baselines (Temporary)

**Location:** `/tmp/linear-verify-{initiative-id}.json`
**TTL:** Auto-deleted after showing diff
**Purpose:** Support `--verify` flag for post-sync verification

**Workflow:**
1. Before sync: `discover` automatically saves verify baseline
2. User runs: `/sync-linear-jira sync initiative "GitOps"`
3. After sync: `discover --verify` loads baseline and compares
4. Output shows diff:
   ```markdown
   ## Verification Results
   ✅ 3 new JIRA tasks synced (ITPLAT01-1699, 1700, 1701)
   ✅ 3 GitHub issues created (#17, #18, #19)
   ✅ Sync health improved: 87% → 93%
   ⚠️ 1 issue still not synced (manual review needed)
   ```
5. Baseline auto-deleted after showing diff

## Pagination & Limits

**Purpose:** Handle large initiatives without timeouts or hitting API limits.

### Linear API Limits

- Max 250 nodes per query
- Max query complexity: 10,000
- Rate limit: 2,000 requests/hour

### Implementation

**Default limits:**
- `first: 50` on all node queries
- `--limit` flag default: 10 projects, 20 milestones per project

**Pagination:**
- Implement cursor-based pagination for large result sets
- Use `pageInfo { hasNextPage, endCursor }`

**Warnings:**
- If truncated: "⚠️ Showing 10 of 23 projects (use --limit 50 for all)"
- For full initiative with 20+ projects, use batched queries

**Example:**
```graphql
{
  initiative(id: "X") {
    projects(first: 10, after: "cursor") {
      nodes { id name }
      pageInfo { hasNextPage endCursor }
    }
  }
}
```

## Error Handling

### Graceful Degradation

| Phase | Behavior if Unavailable |
|-------|------------------------|
| Linear (Phase 2) | **ABORT** - Source of truth required |
| JIRA (Phase 3) | Skip with note: "⚠️ JIRA unavailable, skipping PMO view" |
| GitHub (Phase 4) | Skip with note: "⚠️ GitHub unavailable" |
| Confluence (Phase 5) | Skip with note: "ℹ️ No Confluence documentation linked" |

### Missing Configuration

| Missing Item | Behavior |
|--------------|----------|
| No JIRA Project ID link | Search JIRA by initiative name (fuzzy match) |
| No GitHub Repo link | Skip GitHub section with note |
| No Confluence Wiki link | Skip Confluence section with note |
| No milestones in project | Report "Project has no milestones" |

### API Rate Limits

**GitHub:**
- Check rate limit before discovery
- If <100 remaining: Warn user
- If exceeded: Skip GitHub section with note

**Linear:**
- 2,000 requests/hour (generous)
- Unlikely to hit during normal usage
- If exceeded: Cache will help on retry

**JIRA:**
- Rate limits vary by Atlassian plan
- MCP server handles retries
- If exceeded: Skip JIRA section with note
