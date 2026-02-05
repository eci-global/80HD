---
name: initiative-manager
description: Manage Linear initiatives end-to-end - create structure in Linear, then sync to JIRA, GitHub, and Confluence. Use when creating initiatives, projects, milestones, or syncing between platforms.
---

You have access to Linear, Atlassian (JIRA & Confluence), and GitHub MCP servers. The user will provide natural language instructions for creating or syncing initiatives.

## Contents

- [Platform Roles](#platform-roles) - Why each system exists
- [Subcommands](#subcommands) - **create** (build in Linear), **discover** (read), and **sync** (write to downstream)
- [Initiative Content Template](#initiative-content-template-power-framework) - **Power framework structure for all initiatives**
- [Overview](#overview) - Hierarchy and sync mapping
- [Initiative Content Fields](#initiative-content-fields) - **`description` (255 chars) vs `content` (unlimited)**
- [JIRA Configuration](#jira-configuration) - Required project links
- [GitHub Wiki Sync](#github-wiki-sync) - Initiative documents to GitHub wiki
- [Confluence Sync](#confluence-sync) - Initiative documents to Confluence pages
- [Live JIRA Tables](#live-jira-issue-tables-in-confluence) - **Auto-updating JIRA issue tables in Confluence**
- [Fetching Data](GRAPHQL.md) - GraphQL queries for Linear API
- [Sync Behavior](JIRA-MAPPING.md) - Field mappings and hierarchy
- [Idempotent Sync](IDEMPOTENCY.md) - Duplicate prevention and updates
- [Reverse Sync](REVERSE-SYNC.md) - **GitHub → Linear → JIRA status updates**
- [Sync Workflow](SYNC-WORKFLOW.md) - **Best practices, efficient patterns, MCP optimization**
- [Discovery Workflow](DISCOVERY.md) - **Initiative discovery, sync status, health scoring**
- [Feedback Aggregation](FEEDBACK.md) - **Cross-platform comment visibility with --comments flag**
- [Sharing Guide](SHARING.md) - Manual sharing steps for MS Teams, GitHub Discussions
- [Examples](EXAMPLES.md) - Detailed sync and discovery scenarios

## Subcommands

This skill provides three complementary operations:

| Subcommand | Purpose | Use When |
|------------|---------|----------|
| **create** | Build initiative structure in Linear (GraphQL) | You need to create initiatives, projects, milestones, or resource links in Linear |
| **discover** | Read and analyze initiative state across all platforms | You need to see current state, sync health, gaps, or status updates |
| **sync** | Write/update data from Linear to JIRA, GitHub, Confluence | You need to create or update issues, epics, documents, or versions |

**Example workflows:**
```bash
# 1. Create initiative structure in Linear
/initiative-manager create initiative "2026 Q1 - Archera Multi-Cloud Onboarding" --team "ECI Platform Team"

# 2. Discover current state
/initiative-manager discover GitOps

# 3. Sync to JIRA/GitHub/Confluence
/initiative-manager sync initiative "GitOps"

# 4. Verify sync completed
/initiative-manager discover GitOps --verify
```

### Create Subcommand

**Purpose:** Build initiative structure directly in Linear using GraphQL mutations. The Linear MCP server does NOT support creating initiatives, milestones, or resource links - only this subcommand can do that.

**Input formats:**
```bash
/initiative-manager create initiative "2026 Q1 - Initiative Name" --team "Team Name"
/initiative-manager create project "Project Name" --initiative "Parent Initiative"
/initiative-manager create milestone "Milestone Name" --project "Parent Project" --target "2026-02-14"
/initiative-manager create link --project "Project Name" --label "GitHub Repo" --url "https://github.com/org/repo"
```

**Common options:**
```bash
--team "Team Name"         # Team to assign (required for initiative)
--initiative "Name"        # Parent initiative (required for project)
--project "Name"           # Parent project (required for milestone)
--description "..."        # Short description (255 char limit for initiative)
--content "..."            # Full markdown content (unlimited, for initiative)
--target "YYYY-MM-DD"      # Target date (for project/milestone)
--start "YYYY-MM-DD"       # Start date (for project)
```

**What gets created:**
- **Initiative** → Name, description (255 chars), content (unlimited markdown), team assignment
- **Project** → Name, description, startDate, targetDate, parent initiative link
- **Milestone** → Name, description, targetDate, sortOrder, parent project
- **Resource Link** → Label, URL, attached to project or initiative

**GraphQL mutations used:**
```graphql
# Create initiative
mutation { initiativeCreate(input: { name: "...", description: "...", content: "...", teamId: "..." }) { success initiative { id name } } }

# Create project under initiative
mutation { projectCreate(input: { name: "...", initiativeIds: ["..."], teamIds: ["..."], startDate: "...", targetDate: "..." }) { success project { id name } } }

# Create milestone under project
mutation { projectMilestoneCreate(input: { projectId: "...", name: "...", targetDate: "..." }) { success projectMilestone { id name } } }

# Add resource link to project
mutation { projectLinkCreate(input: { projectId: "...", label: "...", url: "..." }) { success projectLink { id } } }

# Add resource link to initiative
mutation { initiativeLinkCreate(input: { initiativeId: "...", label: "...", url: "..." }) { success } }
```

**Required setup before sync:**
After using `create`, you must add these resource links before `sync` will work:
- **Jira Parent ID** → JIRA epic/issue to use as parent
- **Jira Project ID** → JIRA project board URL
- **GitHub Repo** → GitHub repository URL
- **Confluence Wiki** → (on initiative) Parent Confluence page URL

See [GRAPHQL.md](GRAPHQL.md) for full mutation reference.

## Initiative Content Template (Power Framework)

**All initiatives MUST follow this standardized structure.** The Power framework ensures initiatives focus on problems being solved with measurable outcomes.

### Status Updates (Use Initiative Updates, NOT Content)

**IMPORTANT:** Status updates go in Linear's native **Initiative Updates** feature, not in the content field.

```graphql
mutation {
  initiativeUpdateCreate(input: {
    initiativeId: "...",
    body: "## Status Title\n\nUpdate content...",
    health: onTrack  # or: atRisk, offTrack
  }) {
    success
    initiativeUpdate { id url }
  }
}
```

**Health values:** `onTrack`, `atRisk`, `offTrack`

**Update template:**
```markdown
## [Status Title]

[Brief status summary - what happened, what's next]

| Platform | Link | Purpose |
| -- | -- | -- |
| **Linear** | [Initiative](url) | Source of truth |
| **GitHub** | [repo](url) | Code/automation |
| **JIRA** | [ITPLAT01-XXX](url) | PMO tracking |

**Next Steps:**
- [Action item 1]
- [Action item 2]
```

### Required Content Sections

The initiative **content** field should contain the static Power framework sections (not status updates):

```markdown
## Problem

**[One-sentence problem statement in bold.]**

[2-3 paragraphs explaining the problem, current state, and gaps]

| [Dimension] | Current State | Gap |
| -- | -- | -- |
| **[Area 1]** | [status] | [what's missing] |
| **[Area 2]** | [status] | [what's missing] |

**Root Cause:** [Why does this problem exist?]

---

## Outcomes

**[One-sentence outcome statement in bold.]**

1. **[Outcome 1]** - [Description]
2. **[Outcome 2]** - [Description]
3. **[Outcome 3]** - [Description]

---

## Why Now

* **[Reason 1]** - [Urgency/timing explanation]
* **[Reason 2]** - [Business driver]
* **[Reason 3]** - [Opportunity window]

---

## Execution

**[Approach/Strategy Name]:**

| [Dimension] | Approach | Owner |
| -- | -- | -- |
| **[Track 1]** | [description] | [team] |
| **[Track 2]** | [description] | [team] |

**Existing Assets:**
- ✅ [Asset 1 already in place]
- ✅ [Asset 2 already in place]

---

## Key Results

**[Theme 1] (Target: [Date]):**

* **KR1.1**: [Measurable result] by **[Date]**
* **KR1.2**: [Measurable result with number] by **[Date]**
* **KR1.3**: [Measurable result with %] by **[Date]**

**[Theme 2] (Target: [Date]):**

* **KR2.1**: [Measurable result] by **[Date]**
* **KR2.2**: [Measurable result] by **[Date]**

---

## Direct Alignment to Strategy

* **[Strategic Priority 1]** - [Source document]
* **[Strategic Priority 2]** - [Source document]
```

### Key Results Best Practices

1. **Use KR IDs** - Format: `KR[theme].[number]` (e.g., KR1.1, KR2.3)
2. **Include metrics** - Numbers, percentages, counts (e.g., "≥90% coverage", "100% visible")
3. **Include deadlines** - Every KR has a target date in bold
4. **Group by theme** - Organize KRs under project/workstream headings
5. **Be specific** - "Validate 230 subscriptions" not "Validate subscriptions"

### Example: Archera Initiative

See the [2026 Q1 - Archera Multi-Cloud Onboarding](https://linear.app/eci-platform-team/initiative/2026-q1-archera-multi-cloud-onboarding-46b802a6d4eb) initiative for a complete example of this format.

### Discover Subcommand

**Purpose:** Comprehensive initiative discovery across Linear, JIRA, GitHub, and Confluence.

**Input formats:**
```bash
/initiative-manager discover GitOps                           # By initiative name
/initiative-manager discover "2026 Q1 - Establish GitOps"    # By full name
/initiative-manager discover ITPLAT01-1619                    # By JIRA key (traces to Linear)
```

**Common flags:**
```bash
--verify              # Compare with pre-sync baseline, show diff
--since=2026-01-25    # Compare with state from specified date
--format=json         # Output format: markdown (default), json, minimal
--no-cache           # Force fresh fetch, ignore cache
--limit=N            # Limit results (default: 10 projects, 20 milestones per project)
--linear-only        # Skip JIRA/GitHub/Confluence (fastest)
--skip-confluence    # Skip Confluence (faster)
--skip-github        # Skip GitHub (PMO view only)
--comments           # Include feedback/comments from all platforms (last 7 days)
--pending            # With --comments: show only pending responses (questions without my reply)
```

**Output:** Markdown summary with:
- Initiative overview and health score
- **Feedback summary** (with --comments flag)
- Linear projects, milestones, documents
- JIRA versions, epics, tasks
- GitHub issues, PRs, wiki status
- Confluence documentation
- Cross-system sync status
- Cleanup suggestions (orphaned items, broken links)
- Quick action commands

See [DISCOVERY.md](DISCOVERY.md) for detailed workflow and algorithms.
See [FEEDBACK.md](FEEDBACK.md) for comment aggregation workflow.

### Sync Subcommand

**Purpose:** Create or update items from Linear to JIRA, GitHub, and Confluence.

**Input formats:**
```bash
/initiative-manager sync initiative "GitOps"                  # Sync entire initiative
/initiative-manager sync project "GitOps Reference Arch"     # Sync single project
/initiative-manager sync milestone "Define the Operating Model" # Sync milestone
/initiative-manager sync documents from initiative "GitOps"  # Sync to wiki/Confluence
```

See [Examples](EXAMPLES.md) for detailed sync scenarios.

## Platform Roles

**This three-platform model serves different audiences:**

| Platform | Role | Primary Audience | What Lives Here |
|----------|------|------------------|-----------------|
| **Linear** | **Source of Truth** | Platform Enablement Team | Projects, Milestones, task definitions, target dates, structure |
| **GitHub** | **Developer Workspace** | Developers & Engineers | Issues to work on, PRs, code, automation, wiki documentation |
| **JIRA** | **PMO/Leadership View** | PMO, Leadership, Stakeholders | Versions, Epics, Tasks for release tracking and reporting |
| **Confluence** | **Enterprise Documentation** | All Stakeholders | Initiative documentation, wikis, knowledge base for broader org |

**Key Principles:**
- **Linear is authoritative for planning** - All content, dates, and structure originate in Linear
- **GitHub is where work happens** - Developers see GitHub issues, not Linear or JIRA
- **JIRA is for visibility** - PMO and leadership track progress via JIRA versions, epics, and release reports
- **Forward sync (Linear → JIRA/GitHub)** - Creates issues and updates structure/dates
- **Reverse sync (GitHub → Linear → JIRA)** - Syncs status changes from developer workspace back to planning tools
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
  ├─ Linear Initiative Documents → GitHub Wiki Pages
  ├─ Linear Initiative Documents → Confluence Pages (under parent page)
  └─ Linear Project → JIRA Epic + JIRA Version (for release tracking)
      └─ Linear Milestone → JIRA Task (linked to Epic, associated with version)
```

## Sync Mapping

**Linear → JIRA:**
- **Linear Initiative** → Metadata only (included in epic descriptions for context)
- **Linear Project** → **JIRA Epic** + **JIRA Version/Release**
  - Epic = work container, linked to PMO parent issue (from "Jira Parent ID")
  - Version = release tracking (for burndowns, release reports)
  - Version name = Project name
  - Version startDate = Project startDate
  - Version releaseDate = Project targetDate
- **Linear Milestones** → **JIRA Tasks** (linked to Epic via `jira_link_to_epic`, associated with version via `fixVersions`)

**Key Principles:**
1. Every Linear Project creates a JIRA Epic (the work container) AND a JIRA Version (for release tracking)
2. Linear Milestones become Tasks linked to their parent Epic
3. All Tasks are associated with the Version via `fixVersions` for release reports

**Linear → GitHub:**
- **Linear Initiative Documents** → **GitHub Wiki Pages** (synced to the project's linked GitHub repo wiki)
  - Wiki page title = Document title (cleaned for wiki filename)
  - Wiki page content = Document content (markdown)
  - Source link = Linear document URL
- **Linear Issues/Milestones** → **GitHub Issues** (with JIRA key prefix for smart commits)
  - **Title format:** `[JIRA-KEY] Issue Title` (e.g., `[ITPLAT01-1761] M1: Tenant Inventory & Archera Handoff`)
  - This enables JIRA smart commits - developers can reference/close JIRA issues from Git commits
  - Body includes Linear URL, JIRA URL, and task checklist

**Linear → Confluence:**
- **Linear Initiative Documents** → **Confluence Pages** (synced under parent page from initiative's "Confluence Wiki" link)
  - Page title = Document title (cleaned, without brackets)
  - Page content = Document content (markdown, converted by Confluence)
  - Source link = Linear document URL
  - Parent page = Extracted from initiative's "Confluence Wiki" resource link

## Initiative Content Fields

**CRITICAL:** Linear Initiatives have TWO content fields that serve different purposes:

| Field | Limit | Purpose | Where It Shows |
|-------|-------|---------|----------------|
| `description` | **255 chars** | Short summary | Initiative lists, cards |
| `content` | **Unlimited** | Full markdown | Initiative page (Description section) |

**To update initiative content (Power Framework, Executive Summary, etc.):**
```graphql
mutation { initiativeUpdate(id: "INITIATIVE_ID", input: { content: "## Full markdown..." }) { success } }
```

**Common mistake:** Trying to put long content in `description` field will fail with "must be shorter than or equal to 255 characters" error.

See [GRAPHQL.md](GRAPHQL.md#initiative-fields-critical) for full field reference and mutation examples.

## JIRA Configuration

Linear Projects have URL links in the "Resources" section that specify configuration:

**Required Project Links:**
- **Jira Parent ID** - The JIRA issue key to use as parent for epics (e.g., "ITPMO01-1619")
- **Jira Project ID** - The JIRA project key where epics should be created (e.g., "ITPLAT01")
- **GitHub Repo** - The GitHub repository for developer issues (e.g., "https://github.com/eci-global/gitops")

**Example:**
```
Linear Project "GitOps Reference Architecture & Operating Model":
  - "Jira Parent ID" → https://eci-solutions.atlassian.net/browse/ITPMO01-1619
  - "Jira Project ID" → https://eci-solutions.atlassian.net/jira/software/c/projects/ITPLAT01/boards/107
  - "GitHub Repo" → https://github.com/eci-global/gitops
```

## Quick Reference

**Fetching data priority:**
1. ALWAYS try Linear MCP server FIRST
2. ONLY use GraphQL when MCP doesn't support the operation

**For GraphQL queries:** See [GRAPHQL.md](GRAPHQL.md)

**Field mappings and sync steps:** See [JIRA-MAPPING.md](JIRA-MAPPING.md)

**Preventing duplicates:** See [IDEMPOTENCY.md](IDEMPOTENCY.md)

**Detailed examples:** See [EXAMPLES.md](EXAMPLES.md)

## JIRA Versions/Releases

**What are JIRA Versions?**
JIRA Versions (also called "Fix Versions" or "Releases") are purpose-built for milestone/release tracking:
- Represent points-in-time or release targets
- Have `name`, `description`, `startDate`, `releaseDate`
- Have `released` boolean to mark completion
- Issues/Epics associate via `fixVersions` field (array)

**Why use Versions for Linear Projects?**
- **Sprint-less workflow** - Release dates replace sprint boundaries
- **Built-in tracking** - JIRA release reports, burndowns work automatically
- **Clear organization** - All epics and tasks grouped by release

## GitHub Wiki Sync

**What are GitHub Wiki Pages?**
GitHub Wikis are documentation spaces attached to repositories. Each wiki is a separate git repository.

**Why use Wiki for Initiative Documents?**
- **Structured documentation** - Initiative documents are narrative content, not tasks
- **Easy navigation** - Wiki sidebar provides table of contents
- **Versioned** - Changes are tracked via git
- **Accessible** - Developers can read docs alongside code

**Sync Process:**
1. Fetch initiative documents via GraphQL (see [GRAPHQL.md](GRAPHQL.md))
2. For each document:
   - Clean title for wiki filename (remove brackets, special chars)
   - Create wiki page via `gh wiki create` or git operations on `.wiki.git` repo
   - Add Linear source URL at bottom of each page
3. Create/update Home page with table of contents

**Wiki Page Naming Convention:**
- `[0] Wiki Table of Contents` → `Home.md` (special wiki homepage)
- `[1] GitOps Modernization – Overview` → `GitOps-Modernization-Overview.md`
- `[8] FAQs & Common Concerns` → `FAQs-and-Common-Concerns.md`

**Wiki Link Syntax:**
Use standard markdown links `[Display Text](Page-Name)` instead of wiki-style `[[Page-Name]]` for reliable linking across all GitHub wiki configurations.

**GitHub CLI for Wiki Operations:**
```bash
# Clone the wiki repo
git clone https://github.com/org/repo.wiki.git

# Add/update pages
cp page.md repo.wiki/Page-Name.md

# Commit and push
cd repo.wiki && git add . && git commit -m "Update wiki from Linear" && git push
```

**Important:** Wiki must be enabled on the GitHub repository before syncing.

## GitHub Issue Sync

**Purpose:** Create GitHub issues from Linear milestones/issues with JIRA key prefixes to enable smart commits.

### Naming Convention (Required)

GitHub issue titles MUST follow this format:

```
[JIRA-KEY] Issue Title
```

**Examples:**
- `[ITPLAT01-1761] M1: Tenant Inventory & Archera Handoff`
- `[ITPLAT01-1749] Add GitOps Outcomes Checklist v0.1`
- `[ITPLAT01-1752] GitHub Reference Architecture`

### Why This Matters

JIRA smart commits allow developers to:
- **Reference issues:** `git commit -m "[ITPLAT01-1761] Add tenant inventory script"` links the commit to JIRA
- **Log time:** `git commit -m "[ITPLAT01-1761] #time 2h Add inventory script"` logs 2 hours
- **Transition issues:** `git commit -m "[ITPLAT01-1761] #done Complete inventory"` moves issue to Done

### Issue Body Template

```markdown
## [Project Name] - [Milestone Name]

**Target Date:** YYYY-MM-DD

### Description
[Milestone description from Linear]

### Tasks
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

### Links
- **JIRA:** https://eci-solutions.atlassian.net/browse/ITPLAT01-XXXX
- **Linear Milestone:** https://linear.app/eci-platform-team/milestone/[id]
```

### Sync Process

1. **Get JIRA key** from the synced JIRA epic (must sync to JIRA first)
2. **Create GitHub issue** with `[JIRA-KEY] Title` format
3. **Include cross-links** in body (JIRA URL, Linear URL)
4. **Add labels** for project categorization (e.g., `azure`, `gcp`, `focus`, `milestone`)

### Bidirectional Linking

After creating GitHub issue, update:
- **JIRA epic description** with GitHub issue URL
- **Linear milestone** with GitHub issue URL (via description update)

This enables the reverse sync workflow: GitHub → Linear → JIRA

## Confluence Sync

**What is Confluence?**
Confluence is Atlassian's enterprise wiki and documentation platform, accessible to the broader organization.

**Why sync to Confluence?**
- **Enterprise visibility** - Stakeholders outside the dev team can access documentation
- **Integration with JIRA** - Pages link naturally to JIRA issues and projects
- **Search and discovery** - Enterprise search across all Confluence spaces
- **Permissions** - Fine-grained access control for sensitive content

**Initiative Configuration:**
Linear Initiatives have a "Confluence Wiki" link in their Resources section:
- **Confluence Wiki** - Parent page URL where child pages will be created
- Extract `space_key` and `parent_id` from the URL

**URL Pattern:**
```
https://eci-solutions.atlassian.net/wiki/spaces/CGIP/pages/1744666626/Page+Title
                                              ^^^^       ^^^^^^^^^^
                                              space_key  parent_id
```

**Sync Process:**
1. Fetch initiative documents via GraphQL
2. Get the "Confluence Wiki" link from initiative resources (use `links` field)
3. Extract space_key and parent_id from the URL
4. Get JIRA Parent ID from any project in the initiative:
   - Query project `externalLinks` via GraphQL
   - Find "Jira Parent ID" link and extract issue key (e.g., "ITPMO01-1619")
5. For each document:
   - Clean title (remove brackets like `[1]`)
   - Use `confluence_create_page` MCP tool with:
     - `space_key` from URL
     - `parent_id` from URL
     - `title` = cleaned document title
     - `content` = document content (**NO Linear source links**)
     - `content_format` = "markdown"
6. Update parent page with Power framework template:
   - Problem, Outcomes, Why Now, Execution, Key Results
   - JIRA link (for PMO tracking)
   - GitHub link (for developer access)
   - **NO Linear references** (internal tool, not for stakeholders)

**Page Naming Convention:**
- `[0] Wiki Table of Contents` → "Table of Contents" (or skip, use parent as TOC)
- `[1] GitOps Modernization – Overview` → "GitOps Modernization – Overview"
- `[8] FAQs & Common Concerns` → "FAQs & Common Concerns"

**Parent Page Template (Stakeholder-Facing):**

Update the Confluence parent page with the Power framework content. **IMPORTANT: Do NOT include references to Linear** - Confluence is for stakeholders who don't need to know about internal planning tools.

```markdown
# 2026 Q1 - [Initiative Name]

**Initiative Owner:** [Team Name]
**Target Date:** [Date]
**Status:** 🟢 On Track

---

## Quick Links

| Platform | Link |
|----------|------|
| **GitHub Repository** | [org/repo](https://github.com/org/repo) |
| **JIRA** | [ITPMO01-XXX](https://eci-solutions.atlassian.net/browse/ITPMO01-XXX) |

---

## Problem

**[One-sentence problem statement in bold.]**

[Gap analysis table and root cause]

---

## Outcomes

**[One-sentence outcome statement in bold.]**

1. **[Outcome 1]** - [Description]
2. **[Outcome 2]** - [Description]

---

## Why Now

- **[Reason 1]** - [Explanation]
- **[Reason 2]** - [Explanation]

---

## Execution

[Strategy table with tracks, approaches, owners]

---

## Key Results

### [Theme 1] (Target: [Date])

| KR | Description | Target Date |
|----|-------------|-------------|
| **KR1.1** | [Description] | [Date] |
| **KR1.2** | [Description] | [Date] |

### [Theme 2] (Target: [Date])

| KR | Description | Target Date |
|----|-------------|-------------|
| **KR2.1** | [Description] | [Date] |

---

## Projects

| Project | Target Date | Status |
|---------|-------------|--------|
| [Project 1] | [Date] | 🟢 On Track |
| [Project 2] | [Date] | 🟢 On Track |

---

## Direct Alignment to Strategy

- **[Strategic Priority 1]** - [Source]
- **[Strategic Priority 2]** - [Source]

---

## Documentation Pages

* [Child Page 1](url)
* [Child Page 2](url)
```

**Key Rules for Confluence:**
1. **No Linear references** - Stakeholders don't need to know about internal tools
2. **Include JIRA links** - PMO tracks via JIRA
3. **Include GitHub links** - Developers access code via GitHub
4. **Use health emojis** - 🟢 On Track, 🟡 At Risk, 🔴 Off Track
5. **Key Results in tables** - Easy scanning for leadership

**Note:** Confluence macros like `children` don't render properly when using markdown format. Use a manual list of links instead for reliable navigation.

**MCP Tools for Confluence:**
- `confluence_create_page` - Create new page under parent
- `confluence_update_page` - Update existing page content
- `confluence_search` - Find existing pages (for idempotency)
- `confluence_get_page` - Get page details by ID

## Live JIRA Issue Tables in Confluence

**IMPORTANT: Always embed live JIRA tables in Confluence initiative pages.** This gives PMO a one-stop shop to see all work items with real-time status updates.

### Why Live JIRA Tables?

- **Auto-updating** - Tables refresh automatically when JIRA issues change status
- **Single source of truth** - PMO doesn't need to navigate to JIRA
- **JQL-powered** - Use any JQL query to filter issues
- **Configurable columns** - Show key, summary, status, assignee, due date, etc.

### How It Works

Confluence has a native **Jira Issues Macro** that displays JIRA issues via JQL queries. The macro uses Confluence's storage format (XHTML) with the `ac:structured-macro` element.

### Storage Format Syntax

```xml
<ac:structured-macro ac:name="jira" ac:schema-version="1" data-layout="full-width" ac:macro-id="unique-id">
  <ac:parameter ac:name="columns">key,summary,type,assignee,status,duedate</ac:parameter>
  <ac:parameter ac:name="maximumIssues">20</ac:parameter>
  <ac:parameter ac:name="jqlQuery">project = ITPLAT01 AND fixVersion = "Project Name" ORDER BY duedate ASC</ac:parameter>
</ac:structured-macro>
```

**Parameters:**
| Parameter | Description | Example |
|-----------|-------------|---------|
| `columns` | Comma-separated column names | `key,summary,type,assignee,status,duedate` |
| `maximumIssues` | Max rows to display | `20` |
| `jqlQuery` | JQL filter for issues | `fixVersion = "Azure Archera Onboarding"` |

### JQL Patterns for Initiatives

**All issues in a JIRA Version (Linear Project):**
```
project = ITPLAT01 AND fixVersion = "Azure Archera Onboarding" ORDER BY duedate ASC
```

**All epics linked to a parent:**
```
project = ITPLAT01 AND issuetype = Epic AND issuekey in linkedIssues("ITPMO01-1540") ORDER BY duedate ASC
```

**Issues by status:**
```
project = ITPLAT01 AND fixVersion = "FOCUS Data Unification" AND status != Done ORDER BY status ASC
```

### MCP Implementation - CRITICAL LIMITATION

**WARNING: The Confluence MCP tool has a bug that HTML-encodes storage format content.**

When you use `confluence_update_page` with `content_format: "storage"`, the tool HTML-encodes the content (converting `<` to `&lt;` and `>` to `&gt;`), which breaks all macros and renders raw HTML as text.

**DO NOT use MCP to update pages that contain JIRA macros or other Confluence macros.**

### Correct Approach: Use REST API via Python

Use Python with the `requests` library to update pages with macros:

```python
import requests

# Read HTML content with macros from a file
with open('/tmp/confluence_page_content.html', 'r') as f:
    content = f.read()

# Confluence API setup
page_id = "1807155271"
base_url = f"https://eci-solutions.atlassian.net/wiki/rest/api/content/{page_id}"
auth = ("email@example.com", "ATLASSIAN_API_TOKEN")

# Get current version
response = requests.get(base_url, auth=auth)
current_version = response.json().get('version', {}).get('number', 0)

# Update the page
payload = {
    "version": {
        "number": current_version + 1,
        "message": "Updated with JIRA macros"
    },
    "title": "Page Title",
    "type": "page",
    "body": {
        "storage": {
            "value": content,
            "representation": "storage"
        }
    }
}

response = requests.put(
    base_url,
    auth=auth,
    headers={"Content-Type": "application/json"},
    json=payload
)

if response.status_code == 200:
    print(f"Success! Version: {response.json().get('version', {}).get('number')}")
else:
    print(f"Error: {response.status_code} - {response.text[:500]}")
```

**Key points:**
1. Write HTML content (with macros) to a file first
2. Use `requests.put()` with `json=payload` to properly serialize
3. The REST API preserves macro XML, unlike the MCP tool
4. Get current version first, increment by 1 for the update

### What MCP CAN safely do:
- Create new pages with `content_format: "markdown"` (no macros)
- Update pages that don't contain any Confluence macros
- Search for pages
- Read page content

### What MCP CANNOT safely do:
- Update pages that contain JIRA macros, children macros, or any `ac:structured-macro` elements
- Create pages with macros embedded

### If you accidentally break a page with macros:
1. Go to the page in Confluence
2. Click `...` menu → **Page history**
3. Find the last working version
4. Click **Restore this version**
```

### Standard Sync Output

When syncing an initiative to Confluence, **ALWAYS include a "Live Project Status" section** with JIRA macros for each version.

**Because MCP cannot safely add macros (see limitation above), you must add them manually:**

1. Create or update the page content using MCP with `content_format: "markdown"` (for non-macro sections only)
2. Open the page in Confluence UI
3. Edit the page and position cursor where you want the JIRA table
4. Type `/jira` and select "Jira Issues" macro
5. Configure the macro:
   - **JQL Query**: `project = ITPLAT01 AND fixVersion = "[Project Name]" ORDER BY duedate ASC`
   - **Columns**: key, summary, type, assignee, status, duedate
   - **Maximum Issues**: 20
6. Repeat for each project/version
7. Save the page

**Section structure:**
1. Add `## Live Project Status` section after Quick Links
2. Add italicized note: *These tables update automatically as JIRA issues change status.*
3. For each Linear Project (JIRA Version):
   - Add `### [Project Name]` heading
   - Add JIRA macro with JQL: `fixVersion = "[Project Name]"`
   - Use columns: `key,summary,type,assignee,status,duedate`

### Example Output

```html
<h2>Live Project Status</h2>
<p><em>These tables update automatically as JIRA issues change status.</em></p>

<h3>Azure Archera Onboarding</h3>
<p><ac:structured-macro ac:name="jira" ac:schema-version="1" data-layout="full-width" ac:macro-id="azure-archera">
  <ac:parameter ac:name="columns">key,summary,type,assignee,status,duedate</ac:parameter>
  <ac:parameter ac:name="maximumIssues">20</ac:parameter>
  <ac:parameter ac:name="jqlQuery">project = ITPLAT01 AND fixVersion = "Azure Archera Onboarding" ORDER BY duedate ASC</ac:parameter>
</ac:structured-macro></p>

<h3>GCP Archera Onboarding</h3>
<p><ac:structured-macro ac:name="jira" ac:schema-version="1" data-layout="full-width" ac:macro-id="gcp-archera">
  <ac:parameter ac:name="columns">key,summary,type,assignee,status,duedate</ac:parameter>
  <ac:parameter ac:name="maximumIssues">20</ac:parameter>
  <ac:parameter ac:name="jqlQuery">project = ITPLAT01 AND fixVersion = "GCP Archera Onboarding" ORDER BY duedate ASC</ac:parameter>
</ac:structured-macro></p>
```

### Benefits for PMO

1. **Real-time visibility** - No need to ask for status updates
2. **Drill-down capability** - Click any issue key to see full details
3. **Status at a glance** - Color-coded status columns
4. **Due date tracking** - See what's overdue or upcoming
5. **Assignee accountability** - See who owns each item

## Critical Rules

**ALWAYS check Linear FIRST (source of truth)**:
- Search Linear for existing issues before checking JIRA/GitHub
- If Linear issues missing but JIRA/GitHub exist: Create Linear issues and link them
- If Linear issues exist: Proceed with normal sync

**ALWAYS create issues with full bidirectional linkage:**
- Create Linear Issue first (associate with milestone)
- Create JIRA Task (link to Epic, add Linear URL to description)
- Create GitHub Issue (JIRA key prefix in title, Linear/JIRA URLs in body)
- Update Linear Issue description with JIRA/GitHub links
- This enables reverse sync: GitHub → Linear → JIRA

**ALWAYS use on-demand tool loading (MCP best practice)**:
- Use ToolSearch to load only needed tools for current operation
- Reduces token usage by up to 98% (150K → 2K tokens)
- Load tools at start of each phase, not all at once

**ALWAYS use `jira_link_to_epic` for Task-to-Epic links:**
```
jira_link_to_epic(issue_key="ITPLAT01-1678", epic_key="ITPLAT01-1673")
```
- DO NOT use the `parent` field in `additional_fields` to link tasks to epics - this fails silently
- The `parent` field is ONLY for subtasks

**ALWAYS use `customfield_10018` to set Parent on Epics:**
```
jira_update_issue(
  issue_key="ITPLAT01-1774",
  fields={},
  additional_fields={"customfield_10018": "ITPMO01-1686"}
)
```
- This sets the **native Parent field** visible in JIRA Advanced Roadmaps
- Do NOT use `jira_create_issue_link` with "Parent" link type - that creates issue links, not the native parent
- The `customfield_10018` (Parent Link) is a JPO field for hierarchical relationships
- Can also set during creation: `additional_fields={"customfield_10018": "PARENT-KEY"}`

**For reverse sync (GitHub → Linear → JIRA):**
- Extract JIRA key from GitHub title: `[ITPLAT01-123]`
- Get JIRA task and extract Linear URL from description
- Update Linear state when GitHub issue closes
- Transition JIRA status when GitHub issue closes
- See [REVERSE-SYNC.md](REVERSE-SYNC.md) for full workflow

**Ask for confirmation** before bulk operations (>10 items)
