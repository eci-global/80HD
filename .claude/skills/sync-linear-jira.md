---
name: sync-linear-jira
description: Sync data from Linear to JIRA and GitHub with natural language instructions
---

You have access to Linear, Atlassian (JIRA), and GitHub MCP servers. The user will provide natural language sync instructions.

## Platform Roles (Why Each System Exists)

**This three-platform model serves different audiences:**

| Platform | Role | Primary Audience | What Lives Here |
|----------|------|------------------|-----------------|
| **Linear** | **Source of Truth** | Platform Enablement Team | Projects, Milestones, task definitions, target dates, structure |
| **GitHub** | **Developer Workspace** | Developers & Engineers | Issues to work on, PRs, code, automation |
| **JIRA** | **PMO/Leadership View** | PMO, Leadership, Stakeholders | Versions, Epics, Tasks for release tracking and reporting |

**Key Principles:**
- **Linear is authoritative** - All content, dates, and structure originate in Linear
- **GitHub is where work happens** - Developers see GitHub issues, not Linear or JIRA
- **JIRA is for visibility** - PMO and leadership track progress via JIRA versions, epics, and release reports
- **Sync is one-way** - Linear → JIRA and Linear → GitHub (never the reverse)
- **Updates cascade** - When you change something in Linear (like a targetDate), all downstream items in JIRA update accordingly

## Overview

This skill syncs Linear data to JIRA and GitHub with a **release-based, sprint-less workflow**:

**Automatic Version Creation:**
- Every Linear Project automatically creates a JIRA Version/Release
- Version tracks the project's start and target dates
- All epics and tasks from that project are associated with the version

**Complete Hierarchy:**
```
Linear Initiative → JIRA (metadata in descriptions)
  └─ Linear Project → JIRA Version/Release
      └─ Linear Milestone → JIRA Epic (associated with version)
          └─ Linear Issue → JIRA Task (associated with version)
```

## Simplified Sync Mapping:

**Linear → JIRA:**
- **Linear Initiative** → Metadata only (included in version/epic descriptions for context)
- **Linear Project** → **JIRA Version/Release** (automatically created, one version per project)
  - Version name = Project name
  - Version startDate = Project startDate
  - Version releaseDate = Project targetDate
  - Version description = Includes project and initiative info
- **Linear Milestones** → **JIRA Epics** (linked to parent, associated with project's version via fixVersions)
- **Linear Issues** → **JIRA Tasks** (with Epic Link if the issue belongs to a Milestone, associated with project's version via fixVersions)

**Key Principle:**
Every Linear Project gets its own JIRA Version. All epics and tasks from that project are associated with that version via the `fixVersions` field. This enables release-based tracking without sprints.

## JIRA Versions/Releases:

**What are JIRA Versions?**
JIRA Versions (also called "Fix Versions" or "Releases") are purpose-built for milestone/release tracking:
- Represent points-in-time or release targets
- Have `name`, `description`, `startDate`, `releaseDate`
- Have `released` boolean to mark completion
- Can be `archived` when no longer active
- Issues/Epics associate via `fixVersions` field (array)

**Why use Versions for Linear Projects?**
- **Sprint-less workflow** - Release dates replace sprint boundaries
- **Built-in tracking** - JIRA release reports, burndowns work automatically
- **Clear organization** - All epics and tasks grouped by release
- **Purpose-built** - Designed specifically for milestone/release tracking

## JIRA Configuration from Linear Projects:

Linear Projects have URL links in the "Resources" section that specify JIRA configuration:

**Required Project Links:**
- **Jira Parent ID** - The JIRA issue key to use as parent when creating epics (e.g., "ITPMO01-1619")
- **Jira Project ID** - The JIRA project key where epics should be created (e.g., "ITPLAT01")
- **GitHub Repo** - The GitHub repository where developer issues should be created (e.g., "https://github.com/eci-global/gitops")

**Example:**
- Linear Project "GitOps Reference Architecture & Operating Model" has:
  - Resources → "Jira Parent ID" link → URL: `https://eci-solutions.atlassian.net/browse/ITPMO01-1619`
  - Resources → "Jira Project ID" link → URL: `https://eci-solutions.atlassian.net/jira/software/c/projects/ITPLAT01/boards/107`
  - Resources → "GitHub Repo" link → URL: `https://github.com/eci-global/gitops`
- When syncing Milestones from this Project:
  - Create JIRA Epic in the specified project with the specified parent
  - Create GitHub Issues in the specified repository for each extracted task

## Fetching Data (Hybrid Approach):

**PRIORITY ORDER:**
1. **ALWAYS try Linear MCP server FIRST** for all operations
2. **ONLY use GraphQL API** when MCP doesn't support the operation or returns insufficient data

**MCP Limitations (use GraphQL for these):**
- Fetching project `externalLinks` (not returned by MCP)
- Fetching project `projectMilestones` (no milestone tools in MCP)
- Any other fields not returned by MCP tools

### Fetching Project External Links:

**Step 1: Get the Project ID from Linear MCP**
Use `linear_search_projects` or `linear_get_project` to get the project ID.

**Step 2: Query External Links and Dates via GraphQL**
Create a JSON file with this query:
```json
{"query":"query { project(id: \"PROJECT_ID_HERE\") { id name startDate targetDate externalLinks { nodes { id label url } } } }"}
```

Then execute using the Linear API token from .mcp.json:
```bash
curl -X POST https://api.linear.app/graphql \
  -H "Authorization: ${LINEAR_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data @/tmp/linear_project_query.json
```

**Note:** The Linear API token is configured in `.mcp.json` as `LINEAR_ACCESS_TOKEN` and used for all GraphQL queries.

**Step 3: Extract Jira Configuration from URLs**
Parse the response to find:
- **Jira Parent ID**: Extract from URL like `https://eci-solutions.atlassian.net/browse/ITPMO01-1619` → `ITPMO01-1619`
- **Jira Project ID**: Extract from URL like `https://eci-solutions.atlassian.net/jira/software/c/projects/ITPLAT01/boards/107` → `ITPLAT01`

**Pattern matching:**
- For "Jira Parent ID" link: Extract the issue key after `/browse/` (e.g., `ITPMO01-1619`)
- For "Jira Project ID" link: Extract the project key after `/projects/` (e.g., `ITPLAT01`)

**Step 4: Use in JIRA Epic Creation**
- Use `project_key = "ITPLAT01"` (from Jira Project ID)
- Include `additional_fields: {"parent": {"key": "ITPMO01-1619"}}` (from Jira Parent ID)

### Fetching Project Milestones:

**The Linear MCP server does NOT have milestone tools.** Use GraphQL to fetch milestones.

Create a JSON file with this query (includes project dates for fallback):
```json
{"query":"query { project(id: \"PROJECT_ID_HERE\") { id name startDate targetDate projectMilestones { nodes { id name description sortOrder targetDate } } } }"}
```

Execute the same curl command as above with this query file to get all milestones for a project.

**Date Handling:**
- Each milestone has its own `targetDate` - use this as the JIRA epic's `duedate`
- If a milestone doesn't have a `targetDate`, use the project's `targetDate` as fallback
- This supports the sprint-less workflow where projects have target dates instead of sprints

**Cascading Date Updates (CRITICAL):**
When a Linear project's `targetDate` changes, these JIRA items must be updated:
1. **JIRA Version** - Update `releaseDate` to match new project targetDate
2. **JIRA Epics using fallback date** - If an Epic's `duedate` came from the project targetDate (because milestone had no targetDate), update the Epic's duedate
3. **Track which dates are inherited** - When creating Epics, note in description whether duedate is from milestone or project fallback

**How to detect fallback dates during re-sync:**
- Compare Epic's current `duedate` with the OLD project targetDate
- If they match, the Epic used the project fallback → update to new project targetDate
- If they don't match, the Epic has its own milestone targetDate → leave unchanged unless milestone targetDate changed

### Creating Issues from Milestone Content:

**IMPORTANT:** Linear Milestones contain structured descriptions with tasks that need to be extracted and created as issues.

**The milestone `description` field contains the source tasks.** Parse the description to extract actionable items:

1. **Read the milestone description** - It typically contains sections like:
   - "Build / Do" - Contains bullet points of tasks to complete
   - "Success signal" - Success criteria
   - Other sections with actionable items

2. **Extract tasks from "Build / Do" section:**
   - Each bullet point becomes a separate JIRA Task and GitHub Issue
   - Nested bullets can become sub-bullets in the task description
   - Preserve the context from the milestone description

3. **Create issues from extracted tasks:**
   - **JIRA Task** - One task per bullet point, linked to the Epic
   - **GitHub Issue** - Corresponding GitHub issue with cross-references

**Example milestone description:**
```markdown
**Goal:** Set expectations before touching tools.

### Build / Do

* Identify **3 pilot teams** aligned to Q1 initiatives
* Hold a short *GitOps Contract* session with each team

### Success signal
* Teams opt in knowingly
```

**Extracted tasks:**
1. "Identify 3 pilot teams aligned to Q1 initiatives"
2. "Hold a short GitOps Contract session with each team"

**Each extracted task becomes:**
- JIRA Task (linked to Epic, associated with version)
- GitHub Issue (with cross-references to JIRA and Linear milestone)

## Sync Behavior:

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
   - If EXISTS: Update the version if dates have changed (future enhancement)
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

6. **Intelligent field mapping:**
   - title → summary
   - description → description
   - priority (1-4) → priority (Highest/High/Medium/Low)
   - state → status (map intelligently using available JIRA transitions)
   - assignee → assignee (match by email/name)
   - labels → labels (preserve)
   - **targetDate → duedate** (for epics and issues)
   - **project → fixVersions** (associate epics and issues with the project's version)
   - custom fields → use LLM reasoning to match semantically

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

7. **GitHub field mapping:**
   - title → title
   - description → body (markdown format)
   - labels → labels (create labels if they don't exist in GitHub repo)
   - assignee → assignee (match by GitHub username)
   - state → state (open/closed)
   - **Add cross-references** in the GitHub issue body:
     - "**JIRA:** [ITPLAT01-123](https://eci-solutions.atlassian.net/browse/ITPLAT01-123)"
     - "**Linear:** [LIN-123](linear-url)"
   - Use GitHub MCP `create_issue` tool

8. **Maintain hierarchy:**

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

   **CRITICAL - Linking Issues to Epics:**
   - **DO NOT use the `parent` field** in `additional_fields` to link regular tasks/issues to epics - this will fail silently
   - **The `parent` field is ONLY for subtasks**, not for epic relationships
   - **ALWAYS use `jira_link_to_epic`** tool after creating the issue:
     ```
     jira_link_to_epic(issue_key="ITPLAT01-1678", epic_key="ITPLAT01-1673")
     ```
   - This is the ONLY correct way to establish the epic-issue relationship in JIRA

9. **Idempotent sync (prevent duplicates and handle updates):**

   **CRITICAL:** The sync must be idempotent - running it multiple times should NOT create duplicates.

   **Detection Strategy - Check if items already exist:**

   **For JIRA Versions:**
   - Use `jira_get_project_versions(project_key)` to get all versions
   - Match by `name` field (exact match with Linear project name)
   - If exists: Update releaseDate if Linear project targetDate changed
   - If not exists: Create new version

   **For JIRA Epics:**
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

   **For JIRA Tasks:**
   - Use `jira_search` with JQL: `project = ITPLAT01 AND issuetype = Task AND summary ~ "task-title"`
   - Match by `summary` field (exact match with extracted task title)
   - Alternative: Store Linear milestone ID in task description for precise matching
   - If exists: Update using `jira_update_issue`:
     - Update `description` if task content changed
     - Update `fixVersions` if project version changed
     - Ensure epic link is correct using `jira_link_to_epic`
   - If not exists: Create new task

   **For GitHub Issues:**
   - Use `search_issues` with query: `repo:eci-global/gitops is:issue "task-title" in:title`
   - Match by `title` field (exact match)
   - Alternative: Check issue body for JIRA cross-reference to match
   - If exists: Update using `update_issue`:
     - Update `body` if content changed
     - Update `labels` if milestone changed
     - Keep issue open unless explicitly closed in Linear
   - If not exists: Create new issue

   **Tracking Date Sources (for cascading updates):**
   - When creating JIRA Version, store the project targetDate as `releaseDate`
   - When creating Epic with fallback date, include in description: `[Date source: project fallback]`
   - When creating Epic with milestone-specific date, include: `[Date source: milestone]`
   - During re-sync, check these markers to determine if cascading update is needed
   - Alternative: Store project targetDate in a custom field or compare Version releaseDate

   **Update Priority (Linear as source of truth):**
   - **Always update from Linear:** description, dates (targetDate → duedate/releaseDate), version associations
   - **Preserve JIRA-specific:** status/state, assignee, priority, comments, worklog
   - **Preserve GitHub-specific:** assignees, comments, reactions
   - When in doubt, Linear data wins for content and structure

   **What triggers updates in each system:**
   | Linear Change | JIRA Update | GitHub Update |
   |---------------|-------------|---------------|
   | Project targetDate | Version releaseDate + Epics using fallback date | None (GitHub issues don't have dates) |
   | Milestone targetDate | Epic duedate | None |
   | Milestone description | Epic description + Task descriptions | Issue body |
   | Task content (in description) | Task summary/description | Issue title/body |
   | Project name | Version name | None |
   | Milestone name | Epic summary | Issue labels |

10. **Ask for confirmation** before bulk operations (>10 items)

## Examples:

### Example 1: Sync an entire Linear Initiative with all Projects

User: /sync-linear-jira sync initiative "2026 Q1 - Establish GitOps as the Default Operating Model"
You:
1. Use Linear MCP to find the initiative and get all projects under it
2. Use GraphQL to get full project details (externalLinks, milestones, dates) for each project
3. For EACH project in the initiative:
   - Extract Jira Project ID and Parent ID from project URLs
   - **Create JIRA Version** using `jira_create_version`:
     - name = project name (e.g., "GitOps Reference Architecture & Operating Model")
     - description = "Linear Project: {project.name}\nInitiative: 2026 Q1 - Establish GitOps as the Default Operating Model"
     - start_date = project.startDate
     - release_date = project.targetDate
   - Store version.id
   - For each milestone in the project:
     - Create Epic with parent link and fixVersions pointing to this project's version
     - **Parse milestone description** to extract tasks from "Build / Do" section
     - For each extracted task:
       - Create JIRA Task with fixVersions pointing to this project's version
       - Link task to epic using `jira_link_to_epic`
       - Create GitHub Issue in the project's GitHub repo with cross-references
4. Confirm: "✓ Synced initiative with 4 projects:
   - Created version 'GitOps Reference Architecture & Operating Model' with 5 epics, 16 tasks
   - Created version 'GitOps Phase 1 Team Enablement' with 3 epics, 12 tasks
   - Created version 'Policy Security & Guardrails' with 2 epics, 8 tasks
   - Created version 'Manual Change Path Reduction' with 4 epics, 15 tasks"

### Example 2: Sync a Single Milestone from a Project

User: /sync-linear-jira sync milestone "Define the Operating Model (Behavior First)"
You:
1. **Try Linear MCP FIRST:** Use `linear_search_projects` to find project "GitOps Reference Architecture & Operating Model"
   - Get project details with MCP
   - Note: MCP returns basic project info but NOT externalLinks or milestones
2. **Fill gaps with GraphQL:** Since MCP doesn't return externalLinks or milestones:
   - Create `/tmp/linear_project_query.json` with GraphQL query for externalLinks, projectMilestones, and dates
   - Use Bash to execute GraphQL query
3. Parse response to extract:
   - Jira Parent ID: Extract `ITPMO01-1619` from `/browse/ITPMO01-1619`
   - Jira Project ID: Extract `ITPLAT01` from `/projects/ITPLAT01/`
   - Project dates: startDate, targetDate
   - Milestone details: name, description, targetDate
   - Project targetDate: Use as fallback if milestone has no targetDate
4. **Create/Find JIRA Version:**
   - Use `jira_get_project_versions(project_key="ITPLAT01")` to check if version exists
   - If not: Use `jira_create_version` with:
     - project_key = "ITPLAT01"
     - name = "GitOps Reference Architecture & Operating Model"
     - description = "Linear Project: GitOps Reference Architecture & Operating Model\nInitiative: 2026 Q1 - Establish GitOps as the Default Operating Model"
     - start_date = project.startDate
     - release_date = project.targetDate
   - Store version.id for later
5. **Create JIRA Epic** using `jira_create_issue`:
   - project_key = "ITPLAT01"
   - issue_type = "Epic"
   - summary = milestone name
   - description = milestone description
   - additional_fields = {
       "parent": {"key": "ITPMO01-1619"},
       "duedate": milestone.targetDate || project.targetDate,
       "fixVersions": [{"id": version.id}]  // Associate with version
     }
   - Store epic_key (e.g., "ITPLAT01-142")
6. **Parse milestone description** to extract tasks:
   - Read the milestone description field
   - Extract bullet points from "Build / Do" section
   - Each bullet point becomes a task title
7. **For each extracted task:**
   - **Create JIRA Task** using `jira_create_issue`:
     - project_key = "ITPLAT01"
     - issue_type = "Task"
     - summary = extracted task title
     - description = context from milestone + task details
     - additional_fields = {"fixVersions": [{"id": version.id}]}
   - **Link to Epic** using `jira_link_to_epic(issue_key, epic_key)`
   - **Create GitHub Issue** using GitHub MCP:
     - owner = "eci-global" (from GitHub Repo URL)
     - repo = "gitops" (from GitHub Repo URL)
     - title = extracted task title
     - body = task description + cross-references to JIRA task and Linear milestone
     - labels = [milestone name]
8. Confirm: "✓ Created JIRA Epic ITPLAT01-142 with 5 tasks (extracted from milestone description) and 5 GitHub issues in eci-global/gitops (linked to parent ITPMO01-1619, release: GitOps Reference Architecture & Operating Model, due: 2026-03-31)"

### Example 3: Create Tasks from Milestone Content

User: /sync-linear-jira sync all issues in milestone "Q1 Launch"
You:
1. Use GraphQL to get milestone description
2. Get the project info to find:
   - JIRA version ID
   - GitHub Repo URL
3. Check if JIRA Epic exists for "Q1 Launch" milestone (search or ask user for Epic key)
4. **Parse milestone description** to extract tasks from "Build / Do" section
5. For each extracted task:
   - **Create JIRA Task:**
     - type="Task" or "Story" (ask user for default type)
     - Map priority, status, assignee, labels
     - Set fixVersions to the project's version: `additional_fields: {"fixVersions": [{"id": version.id}]}`
   - **Link to Epic:** Use `jira_link_to_epic` to link it to the Epic
     - Example: `jira_link_to_epic(issue_key="ENG-150", epic_key="ENG-142")`
     - **DO NOT** try to set Epic Link via `parent` field or `additional_fields` during creation
   - **Create GitHub Issue:**
     - Use GitHub MCP `create_issue` tool
     - Include cross-references to JIRA and Linear milestone
     - Add milestone label
6. Confirm: "✓ Extracted 15 tasks from milestone 'Q1 Launch' description, created JIRA tasks linked to Epic ENG-142, and created 15 GitHub issues"

### Example 4: Sync a Single Issue

User: /sync-linear-jira sync issue LIN-456
You:
1. Use Linear MCP to get issue LIN-456
2. Check if issue belongs to a Milestone
3. Get the issue's Project to determine:
   - Which JIRA project to use
   - GitHub Repo URL
4. Extract "Jira Project ID" from the Project's URL links
5. Get the JIRA version for the project (or create if needed)
6. **Create JIRA Issue** in the specified project with mapped fields
   - Include `fixVersions: [{"id": version.id}]` in additional_fields
7. If issue belongs to a Milestone:
   - Find corresponding JIRA Epic key
   - Use `jira_link_to_epic(issue_key="ECI-789", epic_key="ECI-142")` to link them
8. **Create GitHub Issue** in the project's repo:
   - Use GitHub MCP `create_issue` tool
   - Include cross-references to JIRA and Linear
   - Add milestone label if applicable
9. Confirm: "✓ Created JIRA Issue ECI-789 and GitHub Issue #42 in project ECI, linked to Epic ECI-142, release: Project Name"

### Example 5: Re-sync with Updates (Idempotent Behavior + Cascading Dates)

User: /sync-linear-jira sync project "GitOps Phase 1 Team Enablement (Embedded)" (note: this project was already synced before, but I updated the targetDate in Linear from 2026-02-27 to 2026-03-15)
You:
1. **Try Linear MCP FIRST:** Use `linear_search_projects` to find the project
2. **Fill gaps with GraphQL:** Fetch project details including externalLinks, milestones, and dates
3. **Check for existing JIRA Version (idempotency):**
   - Use `jira_get_project_versions(project_key="ITPLAT01")` to get all versions
   - Search for version with name matching "GitOps Phase 1 Team Enablement (Embedded)"
   - **Found existing version (id: "29167")** with releaseDate: "2026-02-27"
   - Compare Linear project targetDate: "2026-03-15" (CHANGED!)
   - **UPDATE DECISION:** Version exists but targetDate changed → Update the version
   - Execute: `jira_update_issue` or version API to update releaseDate
   - Note: "Updated Version releaseDate from 2026-02-27 to 2026-03-15"
4. **Cascading date check for Epics:**
   - OLD project targetDate was: "2026-02-27"
   - NEW project targetDate is: "2026-03-15"
   - For each milestone, check if Epic used fallback date:
     - **Milestone "Select & Contract with Pilot Teams"** - has NO milestone targetDate
       - Epic ITPLAT01-1694 has duedate: "2026-02-27" (matches OLD project date!)
       - **CASCADING UPDATE:** Epic used fallback date → Update duedate to "2026-03-15"
       - Execute: `jira_update_issue(issue_key="ITPLAT01-1694", fields={"duedate": "2026-03-15"})`
     - **Milestone "Platform-Led First Change"** - has milestone targetDate: "2026-01-31"
       - Epic ITPLAT01-1695 has duedate: "2026-01-31" (matches milestone date, not project)
       - **NO UPDATE NEEDED:** Epic has its own milestone-specific date
     - Continue checking remaining Epics...
5. **Check for existing JIRA Tasks and GitHub Issues:**
   - For each extracted task:
     - **Check for existing JIRA Task (idempotency):**
       - Use `jira_search` with JQL: `project = ITPLAT01 AND issuetype = Task AND summary ~ "Identify 3 pilot teams aligned to Q1 initiatives"`
       - **Found existing Task: ITPLAT01-1699**
       - Compare task description - unchanged
       - Verify Epic link: correct
       - **SKIP:** No updates needed
     - **Check for existing GitHub Issue (idempotency):**
       - Use `search_issues` with query: `repo:eci-global/gitops is:issue "Identify 3 pilot teams" in:title`
       - **Found existing GitHub Issue #17**
       - Compare issue body content - unchanged
       - **SKIP:** No updates needed
   - Continue for remaining tasks...
6. **Summary of idempotent sync with cascading updates:**
   - ✓ Updated JIRA Version "GitOps Phase 1 Team Enablement (Embedded)" (releaseDate: 2026-02-27 → 2026-03-15)
   - ✓ Updated 3 Epics with cascading date change (duedate: 2026-02-27 → 2026-03-15)
     - ITPLAT01-1694 (used project fallback)
     - ITPLAT01-1697 (used project fallback)
     - ITPLAT01-1698 (used project fallback)
   - ✓ Skipped 2 Epics (ITPLAT01-1695, ITPLAT01-1696) - have milestone-specific dates
   - ✓ Found 12 existing Tasks - no updates needed
   - ✓ Found 12 existing GitHub Issues - no updates needed
   - **No duplicates created**
   - **4 items updated** (1 Version + 3 Epics with cascading dates)
   - **26 items skipped** (already up-to-date)

**Key Takeaways from this example:**
- Re-running sync doesn't create duplicates
- **Cascading updates work:** Project targetDate change → Version releaseDate + Epics using fallback dates
- Epics with milestone-specific dates are NOT affected by project date changes
- JIRA tasks and GitHub issues don't have dates, so date changes don't affect them
- Linear remains the source of truth for content, dates, and structure
