# Reverse Sync: GitHub → Linear → JIRA

## Overview

Developers work exclusively in GitHub. When they close issues, add comments, or change status, those changes must flow back to Linear and JIRA.

## Architecture

### Linkage Tracking

Every issue needs bidirectional references:

**Linear Issue Description Footer:**
```markdown
---
**External Links:**
- JIRA: [ITPLAT01-123](https://eci-solutions.atlassian.net/browse/ITPLAT01-123)
- GitHub: [eci-global/gitops#17](https://github.com/eci-global/gitops/issues/17)
```

**JIRA Task Description Footer:**
```markdown
---
**External Links:**
- Linear: [PLAT-456](https://linear.app/eci-platform-team/issue/PLAT-456)
- GitHub: [eci-global/gitops#17](https://github.com/eci-global/gitops/issues/17)
```

**GitHub Issue Body Footer:**
```markdown
---
**External Links:**
- JIRA: [ITPLAT01-123](https://eci-solutions.atlassian.net/browse/ITPLAT01-123)
- Linear: [PLAT-456](https://linear.app/eci-platform-team/issue/PLAT-456)
```

### Sync Flows

#### Flow 1: Initial Creation (Linear → JIRA → GitHub)

```
1. Parse Linear Milestone description
2. Create Linear Issues (associate with milestone)
   - State: "Todo" or "Backlog"
   - Store in milestone's project
3. Create JIRA Tasks
   - Status: "To Do"
   - fixVersions: project version
   - Epic link via jira_link_to_epic
   - Add Linear link to description
4. Create GitHub Issues
   - State: "open"
   - Title: "[ITPLAT01-123] Task title"
   - Body: task description + Linear/JIRA links
   - Labels: milestone name
5. Update Linear Issue description with JIRA/GitHub links
6. Update JIRA Task description with Linear/GitHub links
```

#### Flow 2: Status Updates (GitHub → Linear → JIRA)

```
When GitHub issue is closed:
1. Find linked Linear Issue (search by GitHub link in description)
2. Update Linear Issue state to "Done"
3. Find linked JIRA Task (from Linear description or GitHub title prefix)
4. Transition JIRA Task to "Done"
5. Add comment to all three with timestamp of sync
```

**State Mapping:**

| GitHub State | Linear State | JIRA Status | Notes |
|--------------|--------------|-------------|-------|
| open | Todo, In Progress | To Do, In Progress | Default to "Todo" on creation |
| closed (by PR) | Done | Done | Closed via PR merge |
| closed (manually) | Done | Done | Closed without code |
| reopened | In Progress | In Progress | Issue reopened |

#### Flow 3: Comments (GitHub ↔ Linear ↔ JIRA)

```
When GitHub comment is added:
1. Find linked Linear Issue
2. Add comment to Linear: "[From GitHub - @username] comment text"
3. Find linked JIRA Task
4. Add comment to JIRA: "[From GitHub - @username] comment text"
```

**Sync Direction:**
- GitHub → Linear: Always sync
- GitHub → JIRA: Always sync
- Linear → GitHub: Optional (can be one-way from Linear to avoid loops)
- JIRA → GitHub: Optional (JIRA is for visibility, not developer interaction)

### Implementation: Reverse Sync Workflow

#### Step 1: Create Issues with Full Linkage

```javascript
// Pseudo-workflow for creating issues
const linearIssue = await createLinearIssue({
  title: "Task from milestone",
  description: "Task description\n\n---\n**External Links:**\nTo be updated after JIRA/GitHub creation",
  projectId: project.id,
  milestoneId: milestone.id,
  stateId: todoStateId
})

const jiraTask = await createJiraTask({
  summary: linearIssue.title,
  description: `${linearIssue.description}\n\n---\n**Linear:** [${linearIssue.identifier}](${linearIssue.url})`,
  fixVersions: [{ id: versionId }],
  parent: { key: epicKey }
})

const githubIssue = await createGithubIssue({
  title: `[${jiraTask.key}] ${linearIssue.title}`,
  body: `${linearIssue.description}\n\n---\n**JIRA:** [${jiraTask.key}](${jiraUrl})\n**Linear:** [${linearIssue.identifier}](${linearIssue.url})`,
  labels: [milestone.name]
})

// Update Linear with external links
await updateLinearIssue({
  id: linearIssue.id,
  description: `${linearIssue.description}\n\n---\n**External Links:**\n- JIRA: [${jiraTask.key}](${jiraUrl})\n- GitHub: [${githubIssue.number}](${githubUrl})`
})

// Update JIRA with GitHub link
await updateJiraTask({
  key: jiraTask.key,
  description: `${jiraTask.description}\n**GitHub:** [#${githubIssue.number}](${githubUrl})`
})
```

#### Step 2: Sync GitHub Status Back

```javascript
// Run this periodically or on-demand
async function syncGitHubStatusToLinearAndJira(repo, issueNumber) {
  // 1. Get GitHub issue
  const githubIssue = await getGithubIssue(repo, issueNumber)

  // 2. Extract JIRA key from title
  const jiraKey = extractJiraKey(githubIssue.title) // "[ITPLAT01-123]"

  // 3. Get JIRA task
  const jiraTask = await getJiraIssue(jiraKey)

  // 4. Extract Linear URL from JIRA description
  const linearUrl = extractLinearUrl(jiraTask.description)
  const linearIssue = await getLinearIssueByUrl(linearUrl)

  // 5. Sync status: GitHub closed → Linear Done → JIRA Done
  if (githubIssue.state === 'closed' && linearIssue.state.type !== 'completed') {
    await updateLinearState(linearIssue.id, 'Done')
    await transitionJiraIssue(jiraKey, 'Done')

    // Add sync comments
    await addLinearComment(linearIssue.id, `Closed via GitHub issue #${issueNumber}`)
    await addJiraComment(jiraKey, `Closed via GitHub issue #${issueNumber}`)
  }

  // 6. Sync reopens: GitHub reopened → Linear In Progress → JIRA In Progress
  if (githubIssue.state === 'open' && githubIssue.state_reason === 'reopened') {
    await updateLinearState(linearIssue.id, 'In Progress')
    await transitionJiraIssue(jiraKey, 'In Progress')
  }
}
```

#### Step 3: Bulk Status Sync

```bash
# Sync all GitHub issues in a repo back to Linear/JIRA
/sync-linear-jira reverse-sync repo eci-global/gitops
```

**Workflow:**
1. List all GitHub issues in the repo
2. For each issue with JIRA key prefix in title:
   - Get current GitHub state
   - Find linked JIRA task
   - Find linked Linear issue
   - Compare states
   - Update Linear and JIRA if GitHub state differs
3. Report summary:
   - Issues in sync: 45
   - Linear updated: 3
   - JIRA updated: 3

### Trigger Options

#### Option 1: On-Demand Sync (Simplest)
```
/sync-linear-jira reverse-sync repo eci-global/gitops
```
- Run manually when you want to check status
- Fast, no infrastructure needed

#### Option 2: Scheduled Sync (Recommended)
- Run every 15 minutes via cron/GitHub Actions
- Automatically keeps Linear/JIRA up-to-date
- Lightweight: only syncs issues that changed

#### Option 3: Webhook-Based (Real-time)
- GitHub webhook → Edge Function → MCP calls
- Instant updates
- Requires infrastructure setup

### Status Transition Rules

**GitHub → Linear State Mapping:**

| GitHub Event | Linear State Transition | Comment Added |
|--------------|-------------------------|---------------|
| Issue closed | Current → "Done" | "Closed via GitHub issue #N" |
| Issue reopened | "Done" → "In Progress" | "Reopened in GitHub issue #N" |
| Issue labeled "in-progress" | Current → "In Progress" | "Marked in progress in GitHub" |
| PR opened referencing issue | Current → "In Progress" | "PR opened: #N" |
| PR merged closing issue | Current → "Done" | "Merged PR #N" |

**GitHub → JIRA Status Mapping:**

| GitHub Event | JIRA Transition | Comment Added |
|--------------|-----------------|---------------|
| Issue closed | "To Do" → "Done" | "Closed via GitHub issue #N" |
| Issue reopened | "Done" → "In Progress" | "Reopened in GitHub issue #N" |
| PR merged | Any → "Done" | "Merged PR #N" |

### Query Patterns

**Find Linear Issue from GitHub Issue:**
```graphql
query {
  issues(
    filter: {
      description: { contains: "github.com/eci-global/gitops/issues/17" }
    }
  ) {
    nodes {
      id
      identifier
      title
      state {
        name
        type
      }
    }
  }
}
```

**Find JIRA Task from GitHub Issue:**
- Extract JIRA key from GitHub title: `/^\[([A-Z]+-\d+)\]/`
- Use `jira_get_issue(issue_key)`

**Find GitHub Issue from Linear:**
- Extract GitHub URL from Linear description
- Parse repo and issue number
- Use `get_issue(owner, repo, issue_number)`

### Error Handling

**Missing Linkages:**
- If Linear description doesn't have GitHub link: Search GitHub by JIRA key prefix
- If GitHub title doesn't have JIRA key: Search JIRA by issue summary
- If JIRA description doesn't have Linear link: Skip Linear sync (JIRA only)

**State Conflicts:**
- If Linear is "Done" but GitHub is "open": Trust GitHub (most recent)
- If JIRA is "Done" but GitHub is "open": Trust GitHub (developer workspace)
- Always log conflicts for manual review

**Permission Issues:**
- Linear API rate limits: Batch updates, add delays
- JIRA API rate limits: Use bulk update APIs
- GitHub API rate limits: Use GraphQL for efficiency

## Summary

To support your developer workflow (GitHub-centric), the skill needs:

1. ✅ **Create with full linkage:** Linear Issue → JIRA Task → GitHub Issue (all cross-referenced)
2. ✅ **Reverse sync:** GitHub status → Linear state → JIRA status
3. ✅ **Bidirectional comments:** GitHub comments → Linear/JIRA (optional)
4. ✅ **Scheduled or on-demand:** Run reverse sync periodically or manually
5. ✅ **Smart state mapping:** GitHub closed → Linear Done → JIRA Done

This creates a complete sync loop where:
- **Planning** happens in Linear (milestones, initiatives)
- **Work** happens in GitHub (developers interact here)
- **Tracking** happens in JIRA (PMO/leadership view)
- **Sync** keeps all three platforms in sync automatically
