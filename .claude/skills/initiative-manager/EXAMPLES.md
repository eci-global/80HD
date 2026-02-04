# Sync Examples

## Discovery Examples

### Example D1: Basic Initiative Discovery

User: /sync-linear-jira discover GitOps

You:
1. **Pre-flight checks (Phase 0):**
   - Test Linear API: `curl -H "Authorization: $LINEAR_API_KEY" https://api.linear.app/graphql -d '{"query":"{ viewer { id } }"}'`
   - Result: ✓ Linear authenticated
   - Test JIRA MCP: `jira_get_user_profile()`
   - Result: ✓ JIRA accessible
   - Test GitHub: `gh api rate_limit`
   - Result: ✓ GitHub accessible (4,800/5,000 remaining)
   - Confluence: Initiative has "Confluence Wiki" link → test `confluence_search(cql="type=page", limit=1)`
   - Result: ✓ Confluence accessible

2. **Input parsing & normalization (Phase 1):**
   - Input type detected: Initiative name (fuzzy match)
   - Check cache: `/tmp/linear-cache-3617f995-2026-02-02.json` not found
   - Proceed with fresh fetch

3. **Linear discovery (Phase 2):**
   - Load Linear MCP tools via ToolSearch
   - Query initiatives: `{ initiatives { nodes { id name description } } }`
   - Fuzzy match "GitOps" → Found "2026 Q1 - Establish GitOps as the Default Operating Model"
   - Fetch full initiative with documents, projects, links:
     ```graphql
     { initiative(id: "3617f995-d28f-487e-85e4-c1ccd2d03360") {
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
   - Found: 4 projects, 14 milestones, 9 documents
   - Extracted config: JIRA Parent ITPMO01-1619, JIRA Project ITPLAT01, GitHub repo eci-global/gitops
   - Cache results to `/tmp/linear-cache-3617f995-2026-02-02.json`

4. **JIRA discovery (Phase 3):**
   - Load JIRA MCP tools via ToolSearch
   - Get versions: `jira_get_project_versions(project_key="ITPLAT01")`
   - Found 4 versions matching Linear projects
   - Search epics: `jira_search(jql="project = ITPLAT01 AND issuetype = Epic AND parent = ITPMO01-1619")`
   - Found 14 epics (all matched to Linear milestones)
   - Search tasks: `jira_search(jql="project = ITPLAT01 AND issuetype = Task", max_results=50)`
   - Found 45 tasks: 10 Done, 12 In Progress, 23 To Do
   - Run sync status algorithm: 42/45 synced, 2 connected, 1 not synced

5. **GitHub discovery (Phase 4):**
   - List issues: `gh issue list --repo eci-global/gitops --limit 100 --json number,title,state`
   - Found 45 issues: 18 open, 27 closed
   - Filter for JIRA prefix: 43/45 have `[ITPLAT01-*]` prefix
   - List PRs: `gh pr list --repo eci-global/gitops --limit 50 --json number,title,state`
   - Found 45 PRs: 3 open, 42 merged
   - Check wiki: `gh repo view eci-global/gitops --json hasWikiEnabled`
   - Result: Wiki enabled, 9 pages
   - Run sync status: 40/45 synced, 3 connected, 2 not synced
   - Detect dangling issues: 2 issues with JIRA prefix but JIRA task deleted

6. **Confluence discovery (Phase 5):**
   - Extract Confluence config from "Confluence Wiki" link
   - Space: CGIP, Parent ID: 1744666626
   - Get parent page: `confluence_get_page(page_id="1744666626")`
   - Get children: `confluence_get_page_children(page_id="1744666626")`
   - Found 8 child pages
   - Compare with Linear documents: 8/9 synced (1 broken link)

7. **Output generation (Phase 6):**
   ```markdown
   # Initiative Discovery: 2026 Q1 - Establish GitOps as the Default Operating Model

   ## Overview
   **Status:** Active | **Target:** 2026-03-31 | **Last Updated:** 2026-02-02
   **Health:** 🟢 Green (92% sync health)

   Establish GitOps as the default operating model for ECI infrastructure management.

   ## Linear (Source of Truth)
   **Initiative ID:** 3617f995-d28f-487e-85e4-c1ccd2d03360
   **URL:** https://linear.app/eci-platform-team/initiative/3617f995

   ### Projects (4)
   | Project | Start | Target | Milestones | Issues |
   |---------|-------|--------|------------|--------|
   | GitOps Reference Architecture & Operating Model | 2026-01-15 | 2026-03-31 | 5 | 16 |
   | GitOps Phase 1 Team Enablement (Embedded) | 2026-01-01 | 2026-02-27 | 3 | 12 |
   | Policy, Security & Guardrails | 2026-02-01 | 2026-03-15 | 2 | 8 |
   | Manual Change Path Reduction | 2026-02-15 | 2026-03-31 | 4 | 15 |

   ### Documents (9)
   - [Table of Contents](https://linear.app/...) - Initiative overview
   - [GitOps Modernization – Overview](https://linear.app/...) - What and why
   - [What GitOps Is (and Is Not)](https://linear.app/...) - Definitions
   - (6 more...)

   ## JIRA (PMO View)
   **Project:** ITPLAT01 | **Parent:** [ITPMO01-1619](https://eci-solutions.atlassian.net/browse/ITPMO01-1619)

   ### Versions (4)
   | Version | Release Date | Epics | Tasks | Status |
   |---------|--------------|-------|-------|--------|
   | GitOps Reference Architecture & Operating Model | 2026-03-31 | 5 | 16 | 10 done, 6 in progress |
   | GitOps Phase 1 Team Enablement (Embedded) | 2026-02-27 | 3 | 12 | 5 done, 7 in progress |
   | Policy, Security & Guardrails | 2026-03-15 | 2 | 8 | 3 done, 5 in progress |
   | Manual Change Path Reduction | 2026-03-31 | 4 | 15 | 7 done, 8 in progress |

   ### Issue Summary
   - **Total:** 45 issues
   - **Open:** 23 (51%)
   - **In Progress:** 12 (27%)
   - **Done:** 10 (22%)

   ## GitHub (Developer View)
   **Repository:** [eci-global/gitops](https://github.com/eci-global/gitops)

   - **Issues:** 18 open, 27 closed
   - **PRs:** 3 open, 42 merged
   - **Branches:** 8 active feature branches
   - **Wiki:** Enabled (9 pages, last updated 2026-02-01)

   ## Confluence (Documentation)
   **Space:** CGIP | **Parent:** [Establish GitOps](https://eci-solutions.atlassian.net/wiki/spaces/CGIP/pages/1744666626)
   - **Pages:** 8 documentation pages
   - **Last Updated:** 2026-02-01

   ## Cross-System Sync Status

   | System | Synced | Connected | Not Synced | Health |
   |--------|--------|-----------|------------|--------|
   | Linear → JIRA | 42/45 (93%) | 2 | 1 | 🟢 |
   | Linear → GitHub | 40/45 (89%) | 3 | 2 | 🟢 |
   | Linear → Confluence | 8/9 (89%) | 0 | 1 | 🟢 |

   **Overall Health:** 🟢 Green (92%)

   ## Cleanup Needed
   ⚠️ 2 dangling GitHub issues: #45 (#46) - JIRA tasks deleted
   ❌ 1 broken Confluence link in document "FAQs"

   ## Suggested Actions

   **To sync missing items:**
   ```bash
   /sync-linear-jira sync milestone "Define the Operating Model"
   ```

   **To restore JIRA prefixes:**
   ```bash
   # Manually update GitHub issue #45, #46 titles
   ```

   **To clean up:**
   - Close GitHub issues #45, #46 or remove JIRA prefixes
   - Fix or remove broken Confluence link in "FAQs" document

   ## Quick Links
   - **Linear:** [Initiative](https://linear.app/...) | [Projects](https://linear.app/...)
   - **JIRA:** [Parent Epic](https://eci-solutions.atlassian.net/browse/ITPMO01-1619) | [All Issues](https://eci-solutions.atlassian.net/issues/?jql=project%20%3D%20ITPLAT01)
   - **GitHub:** [Repo](https://github.com/eci-global/gitops) | [Issues](https://github.com/eci-global/gitops/issues) | [Wiki](https://github.com/eci-global/gitops/wiki)
   - **Confluence:** [Documentation](https://eci-solutions.atlassian.net/wiki/spaces/CGIP/pages/1744666626)
   ```

---

### Example D2: Discovery → Sync → Verify Workflow

User: /sync-linear-jira discover GitOps

You: [Performs discovery as in Example D1, saves verify baseline]
- Before completing discovery, save verify baseline: `/tmp/linear-verify-3617f995.json`
- Output shows: 1 Linear issue not synced to JIRA, 2 not synced to GitHub

User: /sync-linear-jira sync milestone "Define the Operating Model"

You:
1. Find milestone in Linear
2. Create missing JIRA task (ITPLAT01-1699)
3. Create 2 missing GitHub issues (#47, #48)
4. Complete sync

User: /sync-linear-jira discover GitOps --verify

You:
1. **Load verify baseline:**
   - Read `/tmp/linear-verify-3617f995.json`
   - Contains pre-sync state from earlier discovery

2. **Run fresh discovery:**
   - Execute Phases 0-5 as normal
   - Get current state

3. **Compare and show diff:**
   ```markdown
   # Initiative Discovery: 2026 Q1 - Establish GitOps as the Default Operating Model

   ## Verification Results

   **Baseline:** 2026-02-02 10:30 UTC (pre-sync)
   **Current:** 2026-02-02 11:15 UTC (post-sync)

   ### Changes Detected

   ✅ **JIRA Sync Improvements:**
   - 1 new JIRA task synced: ITPLAT01-1699
   - Linear → JIRA sync health: 93% → 95% (+2%)

   ✅ **GitHub Sync Improvements:**
   - 2 new GitHub issues created: #47, #48
   - All issues have JIRA key prefixes
   - Linear → GitHub sync health: 89% → 93% (+4%)

   ✅ **Overall Health Improved:**
   - Sync health: 92% → 94% (+2%)
   - Overall status: 🟢 Green (maintained)

   ### Remaining Gaps

   ⚠️ **Still not synced:**
   - 0 Linear issues missing JIRA tasks
   - 0 Linear issues missing GitHub issues

   ✅ **Verification complete - all sync operations successful!**

   ---

   [Full current state follows...]
   ```

4. **Auto-delete verify baseline:**
   - Remove `/tmp/linear-verify-3617f995.json` after showing diff

---

### Example D3: Comparison Mode for Status Updates

User: /sync-linear-jira discover GitOps --since=2026-01-25

You:
1. **Load comparison baseline:**
   - Read `/tmp/linear-baseline-3617f995-2026-01-25.json`
   - If not found: Error "No baseline found for 2026-01-25. Run discovery first to create baseline."
   - Contains state from 2026-01-25

2. **Run fresh discovery:**
   - Execute Phases 0-5 as normal
   - Get current state (2026-02-02)

3. **Compare and highlight changes:**
   ```markdown
   # Initiative Discovery: 2026 Q1 - Establish GitOps as the Default Operating Model

   ## Changes Since 2026-01-25

   **Baseline:** 2026-01-25 (8 days ago)
   **Current:** 2026-02-02

   ### Progress Summary

   **New milestones added:** 2
   - "Platform-Led First Change" (added 2026-01-28)
   - "Measure & Celebrate Success" (added 2026-01-30)

   **Milestones completed:** 1
   - "Define the Operating Model (Behavior First)" (completed 2026-01-26)

   **JIRA tasks:**
   - Created: 8 new tasks
   - Completed: 5 tasks (10 → 15 total done)
   - In Progress: 12 → 14

   **GitHub activity:**
   - Issues closed: 7
   - PRs merged: 12
   - New contributors: 2

   **Documentation updates:**
   - 1 new Confluence page: "Measurement & Visibility"
   - GitHub wiki: 2 pages updated

   ### Health Trend

   | Metric | 2026-01-25 | 2026-02-02 | Change |
   |--------|------------|------------|--------|
   | Sync Health | 87% | 92% | +5% ✅ |
   | Completeness | 85% | 92% | +7% ✅ |
   | Staleness | 5 days | 0 days | -5 days ✅ |

   **Overall:** 🟢 Green (improved from 🟡 Yellow)

   ---

   [Full current state follows...]
   ```

4. **Save new baseline for future comparisons:**
   - Write `/tmp/linear-baseline-3617f995-2026-02-02.json`

---

## Sync Examples

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

---

## Example 8: Reverse Sync (GitHub → Linear → JIRA)

User: /sync-linear-jira reverse-sync repo eci-global/gitops

**Context:** Developers have been working in GitHub. Several issues have been closed, some reopened, and comments added. We need to sync those changes back to Linear and JIRA.

You:
1. **List all GitHub issues in the repo:**
   ```bash
   gh issue list --repo eci-global/gitops --limit 100 --json number,title,state,stateReason
   ```
   - Filter for issues with JIRA key prefix in title: `[ITPLAT01-*]`

2. **For each GitHub issue that changed:**
   - **Example Issue #17:** `[ITPLAT01-1699] Identify 3 pilot teams aligned to Q1 initiatives`
   - GitHub state: `closed` (was previously `open`)

3. **Find the JIRA task:**
   - Extract JIRA key from title: `ITPLAT01-1699`
   - Use `jira_get_issue(issue_key="ITPLAT01-1699")`
   - Current JIRA status: "To Do"
   - JIRA description contains: `**Linear:** [PLAT-567](https://linear.app/...)`

4. **Find the Linear issue:**
   - Extract Linear URL from JIRA description
   - Use Linear MCP or GraphQL to get issue by identifier "PLAT-567"
   - Current Linear state: "Todo"

5. **Sync status changes:**
   - GitHub closed → Linear state change
   - GitHub closed → JIRA status transition

   ```javascript
   // Update Linear state
   linear_update_issue(
     issue_id: "PLAT-567-id",
     state_id: "<done-state-id>"
   )

   // Add comment to Linear
   linear_create_comment(
     issue_id: "PLAT-567-id",
     body: "✓ Closed via GitHub issue #17 (synced at 2026-01-25 13:45 UTC)"
   )

   // Transition JIRA status
   jira_transition_issue(
     issue_key: "ITPLAT01-1699",
     transition: "Done"
   )

   // Add comment to JIRA
   jira_add_comment(
     issue_key: "ITPLAT01-1699",
     comment: "Closed via GitHub issue #17 (synced at 2026-01-25 13:45 UTC)"
   )
   ```

6. **Continue for all changed issues:**
   - Issue #18 (ITPLAT01-1700): closed → sync to Linear/JIRA
   - Issue #19 (ITPLAT01-1701): reopened → Linear "In Progress", JIRA "In Progress"
   - Issue #20 (ITPLAT01-1702): still open → no change needed

7. **Summary report:**
   ```
   ✓ Reverse sync complete for eci-global/gitops

   **Issues processed:** 45 total
   **In sync:** 42 issues (no changes needed)
   **Updated:** 3 issues

   **Changes synced:**
   - PLAT-567 (ITPLAT01-1699, #17): GitHub closed → Linear Done, JIRA Done
   - PLAT-568 (ITPLAT01-1700, #18): GitHub closed → Linear Done, JIRA Done
   - PLAT-569 (ITPLAT01-1701, #19): GitHub reopened → Linear In Progress, JIRA In Progress

   **No action needed:** 42 issues already in sync
   ```

**State Mapping Applied:**

| GitHub Issue | Before | After | Linear State | JIRA Status |
|--------------|--------|-------|--------------|-------------|
| #17 | open | closed | Todo → Done | To Do → Done |
| #18 | open | closed | In Progress → Done | In Progress → Done |
| #19 | closed | open (reopened) | Done → In Progress | Done → In Progress |

**Benefits:**
- Linear shows accurate status from developer work in GitHub
- JIRA reports reflect actual progress from GitHub
- PMO sees real-time progress without manual updates
- Milestone completion tracking in Linear is accurate

---

## Example 9: Full Workflow (Forward + Reverse Sync)

User: /sync-linear-jira full-sync project "GitOps Phase 1 Team Enablement"

**This combines forward sync (creation) + reverse sync (status updates) in one command.**

You:

### Phase 1: Forward Sync (Linear → JIRA → GitHub)

1. **Create Linear issues from milestone descriptions:**
   - Parse milestone "Select & Contract with Pilot Teams" description
   - Extract 4 tasks from "Build / Do" section
   - Create 4 Linear issues associated with milestone
   - State: "Todo"

2. **Create JIRA tasks:**
   - For each Linear issue:
     - Create JIRA Task in ITPLAT01
     - Add Linear URL to description
     - Link to Epic ITPLAT01-1694
     - Set fixVersions to project version
   - JIRA tasks created: ITPLAT01-1699, ITPLAT01-1700, ITPLAT01-1701, ITPLAT01-1702

3. **Create GitHub issues:**
   - For each JIRA task:
     - Title: `[ITPLAT01-1699] Identify 3 pilot teams aligned to Q1 initiatives`
     - Body: Task description + Linear/JIRA cross-references
     - Labels: ["Select & Contract with Pilot Teams"]
   - GitHub issues created: #17, #18, #19, #20

4. **Update Linear issues with cross-references:**
   - Update each Linear issue description with JIRA/GitHub links
   - Now bidirectional linkage is complete

### Phase 2: Reverse Sync (GitHub → Linear → JIRA)

5. **Check for existing GitHub activity:**
   - List all issues in repo with JIRA prefix
   - Find issues created in previous syncs that have changed
   - Example: Issue #15 (ITPLAT01-1695) was closed by a developer

6. **Sync status back:**
   - Find Linear issue PLAT-570 (linked from JIRA-1695)
   - Update Linear: "Todo" → "Done"
   - Update JIRA: "To Do" → "Done"
   - Add sync comments to both

7. **Final summary:**
   ```
   ✓ Full sync complete for project "GitOps Phase 1 Team Enablement"

   **Forward Sync (Linear → JIRA → GitHub):**
   - Created 4 Linear issues from milestone descriptions
   - Created 4 JIRA tasks (linked to Epic ITPLAT01-1694)
   - Created 4 GitHub issues (#17-#20) with JIRA key prefixes
   - Established bidirectional linkage for all issues

   **Reverse Sync (GitHub → Linear → JIRA):**
   - Processed 12 existing GitHub issues
   - Found 1 status change: #15 closed by developer
   - Updated Linear PLAT-570: Todo → Done
   - Updated JIRA ITPLAT01-1695: To Do → Done

   **Project Status:**
   - Total issues: 16
   - In Progress: 8
   - Done: 5 (4 from previous work + 1 from today)
   - Todo: 3 (newly created)
   ```

**This workflow ensures:**
- ✅ All planning in Linear creates actionable work in GitHub
- ✅ All developer work in GitHub updates planning in Linear
- ✅ JIRA stays in sync for PMO reporting
- ✅ Complete visibility across all platforms

---

## Feedback Examples

### Example F1: Morning Check-in with Comments

User: /sync-linear-jira discover GitOps --comments

You:

1. **Perform standard discovery (Phases 0-5):**
   - Initiative: "2026 Q1 - Establish GitOps as the Default Operating Model"
   - Projects: 4, Milestones: 14, Documents: 9
   - Sync health: 92% (Green)

2. **Collect platform references:**
   - GitHub Repo: eci-global/gitops
   - JIRA Tasks: ITPLAT01-1699, ITPLAT01-1700, etc. (45 total)
   - JIRA Epic: ITPMO01-1619
   - Confluence Pages: 8 pages under parent 1744666626

3. **Fetch comments from each platform:**

   **GitHub PR comments:**
   ```bash
   # Get recent PRs
   gh pr list --repo eci-global/gitops --limit 10 --json number,title,updatedAt

   # For each recent PR, get comments
   gh api repos/eci-global/gitops/pulls/67/comments --jq '.[] | {author: .user.login, body: .body, created_at: .created_at}'
   gh api repos/eci-global/gitops/pulls/67/reviews --jq '.[] | {author: .user.login, body: .body, state: .state, created_at: .submitted_at}'
   ```
   - Found: 3 comments on PR #67

   **GitHub Issue comments:**
   ```bash
   gh api repos/eci-global/gitops/issues/55/comments --jq '.[] | {author: .user.login, body: .body, created_at: .created_at}'
   ```
   - Found: 2 comments on Issue #55

   **GitHub Discussions:**
   ```bash
   gh api graphql -f query='
     query {
       repository(owner: "eci-global", name: "gitops") {
         discussions(first: 5, orderBy: {field: UPDATED_AT, direction: DESC}) {
           nodes {
             title number
             comments(first: 10) {
               nodes { author { login } body createdAt }
             }
           }
         }
       }
     }
   '
   ```
   - Found: 1 discussion with 4 comments

   **JIRA comments:**
   ```
   mcp__atlassian__jira_get_issue(issue_key="ITPLAT01-1749")
   # Parse: fields.comment.comments[]
   ```
   - Found: 2 comments on ITPLAT01-1749

   **Confluence comments:**
   ```
   mcp__atlassian__confluence_get_comments(page_id="1744666626")
   mcp__atlassian__confluence_get_comments(page_id="1744666627")
   # (top 5 most recent pages only)
   ```
   - Found: 3 comments across 2 pages

4. **Filter by time (last 7 days) and classify:**
   - Total comments: 15
   - Questions (ends with `?`): 3
   - Pending responses (questions without my reply): 2

5. **Generate output:**

```markdown
# Initiative Discovery: 2026 Q1 - Establish GitOps as the Default Operating Model

## Overview
**Status:** Active | **Target:** 2026-03-31 | **Last Updated:** 2026-02-03
**Health:** 🟢 Green (92% sync health)

## Feedback Summary
**Last 7 Days:** 15 comments across 4 platforms
**Pending Responses:** 2 questions awaiting reply

---

## Pending Responses (2)
Questions without your reply - respond promptly!

| Platform | Item | Author | Comment | Age |
|----------|------|--------|---------|-----|
| JIRA | ITPLAT01-1749 | PMO Lead | "When is the deadline for v0.1?" | 1d |
| GitHub | Issue #55 | John D. | "Question about scope of Phase 1?" | 5h |

---

## Recent Comments (15)

### GitHub (8 comments)

**PR #67** - GitOps Outcomes Checklist
- Jane S. - "Approved with suggestions" (2h ago)
- Alex M. - "LGTM, minor typo on line 45" (3h ago)
- CI Bot - "All checks passed" (3h ago)

**Issue #55** - Track Phase 1 progress
- John D. - "Question about scope of Phase 1?" (5h ago) ⚠️
- Ted Edgar - "Good point, let me clarify..." (4h ago)

**Discussion: RFC GitOps Outcomes** (3 comments)
- Alex M. - "What about ADO teams?" (1d ago)
- Sarah K. - "I like the approach, +1" (2d ago)
- Ted Edgar - "ADO teams will use same outcomes..." (1d ago)

### JIRA (2 comments)

**ITPLAT01-1749** - GitOps Outcomes Checklist
- PMO Lead - "When is the deadline for v0.1?" (1d ago) ⚠️
- Stakeholder A - "Looking forward to reviewing" (2d ago)

### Confluence (5 comments)

**Outcomes Checklist Draft**
- Stakeholder A - "Suggest adding cost efficiency section" (3h ago)
- John D. - "Agreed with ^, good addition" (2h ago)
- Ted Edgar - "Added in latest revision" (1h ago)

**CCOE Parent Page**
- PMO Lead - "Visibility looks good" (2d ago)
- Ted Edgar - "Thanks, will update weekly" (2d ago)

---

## Quick Links
- **GitHub Notifications:** https://github.com/notifications?query=repo%3Aeci-global%2Fgitops
- **JIRA Filter:** https://eci-solutions.atlassian.net/issues/?jql=project%20%3D%20ITPLAT01%20ORDER%20BY%20updated%20DESC
- **Confluence Space:** https://eci-solutions.atlassian.net/wiki/spaces/CGIP

---

## Linear (Source of Truth)
[... standard discovery output continues ...]
```

---

### Example F2: Weekly Review with Date Filter

User: /sync-linear-jira discover GitOps --comments --since=2026-01-27

You:

1. **Perform standard discovery with comparison baseline**
2. **Fetch comments since 2026-01-27:**
   - Filter all API responses by `created_at >= 2026-01-27`
   - Found: 23 comments in 7-day window

3. **Generate output with date context:**

```markdown
# Initiative Discovery: GitOps

## Feedback Since 2026-01-27 (7 days)

**Total Comments:** 23
- GitHub: 12 comments (5 PRs, 3 issues, 4 discussions)
- JIRA: 6 comments (3 tasks)
- Confluence: 5 comments (2 pages)

**Pending Responses:** 2 questions
**Response Rate:** 91% (21/23 comments addressed)

[... detailed breakdown ...]
```

---

### Example F3: Pending Only Mode

User: /sync-linear-jira discover GitOps --comments --pending

You:

1. **Fetch all comments (last 7 days)**
2. **Filter to pending responses only:**
   - Question detection: ends with `?`
   - Pending: no reply from configured username

3. **Generate focused output:**

```markdown
# GitOps - Pending Responses

**Action Required:** 2 questions awaiting your reply

| Platform | Item | Author | Question | Age | Link |
|----------|------|--------|----------|-----|------|
| JIRA | ITPLAT01-1749 | PMO Lead | "When is the deadline for v0.1?" | 1d | [View](https://...) |
| GitHub | Issue #55 | John D. | "Question about scope of Phase 1?" | 5h | [View](https://...) |

**Suggested Actions:**
1. Reply to ITPLAT01-1749 in JIRA (oldest)
2. Reply to Issue #55 in GitHub

**Note:** Configure your usernames in `~/.claude/sync-linear-jira-config.json` for accurate pending detection.
```

---

### Example F4: No Comments Found

User: /sync-linear-jira discover NewProject --comments

You:

1. **Perform discovery for NewProject**
2. **Fetch comments - none found in last 7 days**

3. **Generate output:**

```markdown
# Initiative Discovery: NewProject

## Overview
**Status:** Active | **Target:** 2026-04-30
**Health:** 🟢 Green (100% sync health)

## Feedback Summary
**Last 7 Days:** No comments found

ℹ️ This initiative has no recent feedback across GitHub, JIRA, or Confluence.
Consider sharing for review to gather stakeholder input.

**Suggestions:**
- Post announcement in MS Teams
- Create GitHub Discussion for feedback
- Update Linear initiative status

---

[... standard discovery output ...]
```
