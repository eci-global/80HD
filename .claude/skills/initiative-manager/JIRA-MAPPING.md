# Sync Behavior and Field Mappings

## Default Assignees

**All synced items are automatically assigned to the initiative owner:**

| Platform | Assignee | Identifier |
|----------|----------|------------|
| **JIRA** | Travis Edgar | `tedgar@ecisolutions.com` |
| **GitHub** | Rusty Autopsy | `RustyAutopsy` |
| **Linear** | Travis Edgar | `tedgar@ecisolutions.com` |
| **Confluence** | Travis Edgar | Page author (automatic) |

**JIRA Assignment:**
```
jira_create_issue(
    ...
    assignee="tedgar@ecisolutions.com"
)
```

**GitHub Assignment:**
```
gh issue create --assignee RustyAutopsy ...
```
Or via MCP: `assignees: ["RustyAutopsy"]`

**Linear Assignment:**
```graphql
mutation { issueCreate(input: { assigneeId: "534ced56-7f9c-41ce-bdae-3114784fff1a", ... }) { success } }
```

---

## Sync Steps

1. **Parse the user's instruction** to understand what to sync

2. **Fetch data from Linear** using Linear MCP tools

3. **AUTOMATICALLY Create/Update JIRA Epic AND Version for the Linear Project:**

   **This step is MANDATORY for every sync operation.**

   **Step 3a: Create JIRA Epic (work container):**
   - Use `jira_create_issue` with `issue_type="Epic"`
   - summary = Linear project name
   - description = Include initiative context, target date
   - fixVersions = version ID from step 3b
   - After creation: Link to PMO parent using `jira_create_issue_link`:
     ```
     jira_create_issue_link(
       link_type="Parent",
       inward_issue_key="ITPLAT01-1774",   # The Epic (child)
       outward_issue_key="ITPMO01-1686"    # The PMO issue (parent)
     )
     ```

   **Step 3b: Create JIRA Version (release tracking):**
   - Use `jira_get_project_versions(project_key="ITPLAT01")` to check if exists
   - If NOT exists: Create using `jira_create_version`:
     - project_key = from "Jira Project ID" URL (e.g., "ITPLAT01")
     - name = Linear project name
     - description = `Linear Project: {project.name}\nInitiative: {initiative.name}`
     - start_date = project.startDate (format: "YYYY-MM-DD")
     - release_date = project.targetDate (format: "YYYY-MM-DD")
   - Store version.id for associating tasks

   **Why both Epic and Version?**
   - **Epic** = work container, shows in roadmaps, links to PMO hierarchy
   - **Version** = release tracking, enables burndowns and release reports
   - Both are needed for complete PMO visibility

4. **For each milestone being synced:**
   - **Estimate story points** using the algorithm in [STORY-POINTS.md](STORY-POINTS.md):
     - Analyze milestone name (inventory=3, validation=2, batch=5, etc.)
     - Apply adjustments for M1, external dependencies, multi-system work
     - Round to Fibonacci: 1, 2, 3, 5, 8, 13, 21
   - **Create JIRA Task** (NOT Epic) for the milestone:
     - summary = Milestone name (e.g., "M1: Tenant Inventory & Archera Handoff")
     - fixVersions = version ID from step 3b
     - duedate = milestone targetDate
     - customfield_10041 = estimated story points (required for Done transition)
     - assignee = "tedgar@ecisolutions.com" (default assignee)
   - **Link JIRA Task to Epic** using `jira_link_to_epic(issue_key, epic_key)`
   - **Create GitHub Issue** with `[JIRA-KEY]` prefix in title:
     - Title: `[ITPLAT01-1777] M1: Tenant Inventory & Archera Handoff`
     - Body: Include JIRA URL for cross-reference
     - Assignee: `RustyAutopsy` (default assignee)

5. **Create/update in JIRA and GitHub** using Atlassian and GitHub MCP tools

## Field Mapping: Linear → JIRA

| Linear Field | JIRA Field | Notes |
|--------------|------------|-------|
| title | summary | Direct mapping |
| description | description | Direct mapping |
| priority (1-4) | priority | Highest/High/Medium/Low |
| state | status | Map using available JIRA transitions |
| (default) | assignee | **Always: `tedgar@ecisolutions.com`** |
| labels | labels | Preserve |
| targetDate | duedate | For epics and issues |
| project | fixVersions | Associate with project's version |
| (estimated) | customfield_10041 | **Story points - auto-estimated** |

**Story Points (Required for Done transition):**
- Field ID: `customfield_10041` (Story Points - workflow validated)
- Uses Fibonacci scale: 1, 2, 3, 5, 8, 13, 21
- Automatically estimated based on milestone complexity, risk, and effort
- **Must be set before transitioning to Done**
- See [STORY-POINTS.md](STORY-POINTS.md) for estimation algorithm and heuristics

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
| (default) | assignees | **Always: `RustyAutopsy`** |
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
- When syncing a Project:
  - Create JIRA **Epic** (the work container for all milestones)
  - Create JIRA **Version** (for release tracking and burndowns)
  - Link Epic to PMO parent using `jira_create_issue_link` with "Parent" link type
- When syncing a Milestone:
  - Create JIRA **Task** (represents the milestone work)
  - Link Task to Epic using `jira_link_to_epic`
  - Associate with Version using `fixVersions`
  - Create corresponding GitHub Issue with `[JIRA-KEY]` prefix

**GitHub Hierarchy:**
- All milestones from Linear projects are created as GitHub Issues in the project's repo
- Issue titles use `[JIRA-KEY] Title` format for smart commits
- Include cross-references to JIRA in the issue body

**Hierarchy Structure:**
```
JIRA Version (from Linear Project) + GitHub Repo
└─ Epic (from Linear Project) → Linked to PMO parent issue
   ├─ Task 1 (from Linear Milestone 1) → GitHub Issue #1
   ├─ Task 2 (from Linear Milestone 2) → GitHub Issue #2
   ├─ Task 3 (from Linear Milestone 3) → GitHub Issue #3
   └─ ...

All JIRA Tasks have:
- Epic link (via jira_link_to_epic)
- fixVersions pointing to the Version
All GitHub issues have:
- [JIRA-KEY] prefix in title for smart commits
- JIRA URL in body for cross-reference
```

## CRITICAL: Linking Issues to Epics

- **DO NOT use the `parent` field** in `additional_fields` to link regular tasks/issues to epics - this will fail silently
- **The `parent` field is ONLY for subtasks**, not for epic relationships
- **ALWAYS use `jira_link_to_epic`** tool after creating the issue:
  ```
  jira_link_to_epic(issue_key="ITPLAT01-1678", epic_key="ITPLAT01-1673")
  ```
- This is the ONLY correct way to establish the epic-issue relationship in JIRA

## CRITICAL: Setting Parent on Epics (for PMO Hierarchy)

When syncing Linear Projects to JIRA Epics, the Epics need their Parent field set to the PMO parent issue (from "Jira Parent ID" in Linear project resources).

**Use `customfield_10018` (Parent Link) to set the native Parent field on Epics:**

```
jira_update_issue(
  issue_key="ITPLAT01-1774",
  fields={},
  additional_fields={"customfield_10018": "ITPMO01-1686"}
)
```

**Or set it during creation:**
```
jira_create_issue(
  project_key="ITPLAT01",
  issue_type="Epic",
  summary="Azure Archera Onboarding",
  additional_fields={"customfield_10018": "ITPMO01-1686"}
)
```

**Why `customfield_10018`?**
- This is the "Parent Link" field used by JIRA Advanced Roadmaps (JPO)
- It sets the **native Parent field** visible in issue details and roadmaps
- The standard `parent` field does NOT work for Epics in company-managed projects
- Do NOT use `jira_create_issue_link` with "Parent" link type - that creates issue links, not the native parent relationship

**Sync workflow for parent links:**
1. Extract parent key from Linear project's "Jira Parent ID" link (e.g., `ITPMO01-1686` from `/browse/ITPMO01-1686`)
2. When creating the JIRA Epic, include `additional_fields={"customfield_10018": "ITPMO01-1686"}`
3. This sets the native Parent field visible in JIRA roadmaps and issue views

**Finding the Parent Link custom field:**
If `customfield_10018` doesn't work in your JIRA instance, search for the correct field:
```
jira_search_fields(query="parent")
```
Look for a field named "Parent Link" with schema type `any` - that's the JPO parent field.
