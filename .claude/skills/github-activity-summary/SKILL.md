---
name: github-activity-summary
description: Summarize commits and PRs across team repos in GitHub and Azure DevOps. Use when users ask "who's doing what", "team activity", "what's the team been up to", or want a summary of PRs and commits.
allowed-tools: Bash(gh *), Bash(az repos *)
---

# GitHub & Azure DevOps Activity Summary

## Contents

- [Overview](#overview)
- [Tracked Repositories](#tracked-repositories)
- [Workflow](#workflow)
- [Output Format](#output-format)
- [Dashboard](#dashboard) - Interactive web dashboard
- [Natural Language Parsing](#natural-language-parsing)
- [Automation](#automation) - Scheduled email reports
- [Critical Rules](#critical-rules)
- [Configuration](#configuration)
- [Examples](EXAMPLES.md) - Common usage scenarios
- [Automation Details](AUTOMATION.md) - Email delivery setup

## Overview

This skill provides a consolidated view of team activity across multiple repositories in GitHub and Azure DevOps. It answers questions like:
- Who's been active this week?
- What PRs are open/merged?
- What commits have been made?
- What's the team working on?

### User Experience Goals

| Before | After |
|--------|-------|
| Manually check 6+ repos across 2 platforms | Single command shows all activity |
| Miss PRs that need review | See all open PRs in one place |
| Lose track of team progress | Clear summary by person and repo |

## Tracked Repositories

### GitHub Repositories (ECI-Global org)

| Pattern | Description |
|---------|-------------|
| `*one-cloud*` | Any repo with "one-cloud" in the name |
| `firehydrant` | The FireHydrant repo |
| `core-logics` | The Core Logics repo |
| `*iac*` | IAC (Infrastructure as Code) repos |
| `coralogix` | The Coralogix observability repo |

### Azure DevOps Repositories

| Organization | Project | Repository |
|--------------|---------|------------|
| Cloud-Delivery | spruce | spruce |

## Workflow

### Step 1: Determine Time Range

Parse user request for time range. Defaults:
- "today" → last 24 hours
- "this week" → last 7 days
- "this month" → last 30 days
- No time specified → last 7 days

### Step 2: Gather GitHub Activity

For each tracked repository pattern, use the `gh` CLI:

**List matching repos:**
```bash
gh repo list ECI-Global --json name,nameWithOwner --limit 100 | jq '[.[] | select(.name | test("one-cloud|firehydrant|core-logics|iac|coralogix"; "i"))]'
```

**Get commits (last 7 days):**
```bash
gh api repos/{owner}/{repo}/commits --jq '.[] | {sha: .sha[0:7], author: .commit.author.name, date: .commit.author.date, message: .commit.message | split("\n")[0]}'
```

**Get pull requests:**
```bash
gh api repos/{owner}/{repo}/pulls?state=all --jq '.[] | {number, title, user: .user.login, state, created_at, merged_at}'
```

### Step 3: Gather Azure DevOps Activity

For the Cloud-Delivery/spruce repo:

**Get commits:**
```bash
az repos commit list --organization https://dev.azure.com/Cloud-Delivery --project spruce --repository spruce --top 50 --output json
```

**Get pull requests:**
```bash
az repos pr list --organization https://dev.azure.com/Cloud-Delivery --project spruce --repository spruce --status all --top 50 --output json
```

### Step 4: Aggregate by Team Member

Group all activity by author/creator:
- Commits authored
- PRs opened
- PRs merged
- PRs currently open

### Step 5: Generate Summary

Create a consolidated report organized by:
1. **Team Member Summary** - Who did what
2. **Repository Summary** - Activity per repo
3. **Open PRs Needing Attention** - PRs awaiting review/merge

## Output Format

### Team Activity Summary

```markdown
## Team Activity (Last 7 Days)

### By Team Member

**@alice**
- 12 commits across 3 repos
- 2 PRs merged (one-cloud-api, core-logics)
- 1 PR open: #45 "Add caching layer" (one-cloud-api)

**@bob**
- 8 commits across 2 repos
- 1 PR merged (iac)
- 0 PRs open

**@carol**
- 5 commits (spruce - Azure DevOps)
- 1 PR open: !958 "Feature update" (spruce)

### By Repository

| Repository | Commits | PRs Merged | PRs Open |
|------------|---------|------------|----------|
| one-cloud-api | 15 | 3 | 2 |
| core-logics | 8 | 1 | 0 |
| fire-hydrant | 3 | 0 | 1 |
| iac | 6 | 2 | 0 |
| spruce (ADO) | 5 | 1 | 1 |

### Open PRs Needing Attention

| Repo | PR | Title | Author | Age |
|------|-----|-------|--------|-----|
| one-cloud-api | #45 | Add caching layer | @alice | 3d |
| fire-hydrant | #12 | Fix auth flow | @dave | 5d |
| spruce | !958 | Feature update | @carol | 2d |
```

## Dashboard

An interactive web dashboard is available for visual exploration of team activity.

### Quick Start

```bash
cd .claude/skills/github-activity-summary/dashboard
npm install
npm run dev
```

Then open http://localhost:3456

### Features

- **Metric Cards**: Commits, PRs merged, PRs open, contributors at a glance
- **Charts**: Bar and pie charts showing commits by contributor and repo
- **Contributor Cards**: Individual activity with avatar and stats
- **PR Alerts**: Color-coded open PRs by status (stale, needs review, in review)
- **Commit Timeline**: Recent commits with author and message
- **Real-time Data**: API fetches live data from GitHub

### Component Catalog

The dashboard uses a json-render style component catalog. Claude can generate custom dashboard layouts by outputting JSON that maps to these components:

| Component | Purpose |
|-----------|---------|
| `MetricCard` | Single metric with icon and trend |
| `ContributorCard` | Team member activity summary |
| `RepoCard` | Repository activity summary |
| `PRAlert` | Open PR with status indicator |
| `BarChart` | Bar chart visualization |
| `PieChart` | Pie chart visualization |
| `CommitList` | Recent commits list |

Ask Claude: "Show me a pie chart of commits by contributor" or "Create a dashboard focused on open PRs"

## Natural Language Parsing

| User Says | Interpretation |
|-----------|----------------|
| "What's the team been up to?" | Last 7 days, all repos, all activity |
| "Show me this week's PRs" | Last 7 days, PRs only |
| "Who's committing to one-cloud?" | Last 7 days, one-cloud repos only |
| "Alice's activity this month" | Last 30 days, filter to alice |
| "Open PRs across all repos" | Current open PRs only |
| "What merged today?" | Last 24 hours, merged PRs only |

## Automation

For automated daily email reports, see [AUTOMATION.md](AUTOMATION.md).

**Quick setup:**

1. Create a GitHub Actions workflow that runs the report script daily
2. Use SendGrid/Mailgun/SES to email the generated report
3. Schedule for 8am in your timezone

The automation script at `scripts/generate-report.sh` produces an HTML email-ready report.

## Critical Rules

### Data Freshness
- Always fetch live data - never cache or assume
- Report the exact time range queried
- Note any repos that failed to query

### Authentication
- GitHub: Requires `gh` CLI authenticated
- Azure DevOps: Requires `az` CLI authenticated with appropriate permissions

### Error Handling
- If a repo is inaccessible, skip it and note in output
- If a platform is unavailable, report partial results from other platform
- Always complete the summary with available data

### Privacy
- Only show activity from configured repos
- Do not expose email addresses, only usernames/display names
- Truncate long commit messages to first line

## Configuration

### Required Environment

**GitHub:**
- `gh` CLI installed and authenticated

**Azure DevOps:**
- `az` CLI installed and authenticated
- Access to Cloud-Delivery organization

### Adding/Removing Repos

To modify tracked repositories, update this skill file:
- Add patterns to the GitHub patterns list
- Add org/project/repo entries to Azure DevOps list

### Contributor Name Mapping

The dashboard normalizes contributor names across platforms. To add or modify mappings, edit the `CONTRIBUTOR_ALIASES` object in `dashboard/app/api/dashboard/route.ts`:

```typescript
const CONTRIBUTOR_ALIASES: Record<string, string> = {
  'github-username': 'Display Name',
  'ado-display-name': 'Display Name',
  // Example mappings:
  'rustyautopsy': 'Travis Edgar',
  'sewilson-eci': 'Sean Wilson',
  'git-blazelewis': 'Blaze Lewis',
  'rclemens-eci': 'Rick Clemens',
};
```

This ensures activity from the same person across GitHub and Azure DevOps is aggregated correctly.

## Further Reading

- [Examples](EXAMPLES.md) - Common usage scenarios and expected output
- [Automation](AUTOMATION.md) - Email delivery and scheduling setup
