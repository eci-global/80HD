---
name: sync-linear-jira
description: Sync data from Linear to JIRA and GitHub with natural language instructions. Use when syncing projects, milestones, or issues between Linear, JIRA, and GitHub.
---

You have access to Linear, Atlassian (JIRA), and GitHub MCP servers. The user will provide natural language sync instructions.

## Contents

- [Platform Roles](#platform-roles) - Why each system exists
- [Overview](#overview) - Hierarchy and sync mapping
- [JIRA Configuration](#jira-configuration) - Required project links
- [Fetching Data](GRAPHQL.md) - GraphQL queries for Linear API
- [Sync Behavior](JIRA-MAPPING.md) - Field mappings and hierarchy
- [Idempotent Sync](IDEMPOTENCY.md) - Duplicate prevention and updates
- [Examples](EXAMPLES.md) - 5 detailed sync scenarios

## Platform Roles

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

## Critical Rules

**ALWAYS use `jira_link_to_epic` for Epic links:**
```
jira_link_to_epic(issue_key="ITPLAT01-1678", epic_key="ITPLAT01-1673")
```
- DO NOT use the `parent` field in `additional_fields` to link tasks to epics - this fails silently
- The `parent` field is ONLY for subtasks

**Ask for confirmation** before bulk operations (>10 items)
