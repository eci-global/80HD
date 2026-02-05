# Fetching Data from Linear (GraphQL)

## Priority Order

1. **ALWAYS try Linear MCP server FIRST** for all operations
2. **ONLY use GraphQL API** when MCP doesn't support the operation or returns insufficient data

## MCP Limitations (use GraphQL for these)

- Fetching project `externalLinks` (not returned by MCP)
- Fetching project `projectMilestones` (no milestone tools in MCP)
- Any other fields not returned by MCP tools

## Fetching Project External Links

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

**Note:** The Linear API token is configured in `.mcp.json` as `LINEAR_API_KEY`.

**Step 3: Extract Jira Configuration from URLs**
Parse the response to find:
- **Jira Parent ID**: Extract from URL like `https://eci-solutions.atlassian.net/browse/ITPMO01-1619` → `ITPMO01-1619`
- **Jira Project ID**: Extract from URL like `https://eci-solutions.atlassian.net/jira/software/c/projects/ITPLAT01/boards/107` → `ITPLAT01`

**Pattern matching:**
- For "Jira Parent ID" link: Extract the issue key after `/browse/` (e.g., `ITPMO01-1619`)
- For "Jira Project ID" link: Extract the project key after `/projects/` (e.g., `ITPLAT01`)

**Step 4: Use in JIRA Epic Creation and Confluence Parent Page**
- Use `project_key = "ITPLAT01"` (from Jira Project ID)
- **Set parent during Epic creation** using `customfield_10018` (Parent Link):
  ```
  jira_create_issue(
    project_key="ITPLAT01",
    issue_type="Epic",
    summary="Project Name",
    additional_fields={"customfield_10018": "ITPMO01-1619"}
  )
  ```
- **Or update an existing Epic's parent:**
  ```
  jira_update_issue(
    issue_key="ITPLAT01-1774",
    fields={},
    additional_fields={"customfield_10018": "ITPMO01-1619"}
  )
  ```
- **IMPORTANT:** Do NOT use `additional_fields: {"parent": {...}}` - this only works for subtasks
- **IMPORTANT:** Do NOT use `jira_create_issue_link` with "Parent" link type - this creates issue links, not the native Parent field
- See [JIRA-MAPPING.md](JIRA-MAPPING.md#critical-setting-parent-on-epics-for-pmo-hierarchy) for full details
- **For Confluence:** Include JIRA Parent ID link in parent page: `[ITPMO01-1619](https://eci-solutions.atlassian.net/browse/ITPMO01-1619)`

## Fetching Project Milestones

**The Linear MCP server does NOT have milestone tools.** Use GraphQL to fetch milestones.

Create a JSON file with this query (includes project dates for fallback):
```json
{"query":"query { project(id: \"PROJECT_ID_HERE\") { id name startDate targetDate projectMilestones { nodes { id name description sortOrder targetDate } } } }"}
```

Execute the same curl command as above with this query file.

## Initiative Fields (CRITICAL)

**The Initiative type has TWO content fields with different purposes:**

| Field | Type | Limit | Purpose | UI Location |
|-------|------|-------|---------|-------------|
| `description` | String | **255 chars** | Short summary for lists | Shows in initiative cards/lists |
| `content` | String | **Unlimited** | Full markdown content | Shows on initiative page (Description section) |

**Common mistake:** Using `description` for long content will fail with validation error.

**Updating Initiative Content:**
```json
{
  "query": "mutation UpdateInitiative($id: String!, $content: String!) { initiativeUpdate(id: $id, input: { content: $content }) { success initiative { id name content } } }",
  "variables": {
    "id": "INITIATIVE_ID_HERE",
    "content": "## Executive Summary\n\n**Problem**\n\nFull markdown content here..."
  }
}
```

**Fetching Initiative with Both Fields:**
```json
{"query":"query { initiative(id: \"INITIATIVE_ID_HERE\") { id name description content targetDate projects { nodes { id name } } } }"}
```

**Other Key Initiative Fields:**
- `documentContent` - DocumentContent type for structured content
- `links` - External resource links (Confluence Wiki, etc.)
- `documents` - Associated wiki-style documents
- `initiativeUpdates` - Status update posts (separate from content)
- `lastUpdate` - Most recent initiative update

## Fetching Initiative Documents

**Initiative documents are wiki-style content that syncs to GitHub Wiki pages and Confluence pages.**

Create a JSON file with this query:
```json
{"query":"query { initiative(id: \"INITIATIVE_ID_HERE\") { id name description documents { nodes { id title content slugId url } } projects { nodes { id name } } } }"}
```

Execute using the Linear API token:
```bash
curl -X POST https://api.linear.app/graphql \
  -H "Authorization: ${LINEAR_API_KEY}" \
  -H "Content-Type: application/json" \
  --data @/tmp/linear_initiative_query.json
```

**Document fields:**
- `id` - Unique identifier
- `title` - Document title (e.g., "[1] GitOps Modernization – Overview")
- `content` - Full markdown content
- `slugId` - URL-friendly identifier (e.g., "25ef9ec9efe8")
- `url` - Direct Linear URL to the document

**Finding an Initiative by Name:**
```json
{"query":"query { initiatives { nodes { id name description projects { nodes { id name } } } } }"}
```

## Fetching Initiative Links (Resources)

**Initiative links contain configuration for Confluence sync.**

Unlike projects which use `externalLinks`, initiatives use `links` for their resources:
```json
{"query":"query { initiative(id: \"INITIATIVE_ID_HERE\") { id name links { nodes { id label url } } } }"}
```

**Expected links:**
- **Confluence Wiki** - Parent page URL for Confluence documentation
  - URL pattern: `https://eci-solutions.atlassian.net/wiki/spaces/CGIP/pages/1744666626/Page+Title`
  - Extract `space_key` = "CGIP" (after `/spaces/`)
  - Extract `parent_id` = "1744666626" (after `/pages/`)

**Parsing the Confluence URL:**
```
URL: https://eci-solutions.atlassian.net/wiki/spaces/CGIP/pages/1744666626/Establish+GitOps
                                                       ^^^^       ^^^^^^^^^^
                                                       space_key  parent_id
```

**Combined query for documents and links:**
```json
{"query":"query { initiative(id: \"INITIATIVE_ID_HERE\") { id name links { nodes { id label url } } documents { nodes { id title content slugId url } } } }"}
```

## Date Handling

- Each milestone has its own `targetDate` - use this as the JIRA epic's `duedate`
- If a milestone doesn't have a `targetDate`, use the project's `targetDate` as fallback
- This supports the sprint-less workflow where projects have target dates instead of sprints

## Cascading Date Updates (CRITICAL)

When a Linear project's `targetDate` changes, these JIRA items must be updated:
1. **JIRA Version** - Update `releaseDate` to match new project targetDate
2. **JIRA Epics using fallback date** - If an Epic's `duedate` came from the project targetDate (because milestone had no targetDate), update the Epic's duedate
3. **Track which dates are inherited** - When creating Epics, note in description whether duedate is from milestone or project fallback

**How to detect fallback dates during re-sync:**
- Compare Epic's current `duedate` with the OLD project targetDate
- If they match, the Epic used the project fallback → update to new project targetDate
- If they don't match, the Epic has its own milestone targetDate → leave unchanged unless milestone targetDate changed

## Creating Issues from Milestone Content

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

## Updating Linear Issues

**The Linear MCP server does NOT have an update_issue tool.** Use GraphQL to update issue descriptions, states, or other fields.

**Update Issue Description (for cross-references):**
```json
{
  "query": "mutation UpdateIssue($id: String!, $description: String!) { issueUpdate(id: $id, input: { description: $description }) { success issue { id identifier url } } }",
  "variables": {
    "id": "ECI-33",
    "description": "Updated description with cross-references\n\n---\n**External Links:**\n- JIRA: [ITPLAT01-1678](https://eci-solutions.atlassian.net/browse/ITPLAT01-1678)\n- GitHub: [eci-global/gitops#1](https://github.com/eci-global/gitops/issues/1)"
  }
}
```

**Update Issue State:**
```json
{
  "query": "mutation { issueUpdate(id: \"ECI-32\", input: { stateId: \"d4b71775-b8db-4da0-a60d-6a09b559bcb4\" }) { success } }"
}
```

**Get Workflow States (to find state IDs):**
```json
{
  "query": "query { workflowStates(filter: { team: { key: { eq: \"ECI\" } } }) { nodes { id name type } } }"
}
```

**Execute the mutation:**
```bash
curl -X POST https://api.linear.app/graphql \
  -H "Authorization: ${LINEAR_API_KEY}" \
  -H "Content-Type: application/json" \
  --data @/tmp/linear_update_query.json
```

## Creating Initiatives (GraphQL Only)

**The Linear MCP server does NOT support creating initiatives.** Use GraphQL mutations.

**Create Initiative:**
```json
{
  "query": "mutation CreateInitiative($name: String!, $teamId: String!, $description: String, $content: String) { initiativeCreate(input: { name: $name, teamId: $teamId, description: $description, content: $content }) { success initiative { id name url } } }",
  "variables": {
    "name": "2026 Q1 - Archera Multi-Cloud Onboarding",
    "teamId": "675589d1-b953-4178-a9af-6d85b93fe8a6",
    "description": "Onboard Azure subscriptions and GCP to Archera for automated savings plan management.",
    "content": "## Executive Summary\n\nFull markdown content here..."
  }
}
```

**Important fields:**
- `name` - Initiative name (required)
- `teamId` - Team UUID (required) - use `linear_get_teams` MCP tool to find
- `description` - Short summary (255 char limit, shows in cards/lists)
- `content` - Full markdown (unlimited, shows on initiative page)

## Creating Projects (GraphQL Only)

**The Linear MCP has `linear_create_project_with_issues` but it doesn't support initiative linking.** For initiative-linked projects, use GraphQL.

**Step 1: Create Project:**
```json
{
  "query": "mutation { projectCreate(input: { name: \"Azure Archera Onboarding\", teamIds: [\"675589d1-b953-4178-a9af-6d85b93fe8a6\"], startDate: \"2026-02-01\", targetDate: \"2026-02-14\", description: \"Complete Azure subscription onboarding to Archera\" }) { success project { id name url } } }"
}
```

**Step 2: Link Project to Initiative:**
```json
{
  "query": "mutation { initiativeToProjectCreate(input: { initiativeId: \"INITIATIVE_ID_HERE\", projectId: \"PROJECT_ID_HERE\", sortOrder: 1.0 }) { success } }"
}
```

**Note:** `TimelessDate` format is `YYYY-MM-DD` (no time component). Projects must be created first, then linked to initiatives via `initiativeToProjectCreate`.

## Creating Milestones (GraphQL Only)

**The Linear MCP server has NO milestone tools.** Use GraphQL.

**Create Milestone under Project:**
```json
{
  "query": "mutation CreateMilestone($projectId: String!, $name: String!, $targetDate: TimelessDate, $description: String, $sortOrder: Float) { projectMilestoneCreate(input: { projectId: $projectId, name: $name, targetDate: $targetDate, description: $description, sortOrder: $sortOrder }) { success projectMilestone { id name } } }",
  "variables": {
    "projectId": "PROJECT_ID_HERE",
    "name": "M1: Tenant Inventory & Archera Handoff",
    "targetDate": "2026-02-05",
    "description": "Export data, engage Archera support",
    "sortOrder": 1.0
  }
}
```

**sortOrder:** Controls display order. Use 1.0, 2.0, 3.0 etc. for sequential milestones.

## Creating Resource Links (GraphQL Only)

**Links are how you configure JIRA, GitHub, and Confluence targets.**

**Add Link to Project or Initiative (uses entityExternalLinkCreate):**
```json
{
  "query": "mutation { entityExternalLinkCreate(input: { projectId: \"PROJECT_ID_HERE\", label: \"GitHub Repo\", url: \"https://github.com/eci-global/archera\" }) { success entityExternalLink { id label url } } }"
}
```

**Add Link to Initiative:**
```json
{
  "query": "mutation { entityExternalLinkCreate(input: { initiativeId: \"INITIATIVE_ID_HERE\", label: \"Confluence Wiki\", url: \"https://eci-solutions.atlassian.net/wiki/spaces/CGIP/pages/123456/Archera+Onboarding\" }) { success entityExternalLink { id label url } } }"
}
```

**Note:** Use `projectId` for project links, `initiativeId` for initiative links. The `entityExternalLinkCreate` mutation supports both.

**Required links for sync to work:**

| Label | Where | Purpose |
|-------|-------|---------|
| `Jira Parent ID` | Project | JIRA epic/issue key for parent link |
| `Jira Project ID` | Project | JIRA project board URL (extracts project key) |
| `GitHub Repo` | Project | GitHub repository for issues and wiki |
| `Confluence Wiki` | Initiative | Parent Confluence page URL |

## Complete Initiative Creation Example

**Step 1: Get Team ID**
```bash
# Use Linear MCP
linear_get_teams()
# Returns: ECI Platform Team = 675589d1-b953-4178-a9af-6d85b93fe8a6
```

**Step 2: Create Initiative**
```json
{"query":"mutation { initiativeCreate(input: { name: \"2026 Q1 - Archera Multi-Cloud Onboarding\", teamId: \"675589d1-b953-4178-a9af-6d85b93fe8a6\", description: \"Onboard Azure and GCP to Archera for automated RI/SP management.\" }) { success initiative { id name } } }"}
```

**Step 3: Create Projects under Initiative**
```json
{"query":"mutation { projectCreate(input: { name: \"Azure Archera Onboarding\", teamIds: [\"675589d1-b953-4178-a9af-6d85b93fe8a6\"], initiativeIds: [\"INIT_ID\"], targetDate: \"2026-02-14\" }) { success project { id } } }"}
```

**Step 4: Add Resource Links to Projects**
```json
{"query":"mutation { projectLinkCreate(input: { projectId: \"PROJ_ID\", label: \"GitHub Repo\", url: \"https://github.com/eci-global/archera\" }) { success } }"}
```

**Step 5: Create Milestones under Projects**
```json
{"query":"mutation { projectMilestoneCreate(input: { projectId: \"PROJ_ID\", name: \"M1: Tenant Inventory\", targetDate: \"2026-02-05\", sortOrder: 1.0 }) { success projectMilestone { id } } }"}
```

**Step 6: Add Confluence Link to Initiative**
```json
{"query":"mutation { initiativeLinkCreate(input: { initiativeId: \"INIT_ID\", label: \"Confluence Wiki\", url: \"https://eci-solutions.atlassian.net/wiki/spaces/CGIP/pages/123/Archera\" }) { success } }"}
```

## Creating Initiative Updates (Status Posts)

**Use initiative updates for status posts, NOT the content field.** Initiative updates appear in a timeline and support health status indicators.

**Create Status Update:**
```json
{
  "query": "mutation CreateUpdate($initiativeId: String!, $body: String!, $health: InitiativeUpdateHealthType) { initiativeUpdateCreate(input: { initiativeId: $initiativeId, body: $body, health: $health }) { success initiativeUpdate { id url createdAt } } }",
  "variables": {
    "initiativeId": "INITIATIVE_ID_HERE",
    "body": "## Status Title\n\nUpdate content with markdown...\n\n**Next Steps:**\n- Action item 1\n- Action item 2",
    "health": "onTrack"
  }
}
```

**Health values:**
| Value | Meaning | When to use |
|-------|---------|-------------|
| `onTrack` | 🟢 Green | Initiative proceeding as planned |
| `atRisk` | 🟡 Yellow | Potential blockers or delays |
| `offTrack` | 🔴 Red | Significant issues requiring attention |

**Fetch Initiative Updates:**
```json
{"query":"query { initiative(id: \"INIT_ID\") { initiativeUpdates { nodes { id body health createdAt user { name } } } lastUpdate { body health createdAt } } }"}
```

**Update template:**
```markdown
## [Status Title]

[Brief status summary - what happened, what's next]

| Platform | Link | Purpose |
| -- | -- | -- |
| **Linear** | [Initiative](url) | Source of truth |
| **GitHub** | [repo](url) | Code/automation |
| **JIRA** | [ITPLAT01-XXX](url) | PMO tracking |

**Completed:**
- [x] Item completed

**Next Steps:**
- [ ] Action item 1
- [ ] Action item 2
```
