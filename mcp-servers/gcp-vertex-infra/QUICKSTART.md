# Quickstart Guide

Get the GCP Vertex AI Infrastructure MCP Server running in 5 minutes.

## Prerequisites

1. **GCP Setup:**
   - Active Google Cloud organization
   - Billing account configured
   - Vertex AI enabled
   - Service account with appropriate permissions

2. **Local Setup:**
   - Python 3.11+ installed
   - `uv` package manager (`curl -LsSf https://astral.sh/uv/install.sh | sh`)
   - Google Cloud SDK (`gcloud`) installed
   - Supabase project created

## Step 1: Configure Environment

Copy the example environment file and fill in your values:

```bash
cd /Users/tedgar/Projects/80HD/mcp-servers/gcp-vertex-infra
cp .env.example .env
```

Edit `.env` and set:
```bash
GCP_ORGANIZATION_ID=your-org-id
GCP_FOLDER_ID=your-folder-id
GCP_BILLING_ACCOUNT_ID=your-billing-account-id
GCP_DEFAULT_REGION=us-east5
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Step 2: Authenticate with GCP

```bash
# Login to Google Cloud
gcloud auth login

# Set up Application Default Credentials
gcloud auth application-default login
```

## Step 3: Apply Database Migration

```bash
cd /Users/tedgar/Projects/80HD
supabase db push --file infra/supabase/migrations/0013_add_gcp_vertex_projects.sql
```

Or if you're using remote Supabase:
```bash
supabase db push --project-ref your-project-ref
```

## Step 4: Install Dependencies

```bash
cd /Users/tedgar/Projects/80HD/mcp-servers/gcp-vertex-infra
uv sync
```

## Step 5: Restart Claude Code

The MCP server is already registered in `/.mcp.json`. Just restart Claude Code:

```bash
# Exit Claude Code if running
# Then start again
claude
```

## Step 6: Test the Server

In Claude Code chat, try:

```
"Can you check if a Vertex AI project exists for the Marketing team?"
```

Or:

```
"I need to provision a new Vertex AI project for the Sales team. The owner is sales@company.com"
```

The assistant will use the MCP tools to:
1. Check for existing projects
2. Create a new GCP project if needed
3. Enable APIs
4. Generate API keys
5. Store credentials securely
6. Update the knowledge base
7. Return setup instructions

## Verification

Check that it's working:

1. **In Claude Code:** The assistant should respond with project details
2. **In GCP Console:** Navigate to your projects - you should see the new project
3. **In Supabase:** Check the `gcp_vertex_projects` table for the new record
4. **In Knowledge Base:** The markdown file should have a new section for the business unit

## Troubleshooting

### "GCP credentials not found"

Run:
```bash
gcloud auth application-default login
```

### "Supabase connection failed"

Verify your `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`

### "Database migration not applied"

Check Supabase logs and ensure the migration SQL was executed successfully

### "Permission denied in GCP"

Ensure your service account has these roles:
- `roles/resourcemanager.projectCreator`
- `roles/serviceusage.serviceUsageAdmin`
- `roles/apikeys.keyAdmin`

## Next Steps

- Read the full [README.md](./README.md) for detailed documentation
- Explore the [architecture documentation](../../docs/architecture/)
- Set up cost alerts in GCP Console
- Configure quarterly API key rotation

## Getting Help

- Check the audit logs in Supabase for debugging
- Review GCP Console for project creation status
- File an issue in the 80HD repository
- Contact the infrastructure team
