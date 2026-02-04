# Idempotent Sync (Prevent Duplicates and Handle Updates)

**CRITICAL:** The sync must be idempotent - running it multiple times should NOT create duplicates.

## Sync Order: Always Check Linear FIRST

**Best Practice**: Linear is the source of truth for planning. Always check Linear issues before checking JIRA/GitHub.

**Correct Order**:
1. Check Linear for issues associated with milestone
2. Check JIRA for tasks linked to Epic
3. Check GitHub for issues with JIRA key prefix
4. Create only what's missing

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

## Scenario: Linear Issues Missing (JIRA/GitHub Exist)

**Situation**: JIRA Epic and Tasks exist, GitHub Issues exist, but Linear issues are missing.

**Example**: Discovered on 2026-01-25 test run:
- JIRA Epic ITPLAT01-1673 exists
- JIRA Tasks ITPLAT01-1678, 1679, 1680 exist
- GitHub Issues #1, #2, #3 exist
- **Linear issues ECI-33, 34, 35 were missing**

**Root Cause**: Previous sync created JIRA/GitHub without creating Linear issues first.

**Solution Workflow**:

1. **Search Linear for issues**:
   ```
   linear_search_issues(
     query: "Define the Operating Model",
     teamIds: ["team-id"],
     first: 20
   )
   ```

2. **If Linear issues are missing**:
   - Create Linear issues from milestone description
   - Use `linear_create_issues` for batch creation
   - Associate with project and milestone (via description)

3. **Extract JIRA/GitHub cross-references**:
   - Parse JIRA task descriptions for GitHub URLs
   - Parse GitHub issue bodies for JIRA keys

4. **Update Linear issues with cross-references** (GraphQL):
   ```graphql
   mutation UpdateIssue($id: String!, $description: String!) {
     issueUpdate(id: $id, input: { description: $description }) {
       success
       issue { id identifier url }
     }
   }
   ```

5. **Update JIRA tasks with Linear URLs**:
   ```
   jira_update_issue(
     issue_key: "ITPLAT01-1678",
     fields: {
       description: existing_desc + "\n\n**Linear:** [ECI-33](linear-url)"
     }
   )
   ```

6. **Verify bidirectional linkage**:
   - Linear → JIRA ✓
   - Linear → GitHub ✓
   - JIRA → Linear ✓
   - JIRA → GitHub ✓
   - GitHub → JIRA ✓
   - GitHub → Linear ✓

**Prevention**: Always create Linear issues FIRST before creating JIRA/GitHub items.

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
