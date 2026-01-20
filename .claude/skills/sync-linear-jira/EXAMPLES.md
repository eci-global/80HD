# Sync Examples

## Example 1: Sync Initiative Documents to GitHub Wiki

User: /sync-linear-jira sync documents from initiative "2026 Q1 - Establish GitOps as the Default Operating Model" to GitHub wiki

You:
1. **Find the initiative:** Use GraphQL to query all initiatives and find by name
   ```json
   {"query":"query { initiatives { nodes { id name } } }"}
   ```
2. **Fetch initiative documents:** Query the initiative with documents
   ```json
   {"query":"query { initiative(id: \"3617f995-d28f-487e-85e4-c1ccd2d03360\") { id name documents { nodes { id title content slugId url } } projects { nodes { id name } } } }"}
   ```
3. **Get the GitHub repo from a project in the initiative:**
   - Query project externalLinks for "GitHub Repo" URL
   - Extract owner/repo (e.g., "eci-global/gitops")
4. **Clone the wiki repository:**
   ```bash
   git clone https://github.com/eci-global/gitops.wiki.git /tmp/gitops-wiki
   ```
5. **For each document, create a wiki page:**
   - Clean title for filename:
     - `[0] Wiki Table of Contents` → `Home.md`
     - `[1] GitOps Modernization – Overview` → `GitOps-Modernization-Overview.md`
     - Remove brackets, replace spaces with hyphens, remove special chars
   - Write content with Linear source link at bottom:
     ```markdown
     [Document content here]

     ---
     *Source: [Linear](https://linear.app/eci-platform-team/document/...)*
     ```
6. **Create _Sidebar.md for navigation:**
   ```markdown
   ### GitOps Documentation

   * [Home](Home)
   * [Overview](GitOps-Modernization-Overview)
   * [What GitOps Is](What-GitOps-Is-and-Is-Not)
   * [Q1 OKRs](Q1-Objectives-and-Key-Results)
   * [Projects](GitOps-Modernization-Projects)
   * [Phases](Project-Milestones-and-Phases)
   * [How to Engage](How-to-Engage-with-GitOps)
   * [Measurement](Measurement-and-Visibility)
   * [FAQs](FAQs-and-Common-Concerns)
   ```
   **Note:** Use standard markdown link syntax `[Text](Page)` instead of wiki-style `[[Page]]` for reliable linking.
7. **Commit and push:**
   ```bash
   cd /tmp/gitops-wiki
   git add .
   git commit -m "Sync wiki from Linear initiative: 2026 Q1 - Establish GitOps as the Default Operating Model"
   git push
   ```
8. Confirm: "✓ Synced 9 documents to GitHub Wiki at https://github.com/eci-global/gitops/wiki
   - Created Home.md (Table of Contents)
   - Created 8 topic pages
   - Updated _Sidebar.md for navigation"

---

## Example 2: Sync Initiative Documents to Confluence

User: /sync-linear-jira sync documents from initiative "2026 Q1 - Establish GitOps as the Default Operating Model" to Confluence

You:
1. **Find the initiative:** Use GraphQL to query all initiatives and find by name
   ```json
   {"query":"query { initiatives { nodes { id name } } }"}
   ```
2. **Fetch initiative documents and links:** Query the initiative with documents and links
   ```json
   {"query":"query { initiative(id: \"3617f995-d28f-487e-85e4-c1ccd2d03360\") { id name links { nodes { id label url } } documents { nodes { id title content slugId url } } } }"}
   ```
3. **Extract Confluence configuration from "Confluence Wiki" link:**
   - URL: `https://eci-solutions.atlassian.net/wiki/spaces/CGIP/pages/1744666626/Establish+GitOps`
   - Extract `space_key` = "CGIP" (after `/spaces/`)
   - Extract `parent_id` = "1744666626" (after `/pages/`)
4. **Get JIRA Parent ID from a project in the initiative:**
   - Get first project from initiative: "GitOps Reference Architecture & Operating Model"
   - Query project `externalLinks` via GraphQL
   - Find "Jira Parent ID" link: `https://eci-solutions.atlassian.net/browse/ITPMO01-1619`
   - Extract issue key: "ITPMO01-1619"
5. **For each document, create a Confluence page using MCP:**
   - Clean title (remove brackets like `[1]`)
   - Use `confluence_create_page` MCP tool:
     ```
     confluence_create_page(
       space_key="CGIP",
       title="GitOps Modernization – Overview",
       content="[document content]\n\n---\n*Source: [Linear](https://linear.app/...)*",
       parent_id="1744666626",
       content_format="markdown"
     )
     ```
6. **Skip the Table of Contents document** (`[0] Wiki Table of Contents`) - the parent page serves as the TOC
7. **Create pages in order** based on document title prefix (`[1]`, `[2]`, etc.)
8. **Update parent page** using `confluence_update_page`:
   - Title: "Establish GitOps as the Default Operating Model"
   - Content includes:
     - Initiative description
     - JIRA Parent Issue link: `[ITPMO01-1619](https://eci-solutions.atlassian.net/browse/ITPMO01-1619)`
     - List of all child pages with markdown links
9. Confirm: "✓ Synced 8 documents to Confluence under https://eci-solutions.atlassian.net/wiki/spaces/CGIP/pages/1744666626
   - Created 8 child pages
   - Updated parent page with JIRA tracking link (ITPMO01-1619) and documentation links

   **Pages created:**
   - GitOps Modernization – Overview
   - What GitOps Is (and Is Not)
   - Q1 Objectives & Key Results
   - GitOps Modernization – Projects
   - Project Milestones & Phases
   - How to Engage with GitOps
   - Measurement & Visibility
   - FAQs & Common Concerns"

---

## Example 3: Sync an entire Linear Initiative with all Projects

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

---

## Example 4: Sync a Single Milestone from a Project

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
   - Store the JIRA task key (e.g., "ITPLAT01-150")
   - **Link to Epic** using `jira_link_to_epic(issue_key, epic_key)`
   - **Create GitHub Issue** using GitHub MCP:
     - owner = "eci-global" (from GitHub Repo URL)
     - repo = "gitops" (from GitHub Repo URL)
     - title = **"[ITPLAT01-150] " + extracted task title** (JIRA key prefix for smart commits)
     - body = task description + cross-references to JIRA task and Linear milestone
     - labels = [milestone name]
8. Confirm: "✓ Created JIRA Epic ITPLAT01-142 with 5 tasks (extracted from milestone description) and 5 GitHub issues in eci-global/gitops (linked to parent ITPMO01-1619, release: GitOps Reference Architecture & Operating Model, due: 2026-03-31)"

---

## Example 5: Create Tasks from Milestone Content

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
   - Store JIRA task key (e.g., "ENG-150")
   - **Link to Epic:** Use `jira_link_to_epic` to link it to the Epic
     - Example: `jira_link_to_epic(issue_key="ENG-150", epic_key="ENG-142")`
     - **DO NOT** try to set Epic Link via `parent` field or `additional_fields` during creation
   - **Create GitHub Issue:**
     - Use GitHub MCP `create_issue` tool
     - **title = "[ENG-150] " + task title** (JIRA key prefix for smart commits)
     - Include cross-references to JIRA and Linear milestone in body
     - Add milestone label
6. Confirm: "✓ Extracted 15 tasks from milestone 'Q1 Launch' description, created JIRA tasks linked to Epic ENG-142, and created 15 GitHub issues with JIRA key prefixes"

---

## Example 6: Sync a Single Issue

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
   - **title = "[ECI-789] " + issue title** (JIRA key prefix for smart commits)
   - Include cross-references to JIRA and Linear in body
   - Add milestone label if applicable
9. Confirm: "✓ Created JIRA Issue ECI-789 and GitHub Issue [ECI-789] #42 in project ECI, linked to Epic ECI-142, release: Project Name"

---

## Example 7: Re-sync with Updates (Idempotent Behavior + Cascading Dates)

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
       - Use `search_issues` with query: `repo:eci-global/gitops is:issue "[ITPLAT01-1699]" in:title`
       - **Found existing GitHub Issue #17**
       - **Verify JIRA reference in title:**
         - Check if title starts with `[ITPLAT01-1699]`
         - If missing: `update_issue` to add prefix (enables smart commits)
         - If present: verified
       - **Verify JIRA reference in body:**
         - Check for cross-reference link to ITPLAT01-1699
         - If missing: `update_issue` to restore cross-reference
         - If present: verified
       - Compare issue body content - unchanged
       - **SKIP or RESTORE:** Skip if all verified, restore if JIRA reference was missing
   - Continue for remaining tasks...
6. **Summary of idempotent sync with cascading updates:**
   - ✓ Updated JIRA Version "GitOps Phase 1 Team Enablement (Embedded)" (releaseDate: 2026-02-27 → 2026-03-15)
   - ✓ Updated 3 Epics with cascading date change (duedate: 2026-02-27 → 2026-03-15)
     - ITPLAT01-1694 (used project fallback)
     - ITPLAT01-1697 (used project fallback)
     - ITPLAT01-1698 (used project fallback)
   - ✓ Skipped 2 Epics (ITPLAT01-1695, ITPLAT01-1696) - have milestone-specific dates
   - ✓ Found 12 existing Tasks - no updates needed
   - ✓ Found 12 existing GitHub Issues - verified JIRA references intact
   - ✓ Restored 2 GitHub Issues - JIRA key prefix was missing from title (now smart-commit ready)
   - **No duplicates created**
   - **6 items updated** (1 Version + 3 Epics + 2 GitHub issue title restorations)
   - **24 items skipped** (already up-to-date)

**Key Takeaways from this example:**
- Re-running sync doesn't create duplicates
- **Cascading updates work:** Project targetDate change → Version releaseDate + Epics using fallback dates
- Epics with milestone-specific dates are NOT affected by project date changes
- JIRA tasks and GitHub issues don't have dates, so date changes don't affect them
- **JIRA reference verification:** GitHub issue titles and bodies are checked for JIRA references and restored if missing
- **Smart commit enablement:** JIRA key prefix in GitHub issue titles enables developers and AI agents to use smart commits
- Linear remains the source of truth for content, dates, and structure
