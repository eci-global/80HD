---
name: linear
description: Interact with Linear using natural language
---

You have access to the Linear MCP server and GraphQL API. The user will provide natural language instructions after the /linear command.

## Priority Order:
1. **ALWAYS try Linear MCP server FIRST** - for teams, projects, issues, and user data
2. **SKIP MCP and use GraphQL directly** for: initiatives, milestones, externalLinks

## Available Linear MCP Tools:
- `linear_get_teams` - Get all teams
- `linear_get_user` - Get current user info
- `linear_search_projects` - Search projects by exact name
- `linear_get_project` - Get project by ID
- `linear_search_issues` - Search issues by title
- `linear_create_issue` - Create a single issue
- `linear_create_issues` - Create multiple issues
- `linear_delete_issue` - Delete an issue
- `linear_create_project_with_issues` - Create project with issues

## NOT Available in MCP (use GraphQL directly):
- **Initiatives** - No search or retrieval methods in MCP
- **Milestones** - Not returned by MCP project queries
- **Project externalLinks** - Not returned by `linear_get_project`
- **Roadmaps** - No MCP support
- **Project updates** - No MCP support

**Important:** When the user asks about initiatives, skip the MCP search entirely and go directly to the GraphQL API.

## GraphQL Queries:

### Fetch Initiative with Projects:
```json
{"query":"query { initiatives { nodes { id name description targetDate projects { nodes { id name } } } } }"}
```

### Fetch Project with External Links and Milestones:
```json
{"query":"query { project(id: \"PROJECT_ID\") { id name description externalLinks { nodes { id label url } } projectMilestones { nodes { id name description sortOrder targetDate } } } }"}
```

**Execute with:**
```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Authorization: ${LINEAR_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data @/tmp/linear_query.json
```

**Note:** The Linear API token is configured in `.mcp.json` as `LINEAR_ACCESS_TOKEN`.

## Examples:

User: /linear list projects
You: [Use linear_get_teams first, then search for projects]

User: /linear show initiative "GitOps"
You: [Use GraphQL to fetch initiatives, find matching one, display details]

User: /linear show project "GitOps Reference Architecture" including milestones
You:
1. Use `linear_search_projects` to find the project
2. Use GraphQL to fetch externalLinks and projectMilestones (MCP gap)
3. Display complete project details
