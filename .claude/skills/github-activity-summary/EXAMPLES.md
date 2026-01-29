# Examples

## Example 1: Weekly Team Summary

**User:** "What's the team been up to this week?"

**Workflow:**

1. Parse time range: "this week" → last 7 days
2. Query GitHub repos matching patterns
3. Query Azure DevOps spruce repo
4. Aggregate by team member
5. Generate summary

**Output:**

```markdown
## Team Activity (Jan 22-29, 2026)

### By Team Member

**@alice**
- 12 commits across 3 repos
- 2 PRs merged: #89 (one-cloud-api), #34 (core-logics)
- 1 PR open: #45 "Add caching layer" (one-cloud-api) - 3 days old

**@bob**
- 8 commits across 2 repos (one-cloud-infra, iac)
- 1 PR merged: #78 (iac)
- 0 PRs open

**@carol**
- 5 commits (spruce - Azure DevOps)
- 1 PR merged: !952 (spruce)
- 1 PR open: !958 "Update deployment config" - 2 days old

**@dave**
- 3 commits (fire-hydrant)
- 1 PR open: #12 "Fix auth flow" - 5 days old ⚠️

### By Repository

| Repository | Platform | Commits | PRs Merged | PRs Open |
|------------|----------|---------|------------|----------|
| one-cloud-api | GitHub | 8 | 1 | 1 |
| one-cloud-infra | GitHub | 5 | 0 | 0 |
| core-logics | GitHub | 4 | 1 | 0 |
| fire-hydrant | GitHub | 3 | 0 | 1 |
| iac | GitHub | 6 | 1 | 0 |
| spruce | Azure DevOps | 5 | 1 | 1 |

**Total:** 31 commits, 4 PRs merged, 3 PRs open

### Open PRs Needing Attention

| Repo | PR | Title | Author | Age | Status |
|------|-----|-------|--------|-----|--------|
| fire-hydrant | #12 | Fix auth flow | @dave | 5d | ⚠️ Stale |
| one-cloud-api | #45 | Add caching layer | @alice | 3d | Review needed |
| spruce | !958 | Update deployment config | @carol | 2d | In review |
```

---

## Example 2: Single Person's Activity

**User:** "What has Alice been working on this month?"

**Workflow:**

1. Parse time range: "this month" → last 30 days
2. Parse filter: "Alice" → filter to alice's activity
3. Query all repos but filter results
4. Generate person-focused summary

**Output:**

```markdown
## Alice's Activity (Last 30 Days)

### Commits (47 total)

| Repository | Commits | Key Changes |
|------------|---------|-------------|
| one-cloud-api | 28 | Caching layer, auth refactor |
| core-logics | 12 | Bug fixes, perf improvements |
| one-cloud-infra | 7 | Terraform updates |

### Pull Requests

**Merged (6):**
- #89 "Implement Redis caching" (one-cloud-api) - merged Jan 25
- #87 "Refactor auth middleware" (one-cloud-api) - merged Jan 22
- #85 "Fix rate limiting bug" (one-cloud-api) - merged Jan 18
- #34 "Optimize query performance" (core-logics) - merged Jan 24
- #31 "Add batch processing" (core-logics) - merged Jan 15
- #29 "Update dependencies" (core-logics) - merged Jan 10

**Open (1):**
- #45 "Add caching layer" (one-cloud-api) - opened Jan 26, awaiting review

### Activity Timeline

```
Week 1 (Jan 1-7):   ████████ 8 commits
Week 2 (Jan 8-14):  ████████████ 12 commits
Week 3 (Jan 15-21): ██████████████ 14 commits
Week 4 (Jan 22-29): █████████████ 13 commits
```
```

---

## Example 3: Open PRs Only

**User:** "Show me all open PRs"

**Workflow:**

1. Parse filter: "open PRs" → only open state
2. Query all repos for open PRs
3. Sort by age (oldest first)
4. Generate PR-focused summary

**Output:**

```markdown
## Open Pull Requests

### Needing Immediate Attention (>5 days)

| Repo | PR | Title | Author | Age | Reviewers |
|------|-----|-------|--------|-----|-----------|
| fire-hydrant | #12 | Fix auth flow | @dave | 5d | None assigned ⚠️ |

### In Review (2-5 days)

| Repo | PR | Title | Author | Age | Reviewers |
|------|-----|-------|--------|-----|-----------|
| one-cloud-api | #45 | Add caching layer | @alice | 3d | @bob |
| spruce | !958 | Update deployment config | @carol | 2d | @eve |

### Recently Opened (<2 days)

| Repo | PR | Title | Author | Age | Reviewers |
|------|-----|-------|--------|-----|-----------|
| iac | #82 | Add new region | @bob | 1d | @alice |

**Summary:** 4 open PRs, 1 needs attention
```

---

## Example 4: Repository-Focused Query

**User:** "Who's committing to one-cloud repos?"

**Workflow:**

1. Parse filter: "one-cloud" → only one-cloud-* repos
2. Query GitHub for matching repos
3. Get commits and PRs
4. Generate repo-focused summary

**Output:**

```markdown
## One-Cloud Repository Activity (Last 7 Days)

### Repositories Found

- one-cloud-api
- one-cloud-infra
- one-cloud-ui
- one-cloud-docs

### Contributors

| Contributor | Commits | Repos | PRs |
|-------------|---------|-------|-----|
| @alice | 15 | api, infra | 2 merged, 1 open |
| @bob | 8 | infra, ui | 1 merged |
| @eve | 5 | docs, ui | 1 open |

### Recent Commits

**one-cloud-api** (8 commits)
- `a1b2c3d` @alice - Add Redis caching layer
- `e4f5g6h` @alice - Fix connection pooling
- `i7j8k9l` @alice - Update error handling
- ...

**one-cloud-infra** (10 commits)
- `m1n2o3p` @bob - Update Terraform modules
- `q4r5s6t` @alice - Add new VPC config
- ...
```

---

## Example 5: Today's Merges

**User:** "What merged today?"

**Workflow:**

1. Parse time range: "today" → last 24 hours
2. Parse filter: "merged" → only merged PRs
3. Query all repos
4. Generate merge-focused summary

**Output:**

```markdown
## Merged Today (Jan 29, 2026)

### Pull Requests Merged

| Time | Repo | PR | Title | Author | Reviewers |
|------|------|-----|-------|--------|-----------|
| 9:15 AM | one-cloud-api | #89 | Implement Redis caching | @alice | @bob, @eve |
| 11:30 AM | core-logics | #34 | Optimize query performance | @alice | @carol |
| 2:45 PM | spruce | !960 | Fix deployment script | @carol | @dave |

**Total:** 3 PRs merged today

### Commits in Merged PRs

- one-cloud-api #89: 5 commits
- core-logics #34: 3 commits
- spruce !960: 2 commits
```

---

## Example 6: Automated Morning Report

**Trigger:** Scheduled GitHub Action at 8 AM

**Output (HTML email):**

```html
Subject: Team Activity Report - Jan 29, 2026

Good morning! Here's what happened in the last 24 hours:

📊 SUMMARY
• 12 commits across 4 repos
• 2 PRs merged
• 1 new PR opened

👥 TEAM ACTIVITY
• alice: 5 commits, 1 PR merged
• bob: 4 commits
• carol: 3 commits, 1 PR merged

⚠️ ATTENTION NEEDED
• PR #12 (fire-hydrant) has been open for 5 days with no reviewers

View full report: [link]
```

---

## Example 7: Sprint Summary

**User:** "Summarize sprint activity for the last 2 weeks"

**Workflow:**

1. Parse time range: "2 weeks" → last 14 days
2. Query all repos
3. Calculate velocity metrics
4. Generate sprint summary

**Output:**

```markdown
## Sprint Summary (Jan 15-29, 2026)

### Velocity

| Metric | This Sprint | Last Sprint | Change |
|--------|------------|-------------|--------|
| Commits | 65 | 58 | +12% |
| PRs Merged | 12 | 10 | +20% |
| Avg PR Age | 2.3 days | 3.1 days | -26% |

### Top Contributors

1. **@alice** - 28 commits, 4 PRs merged
2. **@bob** - 18 commits, 3 PRs merged
3. **@carol** - 12 commits, 3 PRs merged
4. **@dave** - 7 commits, 2 PRs merged

### Repository Activity

| Repository | Commits | PRs | Status |
|------------|---------|-----|--------|
| one-cloud-api | 22 | 5 | 🟢 Active |
| core-logics | 15 | 3 | 🟢 Active |
| iac | 12 | 2 | 🟢 Active |
| spruce (ADO) | 10 | 2 | 🟢 Active |
| fire-hydrant | 6 | 0 | 🟡 Low activity |

### Highlights

- Major feature: Redis caching deployed to one-cloud-api
- Infrastructure: New region added to IAC
- Bug fixes: 8 bugs resolved across all repos
```

---

## Example 8: Cross-Platform Comparison

**User:** "Compare GitHub vs Azure DevOps activity"

**Output:**

```markdown
## Platform Comparison (Last 7 Days)

### GitHub

| Metric | Value |
|--------|-------|
| Repos tracked | 5 |
| Commits | 26 |
| PRs opened | 4 |
| PRs merged | 3 |
| Contributors | 4 |

### Azure DevOps

| Metric | Value |
|--------|-------|
| Repos tracked | 1 |
| Commits | 5 |
| PRs opened | 2 |
| PRs merged | 1 |
| Contributors | 2 |

### Combined

- **Total commits:** 31
- **Total PRs merged:** 4
- **Total contributors:** 5 (some overlap)
- **Primary platform:** GitHub (84% of activity)
```
