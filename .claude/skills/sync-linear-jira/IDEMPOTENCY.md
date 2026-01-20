# Idempotent Sync (Prevent Duplicates and Handle Updates)

**CRITICAL:** The sync must be idempotent - running it multiple times should NOT create duplicates.

## Detection Strategy - Check if items already exist

### For JIRA Versions

- Use `jira_get_project_versions(project_key)` to get all versions
- Match by `name` field (exact match with Linear project name)
- If exists: Update releaseDate if Linear project targetDate changed
- If not exists: Create new version

### For JIRA Epics

- Use `jira_search` with JQL: `project = ITPLAT01 AND issuetype = Epic AND summary ~ "milestone-name"`
- Match by `summary` field (exact match with Linear milestone name)
- If exists: Update using `jira_update_issue`:
  - Update `description` if milestone description changed
  - Update `duedate` if:
    - Milestone has a targetDate AND it changed, OR
    - Milestone has NO targetDate (uses fallback) AND project targetDate changed
  - Update `fixVersions` if project version changed
- **Cascading date update:** When project targetDate changes, check ALL Epics:
  - Get Epic's current `duedate`
  - If Epic duedate matches OLD project targetDate → Epic used fallback → update to new project targetDate
  - If Epic duedate differs → Epic has milestone-specific date → only update if that milestone's targetDate changed
- If not exists: Create new epic

### For JIRA Tasks

- Use `jira_search` with JQL: `project = ITPLAT01 AND issuetype = Task AND summary ~ "task-title"`
- Match by `summary` field (exact match with extracted task title)
- Alternative: Store Linear milestone ID in task description for precise matching
- If exists: Update using `jira_update_issue`:
  - Update `description` if task content changed
  - Update `fixVersions` if project version changed
  - Ensure epic link is correct using `jira_link_to_epic`
- If not exists: Create new task

### For GitHub Issues

**Detection:**
- Use `search_issues` with query: `repo:eci-global/gitops is:issue "[ITPLAT01-123]" in:title`
- Match by JIRA key prefix in title (most reliable)
- Alternative: Search by task title content if prefix missing

**Title Format:**
```
[ITPLAT01-123] Original task title
```
- JIRA key prefix enables smart commits for developers and AI agents
- Machine-readable pattern: `/^\[([A-Z]+-\d+)\]/`

**If exists - Verify and Update:**
- **Verify JIRA reference in title:** Check if title starts with `[JIRA-KEY]`
  - If missing: Update title to add prefix using `update_issue`
  - If wrong key: Update title to correct prefix
- **Verify JIRA reference in body:** Check for JIRA cross-reference link
  - If missing: Update body to add cross-reference
  - If wrong link: Update body to correct link
- Update `body` if content changed
- Update `labels` if milestone changed
- Keep issue open unless explicitly closed in Linear

**If not exists:** Create new issue with JIRA key prefix in title

## Tracking Date Sources (for cascading updates)

- When creating JIRA Version, store the project targetDate as `releaseDate`
- When creating Epic with fallback date, include in description: `[Date source: project fallback]`
- When creating Epic with milestone-specific date, include: `[Date source: milestone]`
- During re-sync, check these markers to determine if cascading update is needed
- Alternative: Store project targetDate in a custom field or compare Version releaseDate

## Update Priority (Linear as source of truth)

- **Always update from Linear:** description, dates (targetDate → duedate/releaseDate), version associations
- **Preserve JIRA-specific:** status/state, assignee, priority, comments, worklog
- **Preserve GitHub-specific:** assignees, comments, reactions
- When in doubt, Linear data wins for content and structure

## What Triggers Updates in Each System

| Linear Change | JIRA Update | GitHub Update |
|---------------|-------------|---------------|
| Project targetDate | Version releaseDate + Epics using fallback date | None (GitHub issues don't have dates) |
| Milestone targetDate | Epic duedate | None |
| Milestone description | Epic description + Task descriptions | Issue body |
| Task content (in description) | Task summary/description | Issue title/body |
| Project name | Version name | None |
| Milestone name | Epic summary | Issue labels |

## JIRA Reference Verification (GitHub Issues)

**Purpose:** Ensure GitHub issues always have the JIRA key for smart commits.

**What gets verified on every sync:**
1. **Title prefix:** Does the issue title start with `[JIRA-KEY]`?
2. **Body cross-reference:** Does the body contain the JIRA link?

**Restoration actions:**
- If title prefix missing: `update_issue` to prepend `[ITPLAT01-123] ` to title
- If body cross-reference missing: `update_issue` to add JIRA link to body

**Why this matters:**
- Developers and AI agents can easily find the JIRA key
- Smart commits work automatically: `git commit -m "ITPLAT01-123 #done Fixed the bug"`
- GitHub → JIRA sync (via smart commits) keeps JIRA updated as work progresses

**Detection pattern:**
```regex
Title: /^\[([A-Z]+-\d+)\]/
Body: /\[ITPLAT01-\d+\]\(https:\/\/.*\.atlassian\.net\/browse\/ITPLAT01-\d+\)/
```
