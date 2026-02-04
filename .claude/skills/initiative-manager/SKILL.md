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

### Required Sections

```markdown
## Latest Status Update

**📋 [Date] - [Status Title]**

[Brief status summary - what happened, what's next]

| Platform | Link | Purpose |
| -- | -- | -- |
| **Linear** | [Initiative](url) | Source of truth |
| **GitHub** | [repo](url) | Code/automation |
| **JIRA** | [ITPLAT01-XXX](url) | PMO tracking |
| **Confluence** | [Page](url) | Documentation |

---

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
  └─ Linear Project → JIRA Version/Release
      └─ Linear Milestone → JIRA Epic (associated with version)
          └─ Linear Issue → JIRA Task (associated with version)
```

## Sync Mapping

**Linear → JIRA:**
- **Linear Initiative** → Metadata only (included in version/epic descriptions for context)
- **Linear Project** → **JIRA Version/Release** (automatically created, one version per project)
  - Version name = Project name
  - Version startDate = Project startDate
  - Version releaseDate = Project targetDate
- **Linear Milestones** → **JIRA Epics** (linked to parent, associated with project's version via fixVersions)
- **Linear Issues** → **JIRA Tasks** (with Epic Link, associated with project's version via fixVersions)

**Key Principle:**
Every Linear Project gets its own JIRA Version. All epics and tasks from that project are associated with that version via the `fixVersions` field.

**Linear → GitHub:**
- **Linear Initiative Documents** → **GitHub Wiki Pages** (synced to the project's linked GitHub repo wiki)
  - Wiki page title = Document title (cleaned for wiki filename)
  - Wiki page content = Document content (markdown)
  - Source link = Linear document URL
- **Linear Issues** → **GitHub Issues** (with JIRA key prefix for smart commits)

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
     - `content` = document content + Linear source link
     - `content_format` = "markdown"
6. Update parent page with:
   - JIRA Parent Issue link (from step 4)
   - List of child pages or children display macro
   - Initiative description

**Page Naming Convention:**
- `[0] Wiki Table of Contents` → "Table of Contents" (or skip, use parent as TOC)
- `[1] GitOps Modernization – Overview` → "GitOps Modernization – Overview"
- `[8] FAQs & Common Concerns` → "FAQs & Common Concerns"

**Parent Page Update:**
After creating all child pages, update the parent page using `confluence_update_page`:
```markdown
# [Initiative Name]

**2026 Q1 Initiative**

[Initiative description]

---

## JIRA Tracking

**PMO Parent Issue:** [ITPMO01-1619](https://eci-solutions.atlassian.net/browse/ITPMO01-1619)

---

## Documentation Pages

* [Child Page 1](Child-Page-1)
* [Child Page 2](Child-Page-2)
* ...
```

**Note:** Confluence macros like `children` don't render properly when using markdown format. Use a manual list of links instead for reliable navigation.

**MCP Tools for Confluence:**
- `confluence_create_page` - Create new page under parent
- `confluence_update_page` - Update existing page content
- `confluence_search` - Find existing pages (for idempotency)
- `confluence_get_page` - Get page details by ID

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

**ALWAYS use `jira_link_to_epic` for Epic links:**
```
jira_link_to_epic(issue_key="ITPLAT01-1678", epic_key="ITPLAT01-1673")
```
- DO NOT use the `parent` field in `additional_fields` to link tasks to epics - this fails silently
- The `parent` field is ONLY for subtasks

**For reverse sync (GitHub → Linear → JIRA):**
- Extract JIRA key from GitHub title: `[ITPLAT01-123]`
- Get JIRA task and extract Linear URL from description
- Update Linear state when GitHub issue closes
- Transition JIRA status when GitHub issue closes
- See [REVERSE-SYNC.md](REVERSE-SYNC.md) for full workflow

**Ask for confirmation** before bulk operations (>10 items)
