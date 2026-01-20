---
name: sync-linear-jira
description: Sync data from Linear to JIRA, GitHub, and Confluence with natural language instructions. Use when syncing projects, milestones, issues, or documents between Linear, JIRA, GitHub, and Confluence.
---

You have access to Linear, Atlassian (JIRA & Confluence), and GitHub MCP servers. The user will provide natural language sync instructions.

## Contents

- [Platform Roles](#platform-roles) - Why each system exists
- [Overview](#overview) - Hierarchy and sync mapping
- [JIRA Configuration](#jira-configuration) - Required project links
- [GitHub Wiki Sync](#github-wiki-sync) - Initiative documents to GitHub wiki
- [Confluence Sync](#confluence-sync) - Initiative documents to Confluence pages
- [Fetching Data](GRAPHQL.md) - GraphQL queries for Linear API
- [Sync Behavior](JIRA-MAPPING.md) - Field mappings and hierarchy
- [Idempotent Sync](IDEMPOTENCY.md) - Duplicate prevention and updates
- [Examples](EXAMPLES.md) - 7 detailed sync scenarios

## Platform Roles

**This three-platform model serves different audiences:**

| Platform | Role | Primary Audience | What Lives Here |
|----------|------|------------------|-----------------|
| **Linear** | **Source of Truth** | Platform Enablement Team | Projects, Milestones, task definitions, target dates, structure |
| **GitHub** | **Developer Workspace** | Developers & Engineers | Issues to work on, PRs, code, automation, wiki documentation |
| **JIRA** | **PMO/Leadership View** | PMO, Leadership, Stakeholders | Versions, Epics, Tasks for release tracking and reporting |
| **Confluence** | **Enterprise Documentation** | All Stakeholders | Initiative documentation, wikis, knowledge base for broader org |

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

**ALWAYS use `jira_link_to_epic` for Epic links:**
```
jira_link_to_epic(issue_key="ITPLAT01-1678", epic_key="ITPLAT01-1673")
```
- DO NOT use the `parent` field in `additional_fields` to link tasks to epics - this fails silently
- The `parent` field is ONLY for subtasks

**Ask for confirmation** before bulk operations (>10 items)
