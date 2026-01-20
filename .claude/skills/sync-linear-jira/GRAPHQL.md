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

**Note:** The Linear API token is configured in `.mcp.json` as `LINEAR_ACCESS_TOKEN`.

**Step 3: Extract Jira Configuration from URLs**
Parse the response to find:
- **Jira Parent ID**: Extract from URL like `https://eci-solutions.atlassian.net/browse/ITPMO01-1619` → `ITPMO01-1619`
- **Jira Project ID**: Extract from URL like `https://eci-solutions.atlassian.net/jira/software/c/projects/ITPLAT01/boards/107` → `ITPLAT01`

**Pattern matching:**
- For "Jira Parent ID" link: Extract the issue key after `/browse/` (e.g., `ITPMO01-1619`)
- For "Jira Project ID" link: Extract the project key after `/projects/` (e.g., `ITPLAT01`)

**Step 4: Use in JIRA Epic Creation and Confluence Parent Page**
- Use `project_key = "ITPLAT01"` (from Jira Project ID)
- Include `additional_fields: {"parent": {"key": "ITPMO01-1619"}}` (from Jira Parent ID)
- **For Confluence:** Include JIRA Parent ID link in parent page: `[ITPMO01-1619](https://eci-solutions.atlassian.net/browse/ITPMO01-1619)`

## Fetching Project Milestones

**The Linear MCP server does NOT have milestone tools.** Use GraphQL to fetch milestones.

Create a JSON file with this query (includes project dates for fallback):
```json
{"query":"query { project(id: \"PROJECT_ID_HERE\") { id name startDate targetDate projectMilestones { nodes { id name description sortOrder targetDate } } } }"}
```

Execute the same curl command as above with this query file.

## Fetching Initiative Documents

**Initiative documents are wiki-style content that syncs to GitHub Wiki pages and Confluence pages.**

Create a JSON file with this query:
```json
{"query":"query { initiative(id: \"INITIATIVE_ID_HERE\") { id name description documents { nodes { id title content slugId url } } projects { nodes { id name } } } }"}
```

Execute using the Linear API token:
```bash
curl -X POST https://api.linear.app/graphql \
  -H "Authorization: ${LINEAR_ACCESS_TOKEN}" \
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
