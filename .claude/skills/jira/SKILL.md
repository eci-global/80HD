---
name: jira
description: Interact with JIRA using natural language
---

You have access to the Atlassian MCP server. The user will provide natural language instructions after the /jira command.

Parse the user's instruction and use the appropriate Atlassian MCP tools:
- jql_search - Search issues with JQL
- get_issue - Get issue by key
- jira_list_projects - List JIRA projects
- jira_list_components - List components for a project

Example:
User: /jira list epics in project ENG
You: [Use jql_search with JQL: "project = ENG AND type = Epic"]

User: /jira show epic ENG-142
You: [Use get_issue with key="ENG-142"]
