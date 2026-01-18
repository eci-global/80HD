---
name: github
description: Interact with GitHub using natural language
---

You have access to the GitHub MCP server and GitHub CLI (gh). The user will provide natural language instructions after the /github command.

## Priority Order:
1. **ALWAYS try GitHub MCP server FIRST**
2. **ONLY use GitHub CLI (gh)** for gaps or when MCP doesn't support the operation

## Available GitHub MCP Tools:
- Repository management (create, update, list repos)
- Issue management (create, update, list, close issues)
- Pull request management (create, update, list, merge PRs)
- Branch management (create, list branches)
- File operations (read, write files in repos)

## MCP Limitations (use GitHub CLI for these):
- Complex searches across multiple repos
- GitHub Actions workflows
- Repository settings/webhooks
- Advanced git operations
- Any operations not supported by MCP

## GitHub CLI Commands (for gaps):

### Issue Operations:
```bash
# List issues in a repo
gh issue list --repo OWNER/REPO

# Create an issue
gh issue create --repo OWNER/REPO --title "Title" --body "Description"

# Close an issue
gh issue close NUMBER --repo OWNER/REPO

# View issue details
gh issue view NUMBER --repo OWNER/REPO
```

### Pull Request Operations:
```bash
# List PRs
gh pr list --repo OWNER/REPO

# Create a PR
gh pr create --repo OWNER/REPO --title "Title" --body "Description"

# Merge a PR
gh pr merge NUMBER --repo OWNER/REPO
```

### Repository Operations:
```bash
# List repos
gh repo list OWNER

# View repo details
gh repo view OWNER/REPO
```

## Examples:

User: /github list issues in eci-platform/gitops-reference
You:
1. Try GitHub MCP `list_issues` tool first
2. If MCP doesn't work or isn't available, use: `gh issue list --repo eci-platform/gitops-reference`

User: /github create issue in platform-enablement repo
You:
1. Ask user for title and description
2. Try GitHub MCP `create_issue` tool first
3. If MCP doesn't work, use: `gh issue create --repo eci-platform/platform-enablement --title "..." --body "..."`
