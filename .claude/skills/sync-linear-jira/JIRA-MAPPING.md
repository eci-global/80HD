# Sync Behavior and Field Mappings

## Sync Steps

1. **Parse the user's instruction** to understand what to sync

2. **Fetch data from Linear** using Linear MCP tools

3. **AUTOMATICALLY Create/Update JIRA Version for the Linear Project:**

   **This step is MANDATORY for every sync operation.**

   - Use `jira_get_project_versions(project_key="ITPLAT01")` to search for existing version by name
   - Check if version with the Linear project name already exists
   - If NOT exists: Create using `jira_create_version`:
     - project_key = from "Jira Project ID" URL (e.g., "ITPLAT01")
     - name = Linear project name (e.g., "GitOps Reference Architecture & Operating Model")
     - description = Multi-line format:
       ```
       Linear Project: {project.name}
       Initiative: {initiative.name}
       ```
     - start_date = project.startDate (format: "YYYY-MM-DD")
     - release_date = project.targetDate (format: "YYYY-MM-DD")
   - If EXISTS: Update the version if dates have changed
   - Store version.id for associating epics and tasks

   **Why this is critical:**
   - Every epic and task MUST be associated with a version via fixVersions
   - Versions enable release-based tracking without sprints
   - JIRA release reports and burndowns depend on this association

4. **For each milestone being synced:**
   - Create JIRA Epic (as described above)
   - **Parse the milestone description** to extract tasks from "Build / Do" section
   - For each extracted task:
     - **Create JIRA Task** with fixVersions pointing to the project's version
     - **Link JIRA Task to Epic** using `jira_link_to_epic(issue_key, epic_key)`
     - **Create GitHub Issue** in the repository from project's "GitHub Repo" link
     - Store mapping between JIRA Task key and GitHub Issue number

5. **Create/update in JIRA and GitHub** using Atlassian and GitHub MCP tools

## Field Mapping: Linear → JIRA

| Linear Field | JIRA Field | Notes |
|--------------|------------|-------|
| title | summary | Direct mapping |
| description | description | Direct mapping |
| priority (1-4) | priority | Highest/High/Medium/Low |
| state | status | Map using available JIRA transitions |
| assignee | assignee | Match by email/name |
| labels | labels | Preserve |
| targetDate | duedate | For epics and issues |
| project | fixVersions | Associate with project's version |

**Date Mapping Rules:**
- When syncing a Milestone to Epic: Use milestone's `targetDate` as the epic's `duedate`
- If milestone has no targetDate: Fall back to the project's `targetDate`
- Date format: YYYY-MM-DD (e.g., "2026-03-31")
- Set using `additional_fields`: `{"duedate": "2026-03-31"}`

**Version/Release Association:**
- When syncing a Linear Project: Create or update JIRA Version with project's startDate and targetDate
- When syncing Milestones (Epics): Set `fixVersions` to the project's version
- When syncing Issues: Set `fixVersions` to the project's version
- Version ID format: `{"fixVersions": [{"id": "29166"}]}` or `{"fixVersions": [{"name": "Version Name"}]}`
- Use `jira_create_version` to create new versions
- Use `jira_get_project_versions` to find existing versions

## Field Mapping: Linear → GitHub

| Linear Field | GitHub Field | Notes |
|--------------|--------------|-------|
| title | title | **Prefixed with JIRA key**: `[ITPLAT01-123] Task title` |
| description | body | Markdown format |
| labels | labels | Create if don't exist |
| assignee | assignee | Match by GitHub username |
| state | state | open/closed |

**GitHub Issue Title Format (CRITICAL for Smart Commits):**
```
[ITPLAT01-123] Original task title from Linear
```
- The JIRA key prefix enables developers and AI agents to easily formulate smart commits
- Example smart commit: `git commit -m "ITPLAT01-123 #done Implemented feature"`
- The prefix is machine-readable: `/^\[([A-Z]+-\d+)\]/`

**Add cross-references** in the GitHub issue body:
- "**JIRA:** [ITPLAT01-123](https://eci-solutions.atlassian.net/browse/ITPLAT01-123)"
- "**Linear:** [LIN-123](linear-url)"

Use GitHub MCP `create_issue` tool.

## Hierarchy Maintenance

**JIRA Hierarchy:**
- When syncing a Project: Create JIRA Version
- When syncing a Milestone: Create JIRA Epic (linked to parent, associated with version)
- When syncing Issues in a Milestone:
  - Create JIRA Task (associated with version)
  - Link to Epic using `jira_link_to_epic`
  - Create corresponding GitHub Issue
- When syncing Issues without a Milestone: Create standalone JIRA Issues (still associate with version)

**GitHub Hierarchy:**
- All issues from Linear milestones are created as GitHub Issues in the project's repo
- Use labels to indicate which milestone/epic they belong to
- Include cross-references to JIRA in the issue body

**Hierarchy Structure:**
```
JIRA Version (from Linear Project) + GitHub Repo
├─ Epic 1 (from Linear Milestone 1)
│  ├─ Task 1 (from Linear Issue) → GitHub Issue #1
│  └─ Task 2 (from Linear Issue) → GitHub Issue #2
├─ Epic 2 (from Linear Milestone 2)
│  ├─ Task 3 (from Linear Issue) → GitHub Issue #3
│  └─ Task 4 (from Linear Issue) → GitHub Issue #4
└─ Task 5 (from Linear Issue, no milestone) → GitHub Issue #5

All JIRA items have fixVersions pointing to the Version
All GitHub issues have labels and cross-references to JIRA
```

## CRITICAL: Linking Issues to Epics

- **DO NOT use the `parent` field** in `additional_fields` to link regular tasks/issues to epics - this will fail silently
- **The `parent` field is ONLY for subtasks**, not for epic relationships
- **ALWAYS use `jira_link_to_epic`** tool after creating the issue:
  ```
  jira_link_to_epic(issue_key="ITPLAT01-1678", epic_key="ITPLAT01-1673")
  ```
- This is the ONLY correct way to establish the epic-issue relationship in JIRA
