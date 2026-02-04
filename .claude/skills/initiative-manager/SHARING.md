# Multi-Platform Sharing Guide

**Purpose:** Expand reach for initiative deliverables across additional collaboration channels.

This guide covers manual steps for sharing to platforms not covered by automated sync (MS Teams, GitHub Discussions).

## Phase 1: Expand Sharing (Manual Steps)

### Task 1: Create CCoE MS Teams Channel

**Platform:** Microsoft Teams (manual via UI - no MCP available)

**Steps:**

1. **Open MS Teams** and navigate to the CCoE team or create a new team

2. **Create a new channel:**
   - Click "..." next to team name → "Add channel"
   - Name: `CCoE GitOps` or `CCoE-Platform-Enablement`
   - Description: "Announcements, feedback, and decision discussions for GitOps initiative"
   - Privacy: Standard (accessible to all team members)

3. **Add key stakeholders:**
   - @mention relevant stakeholders in first post
   - Pin the channel for visibility

4. **Post announcement:**

```
📋 GitOps Outcomes Checklist v0.1 - Ready for Review

We've drafted the tool-agnostic outcomes framework for CCoE review.

📄 Confluence: [Outcomes Checklist](https://eci-solutions.atlassian.net/wiki/spaces/CGIP/pages/XXXX)
💬 Feedback: Comment on the page or join GitHub Discussion
📅 Review deadline: Feb 10, 2026

This checklist defines what "good GitOps" looks like regardless of platform (GitHub, ADO, GitLab).

Key sections:
• Operational outcomes (reliable deployments, traceability)
• Security & compliance (SSO, branch protection, audit trails)
• Change management (peer review, testing, transparency)
• Cost efficiency (economic justification, avoid sprawl)

Questions? Reply here or @mention Travis Edgar
```

5. **Set follow-up reminder:**
   - Calendar event at Feb 7 to check for responses
   - Prepare summary of feedback received

### Task 2: Create GitHub Discussion

**Platform:** GitHub Discussions (via `gh` CLI - no MCP available)

**Prerequisites:**
- Discussions must be enabled on the repository
- If not enabled: Repo Settings → Features → Discussions → Enable

**Command:**

```bash
# Check if discussions are enabled
gh repo view eci-global/gitops --json hasDiscussionsEnabled

# Create discussion (requires category - usually "Ideas" or "General")
gh discussion create \
  --repo eci-global/gitops \
  --title "RFC: GitOps Outcomes Checklist v0.1 - Feedback Welcome" \
  --body "$(cat <<'EOF'
## Summary

We've drafted a tool-agnostic GitOps Outcomes Checklist for CCoE review. This defines what "good GitOps" looks like regardless of which platform teams use (GitHub, Azure DevOps, GitLab).

## Documents

- **Confluence (for comments):** [Outcomes Checklist Draft](https://eci-solutions.atlassian.net/wiki/spaces/CGIP/pages/XXXX)
- **JIRA (for tracking):** [ITPLAT01-1749](https://eci-solutions.atlassian.net/browse/ITPLAT01-1749)

## Key Outcome Categories

1. **Operational Outcomes** - Reliable deployments, environment separation, traceability
2. **Security & Compliance** - SSO, branch protection, audit trails
3. **Change Management** - Peer review, testing, transparency
4. **Cost Efficiency** - Economic justification, avoid sprawl

## How to Provide Feedback

- **Comment on this discussion** for general feedback
- **Comment on Confluence page** for specific section feedback
- **Review deadline:** Feb 10, 2026

## Questions

What aspects of GitOps outcomes are most important to your team?
Are there outcomes we should add or clarify?

---

cc @tedgar
EOF
)" \
  --category "Ideas"

# Pin the discussion (if you have permissions)
# Note: gh CLI doesn't support pinning - do via GitHub UI
```

**After creation:**
1. Copy the discussion URL
2. Pin the discussion in the repo (GitHub UI: Discussion → "..." → Pin)
3. Add link to Teams announcement
4. Add link to Confluence parent page

### Task 3: Update Linear Initiative

**Platform:** Linear (via MCP or GraphQL)

**Add status comment to initiative:**

```graphql
mutation {
  commentCreate(input: {
    issueId: "3617f995-d28f-487e-85e4-c1ccd2d03360"
    body: "📋 **Status Update (2026-02-03)**\n\nOutcomes Checklist v0.1 draft complete. Posted for async review:\n- Confluence: [Draft page](link)\n- GitHub Discussion: [RFC thread](link)\n- MS Teams: #CCoE-GitOps channel\n\nAwaiting CCoE feedback by Feb 10, 2026."
  }) { success }
}
```

**Or via Linear UI:**
1. Open initiative page
2. Add comment with status update
3. Link to all sharing locations

## Announcement Template

Use this template when announcing to additional channels:

```markdown
# [Title] - Ready for Review

[Brief description of what's being shared]

## Links
- 📄 **Confluence:** [Page Name](url) - Comment here for detailed feedback
- 💬 **GitHub Discussion:** [RFC Thread](url) - General discussion
- 📊 **JIRA:** [ITPLAT01-XXXX](url) - Task tracking

## Key Points
- [Bullet 1]
- [Bullet 2]
- [Bullet 3]

## How to Provide Feedback
1. Comment on Confluence for section-specific feedback
2. Reply to GitHub Discussion for general questions
3. @mention [owner] for urgent items

## Timeline
- **Review deadline:** [Date]
- **Expected publish date:** [Date]

Questions? Contact @[owner]
```

## Verification Checklist

After completing Phase 1 manual tasks:

- [ ] MS Teams channel created: `CCoE GitOps` or similar
- [ ] Announcement posted with all links
- [ ] GitHub Discussion created and pinned
- [ ] Linear initiative updated with status
- [ ] All links cross-referenced (each location links to others)
- [ ] Review deadline communicated (Feb 10)
- [ ] Follow-up reminder set (Feb 7)

## Next Steps

Once Phase 1 is complete, use `/sync-linear-jira discover GitOps --comments` to monitor feedback across all platforms from a single view.

See [FEEDBACK.md](FEEDBACK.md) for the comment aggregation workflow.
