# GCP Vertex AI Infrastructure MCP Server

Model Context Protocol (MCP) server for provisioning and managing Google Cloud Platform Vertex AI projects through natural language.

## Overview

This MCP server enables your personal assistant chatbot to automatically provision GCP projects with Vertex AI access. When you say "I need to enable a new Google project for Marketing to issue AI keys," the chatbot will:

1. Create the GCP project under the proper organization structure
2. Enable Vertex AI and Generative AI APIs
3. Verify Claude model availability
4. Generate and securely store API keys
5. Update the knowledge base with configuration instructions
6. Return ready-to-use setup instructions

## Features

- **Automated Provisioning**: Complete project setup in one natural language request
- **Secure Storage**: API keys encrypted and stored in Supabase
- **Audit Logging**: All operations tracked in audit log
- **Knowledge Base Integration**: Auto-updates documentation with new configurations
- **Idempotent**: Safe to re-run - returns existing setup if already provisioned
- **Multi-Cloud Ready**: Abstracted provider interface for future AWS/Azure support

## Architecture

```
Personal Assistant Chatbot (Claude)
    ↓ (MCP protocol)
GCP Vertex Infra MCP Server (Python + FastMCP)
    ↓ (Google Cloud SDK)
GCP Resource Manager + Vertex AI APIs
    ↓
Supabase (state management + audit trail)
```

## MCP Tools

### `gcp_provision_vertex_ai_project`

Main orchestration tool that handles the complete provisioning workflow.

**Input:**
- `business_unit` (string): Business unit identifier (e.g., "Marketing", "Sales")
- `owner_email` (string): Email of the project owner

**Output:**
```json
{
  "success": true,
  "project_id": "marketing-ai-prod",
  "api_key": "AIza...",
  "setup_instructions": "...",
  "kb_article_updated": true
}
```

### `gcp_check_project_exists`

Check if a project already exists for a business unit.

**Input:**
- `business_unit` (string): Business unit identifier

**Output:**
```json
{
  "exists": true,
  "project_id": "marketing-ai-prod",
  "api_key_active": true
}
```

### `gcp_list_projects`

List all provisioned projects, optionally filtered by business unit.

**Input:**
- `business_unit` (string, optional): Filter by business unit

**Output:**
```json
[
  {
    "project_id": "marketing-ai-prod",
    "business_unit": "Marketing",
    "created_at": "2026-01-17T...",
    "api_key_status": "active",
    "created_by": "user@example.com"
  }
]
```

### `gcp_get_project_details`

Get detailed information about a project including enabled APIs, API keys, and audit logs.

**Input:**
- `project_id` (string): GCP project ID

**Output:**
```json
{
  "gcp": {
    "project_id": "marketing-ai-prod",
    "display_name": "Marketing AI Production",
    "enabled_apis": ["aiplatform.googleapis.com", ...],
    "api_keys": [...]
  },
  "database": {...},
  "recent_activity": [...]
}
```

### `gcp_rotate_api_key`

Rotate the API key for a project (generates new key, revokes old one, updates KB).

**Input:**
- `project_id` (string): GCP project ID
- `performed_by` (string, optional): Email of user performing rotation

**Output:**
```json
{
  "success": true,
  "new_api_key": "AIza...",
  "old_key_revoked": true,
  "kb_updated": true
}
```

## Installation

### Prerequisites

1. **GCP Setup:**
   - Organization with Vertex AI enabled
   - Folder for business unit projects
   - Billing account linked
   - Service account with required permissions:
     - `resourcemanager.projectCreator`
     - `serviceusage.serviceUsageAdmin`
     - `apikeys.keyAdmin`

2. **Supabase:**
   - Project with service role key
   - Database migration applied (see below)

3. **Environment Variables:**
   ```bash
   export GCP_ORGANIZATION_ID="your-org-id"
   export GCP_FOLDER_ID="your-folder-id"
   export GCP_BILLING_ACCOUNT_ID="your-billing-account-id"
   export GCP_DEFAULT_REGION="us-east5"
   export SUPABASE_URL="https://your-project.supabase.co"
   export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   ```

### Install Dependencies

```bash
cd /Users/tedgar/Projects/80HD/mcp-servers/gcp-vertex-infra
uv sync
```

### Apply Database Migration

```bash
cd /Users/tedgar/Projects/80HD
supabase db push --file infra/supabase/migrations/0013_add_gcp_vertex_projects.sql
```

### Register MCP Server

The server is already registered in `/.mcp.json`. Restart Claude Code to load it.

## Usage

### Via Natural Language

Simply ask your assistant:

```
"I need to create a Vertex AI project for the Sales team"
```

The assistant will use the MCP tool to provision everything automatically.

### Direct Tool Call

You can also invoke tools directly:

```python
# Check if project exists
result = await call_tool("gcp_check_project_exists", {
    "business_unit": "Marketing"
})

# Provision new project
result = await call_tool("gcp_provision_vertex_ai_project", {
    "business_unit": "Marketing",
    "owner_email": "marketing@company.com"
})

# Rotate API key
result = await call_tool("gcp_rotate_api_key", {
    "project_id": "marketing-ai-prod",
    "performed_by": "admin@company.com"
})
```

## Project Structure

```
mcp-servers/gcp-vertex-infra/
├── pyproject.toml              # Dependencies and build config
├── README.md                   # This file
└── src/
    └── mcp_gcp_vertex/
        ├── __init__.py
        ├── server.py           # MCP server entrypoint
        ├── config.py           # Pydantic settings
        ├── providers/
        │   ├── base.py         # CloudProvider ABC
        │   └── gcp.py          # GCP implementation
        ├── tools/
        │   ├── provision.py    # Main orchestration
        │   └── api_keys.py     # API key operations
        ├── db/
        │   ├── models.py       # Pydantic models
        │   └── supabase.py     # Supabase client
        └── utils/
            └── kb_updater.py   # Knowledge base modifier
```

## Database Schema

See `/infra/supabase/migrations/0013_add_gcp_vertex_projects.sql` for the complete schema.

**Tables:**
- `gcp_vertex_projects`: Stores project metadata and encrypted API keys
- `gcp_vertex_audit_log`: Tracks all operations for compliance

**Security:**
- Row-level security enabled
- Service role has full access
- Users can view their business unit's projects

## Security Considerations

1. **API Keys:**
   - Stored encrypted in Supabase
   - Never logged in plain text
   - Rotatable via MCP tool
   - Server-side only (no browser restrictions)

2. **Audit Trail:**
   - All operations logged with timestamp and user
   - Immutable audit log
   - Retention policy enforced

3. **Access Control:**
   - GCP service account with least-privilege permissions
   - Supabase RLS policies
   - Environment variable isolation

## Troubleshooting

### "Project creation failed"

- Verify GCP service account has `resourcemanager.projectCreator` permission
- Check billing account is active and linked
- Ensure folder ID is correct

### "API enablement timeout"

- GCP APIs can take 2-5 minutes to fully propagate
- The tool waits up to 5 minutes
- If still failing, check GCP Console for API status

### "Supabase connection failed"

- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Check database migration was applied
- Ensure network connectivity to Supabase

### "Knowledge base update failed"

- Check `KB_PATH` environment variable
- Ensure file exists and is writable
- Provisioning continues even if KB update fails

## Development

### Running Tests

```bash
cd mcp-servers/gcp-vertex-infra
uv run pytest tests/
```

### Manual Testing

```bash
# Start MCP server in stdio mode
uv run mcp-gcp-vertex

# Send MCP requests via stdin (JSON-RPC)
```

### Adding a New Cloud Provider

1. Create new file in `providers/` (e.g., `aws.py`)
2. Implement `CloudProvider` interface
3. Update `server.py` to support provider selection
4. Add provider-specific environment variables to config

## Roadmap

- [ ] Cost automation (budget alerts, Slack notifications)
- [ ] Multi-environment support (dev/staging/prod)
- [ ] AWS Bedrock provider
- [ ] Azure OpenAI provider
- [ ] LiteLLM proxy auto-registration
- [ ] Automatic quarterly key rotation
- [ ] Terraform export for IaC compliance

## Support

For issues or questions:
- File an issue in the main 80HD repository
- Contact the infrastructure team
- Check audit logs in Supabase for debugging

## License

Internal use only - 80HD project.
