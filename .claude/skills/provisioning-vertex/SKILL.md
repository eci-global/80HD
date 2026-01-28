---
name: provisioning-vertex
description: Provisions GCP Vertex AI projects for business units with dead simple setup. Use when users need to create or manage Vertex AI projects with API keys and environment configuration.
---

You have access to the official Google Cloud MCP server (`gcloud`) which provides the `run_gcloud_command` tool. Use this skill when users want to provision GCP Vertex AI projects for business units or teams.

## Contents

- [Overview](#overview) - What this skill does
- [User Experience](#user-experience) - Dead simple provisioning
- [Natural Language Parsing](#natural-language-parsing) - Extract parameters from user input
- [Workflow](#workflow) - Step-by-step provisioning process
- [Output Format](#output-format) - Minimal, shareable results
- [MCP Tool Usage](#mcp-tool-usage) - How to use run_gcloud_command
- [Critical Rules](#critical-rules) - Security and idempotency
- [Configuration](#configuration) - Required environment variables
- [Commands Reference](GCLOUD-COMMANDS.md) - Detailed gcloud command reference
- [Security](SECURITY.md) - API key safety and best practices
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues and solutions
- [Examples](EXAMPLES.md) - 7 detailed provisioning scenarios

## Overview

This skill provisions GCP Vertex AI projects with:
- Automatic project creation in the correct folder
- Billing account linkage
- Vertex AI API enablement
- Restricted API key generation
- Ready-to-use environment configuration

**Before this skill:**
- Users read 460-line technical documentation
- Manual multi-step GCP Console setup
- Understanding of GCP projects, IAM, ADC, environment variables required

**After this skill:**
```
User: /provision-vertex create project for Marketing, owner: marketing@company.com

Claude: ✓ Vertex AI project provisioned for Marketing

[Shareable setup snippet - copy/paste ready]
```

## User Experience

**Design Principles:**
- **Dead simple** - One command, fully automated
- **Minimal output** - Only essential information
- **Shareable snippets** - Copy/paste ready environment setup
- **Idempotent** - Safe to re-run, no duplicates
- **Secure by default** - API keys truncated, never committed

## Natural Language Parsing

Extract these parameters from user input:

**Business Unit (required):**
- Pattern: "for [business-unit]" or "[business-unit] project"
- Normalize: lowercase with hyphens (e.g., "Marketing Team" → "marketing-team")
- Example: "create project for Sales Engineering" → business_unit="sales-engineering"

**Owner Email (optional):**
- Pattern: "owner: [email]" or any email address in the input
- Used for: Documentation and audit trail
- Example: "owner: marketing@company.com" → owner_email="marketing@company.com"

**Project ID Generation:**
- Format: `{business_unit}-ai`
- Example: "eci-lbmh-spruce" → "eci-lbmh-spruce-ai"
- Example: "marketing" → "marketing-ai"

**Fallback Behavior:**
- If business unit missing: Ask user "Which business unit is this project for?"
- If owner missing: Proceed without owner (not required)

## Workflow

**Use Cases:**
1. **Create new project** - Full provisioning with project, billing, API, and key
2. **Create API key only** - Generate new key for existing project
3. **Interactive selection** - Show existing AI projects, let user choose

**High-Level Steps (New Project):**
1. Parse user input → Extract business_unit, owner_email
2. List existing AI projects (show user what already exists)
3. Check if specific project already exists
4. If exists → Ask if user wants new API key or new project
5. If not exists → Provision new project
6. Format minimal output with shareable snippet

**High-Level Steps (API Key Only):**
1. Parse user input → Extract business_unit or project_id
2. Verify project exists
3. Create new API key for that project
4. Format output with shareable snippet

**Detailed Provisioning Flow:**

### Step 0: List Existing AI Projects (Optional but Recommended)
```
Command: run_gcloud_command("gcloud projects list --filter='labels.purpose=vertex-ai' --format='table(projectId,name,createTime)'")

Show user existing AI projects to help them decide:
  - Use existing project (create new API key)
  - Create new project

If user wants to use existing, skip to "Create API Key Only" workflow
```

### Step 1: Parse Input
```
User input: "create project for eci-lbmh-spruce, owner: tedgar@ecisolutions.com"
Extract:
  business_unit = "eci-lbmh-spruce"
  owner_email = "tedgar@ecisolutions.com"
  project_id = "eci-lbmh-spruce-ai"
  project_name = "eci-lbmh-spruce"
```

### Step 2: Check Existence (Idempotency)
```
Command: run_gcloud_command("gcloud projects list --filter='projectId:{project_id}' --format='value(projectId)'")

Example: run_gcloud_command("gcloud projects list --filter='projectId:eci-lbmh-spruce-ai' --format='value(projectId)'")

If output contains project_id:
  → Project exists, ask user if they want:
     A) Create new API key for existing project
     B) Choose different name
If output is empty:
  → Project doesn't exist, continue to Step 3
```

### Step 3: Create GCP Project
```
# If folder ID is set
Command: run_gcloud_command("gcloud projects create {project_id} --folder={FOLDER_ID} --name='{project_name}' --labels=business-unit={business_unit},purpose=vertex-ai")

# If folder ID is NOT set (top-level project - typical)
Command: run_gcloud_command("gcloud projects create {project_id} --name='{project_name}' --labels=business-unit={business_unit},purpose=vertex-ai")

Example: run_gcloud_command("gcloud projects create eci-lbmh-spruce-ai --name='eci-lbmh-spruce' --labels=business-unit=eci-lbmh-spruce,purpose=vertex-ai")

Environment variables:
  - GCP_BILLING_ACCOUNT: Billing account to link (required)
  - GCP_FOLDER_ID: Folder where projects should be created (optional)

Wait for project creation to complete.
```

### Step 4: Link Billing Account
```
Command: run_gcloud_command("gcloud billing projects link {project_id} --billing-account={BILLING_ACCOUNT}")

Wait for billing linkage to complete.
```

### Step 5: Enable Vertex AI API
```
Command: run_gcloud_command("gcloud services enable aiplatform.googleapis.com --project={project_id}")

This may take 2-5 minutes. Wait for enablement to complete.
```

### Step 6: Grant Owner Access to Project (if owner_email provided)
```
If owner_email is provided:
  Command: run_gcloud_command("gcloud projects add-iam-policy-binding {project_id} --member=user:{owner_email} --role=roles/aiplatform.admin")

  Example: run_gcloud_command("gcloud projects add-iam-policy-binding eci-lbmh-spruce-ai --member=user:tedgar@ecisolutions.com --role=roles/aiplatform.admin")

  Purpose:
    - Grants the project owner "Vertex AI Administrator" role (full access)
    - Allows them to manage the project, create additional API keys, etc.
    - They can authenticate with "gcloud auth application-default login"

If owner_email is not provided:
  → Skip this step, continue to Step 7
```

### Step 7: Create Master API Key (with annotations for cost tracking)
```
Command: run_gcloud_command("gcloud alpha services api-keys create --display-name='{business_unit}-vertex-key-master' --project={project_id} --api-target=service=aiplatform.googleapis.com --annotations=key-type=master,created-by={owner_email}")

Example: run_gcloud_command("gcloud alpha services api-keys create --display-name='eci-lbmh-spruce-vertex-key-master' --project=eci-lbmh-spruce-ai --api-target=service=aiplatform.googleapis.com --annotations=key-type=master,created-by=tedgar@ecisolutions.com")

Annotations for cost tracking:
  - key-type=master (identifies this as the master/project key)
  - created-by={owner_email} (who provisioned the project)

IMPORTANT: This API key is for COST TRACKING only, NOT authentication.
  - Users authenticate with "gcloud auth application-default login" using their own credentials
  - The API key allows us to track which requests are generating costs
  - This is the "master" key for the project

Parse output to extract:
  - keyString: The actual API key value (CRITICAL: handle securely)

Store API key for output (but truncate in logs/chat).
```

### Step 8: Format Output
```
Generate minimal output with:
  - Success message
  - Project ID
  - Region (default: us-east5)
  - API key (truncated to first 10 chars in output)
  - Shareable environment setup snippet
  - Link to full documentation

Return to user.
```

---

## Create API Key Only (Existing Project)

**Use Case:** Another user needs access to an existing AI project, or rotating keys.

**Trigger Patterns:**
- "create key for eci-lbmh-spruce"
- "generate api key for eci-lbmh-spruce-ai"
- "new key for existing project eci-lbmh-spruce"
- "create key for eci-lbmh-spruce, user: t.dolan@gmail.com"

**Workflow:**

### Step 1: Parse Input & Extract User Email (REQUIRED)
```
User input: "create key for eci-lbmh-spruce, user: t.dolan@gmail.com"
Extract:
  business_unit = "eci-lbmh-spruce"
  project_id = "eci-lbmh-spruce-ai"
  user_email = "t.dolan@gmail.com"
  username = "t.dolan" (extracted from email before @ or +)

Email parsing rules:
  - "t.dolan+api1@gmail.com" → username = "t.dolan"
  - "travis.dolan@gmail.com" → username = "travis.dolan"
  - Extract part before @ (or before + if present)

CRITICAL: Email is REQUIRED, not optional
If user_email not provided in input:
  → Ask user: "What is the email address for this user? This is required to grant them access to the project."
  → Wait for user response
  → Extract username from provided email
  → Validate email format (contains @ and domain)
```

### Step 2: Verify Project Exists
```
Command: run_gcloud_command("gcloud projects describe {project_id}")

If error:
  → Project doesn't exist, show list of available AI projects
If success:
  → Continue to Step 3
```

### Step 3: Grant User Access to Project (IAM Policy Binding)
```
Command: run_gcloud_command("gcloud projects add-iam-policy-binding {project_id} --member=user:{user_email} --role=roles/aiplatform.user")

Example: run_gcloud_command("gcloud projects add-iam-policy-binding eci-lbmh-spruce-ai --member=user:t.dolan@gmail.com --role=roles/aiplatform.user")

Purpose:
  - Grants the user "Vertex AI User" role (roles/aiplatform.user)
  - This allows them to authenticate with "gcloud auth application-default login"
  - Provides the aiplatform.endpoints.predict permission needed to call Vertex AI endpoints
  - User can now use Claude through Vertex AI with their own credentials

Wait for IAM policy update to complete.
```

### Step 4: Create User-Specific API Key (with annotations for cost tracking)
```
Command: run_gcloud_command("gcloud alpha services api-keys create --display-name='{business_unit}-vertex-key-{username}' --project={project_id} --api-target=service=aiplatform.googleapis.com --annotations=key-type=user,user-email={user_email},username={username}")

Example: run_gcloud_command("gcloud alpha services api-keys create --display-name='eci-lbmh-spruce-vertex-key-t.dolan' --project=eci-lbmh-spruce-ai --api-target=service=aiplatform.googleapis.com --annotations=key-type=user,user-email=t.dolan@gmail.com,username=t.dolan")

Annotations for cost tracking:
  - key-type=user (identifies this as a user-specific key, not master)
  - user-email={user_email} (full email for reference)
  - username={username} (short identifier for display/reporting)

IMPORTANT: This API key is for COST TRACKING only, NOT authentication.
  - User authenticates with "gcloud auth application-default login" using their own credentials
  - The API key allows us to track which user's requests are generating costs
  - GCP bills by API key usage, so this helps with cost attribution

Parse output to extract keyString
```

### Step 5: Format Output
```
Return shareable snippet with new API key for existing project.
Include user information in output.
```

---

## Output Format

**Minimal Output Template (New Project):**
```markdown
✓ Vertex AI project provisioned for [Business Unit]

**Project ID:** {project_id}
**Region:** us-east5
**Owner:** {owner_email} (Vertex AI Administrator role granted)

## Setup Instructions for {owner_email}

### Step 1: Authenticate with Google Cloud

You now have administrator access to the project. Authenticate using your Google account:

```bash
# Authenticate with your Google Cloud credentials
gcloud auth application-default login

# Set the active project
gcloud config set project {project_id}

# Set the quota project to match (avoids quota warnings)
gcloud auth application-default set-quota-project {project_id}

# Verify you're authenticated
gcloud auth list
```

### Step 2: Configure Claude Code

Add to your `~/.zshrc` or `~/.bashrc`:

```bash
# Enable Vertex AI for Claude Code
export CLAUDE_CODE_USE_VERTEX=1
export CLOUD_ML_REGION=us-east5
export ANTHROPIC_VERTEX_PROJECT_ID="{project_id}"

# Optional: Override region for specific models when using CLOUD_ML_REGION=global
# export VERTEX_REGION_CLAUDE_3_5_HAIKU=us-east5
```

Then reload your shell:
```bash
source ~/.zshrc  # or source ~/.bashrc
```

### Step 3: Test Claude Code

```bash
claude-code "Say hello and confirm you're using Vertex AI"
```

## Available Models
- Claude Sonnet 4.5: claude-sonnet-4-5@20250929
- Claude Opus 4.5: claude-opus-4-5@20251101
- Claude Haiku 4.5: claude-haiku-4-5@20251001

## Grant Access to Other Users

To give other users access to this project:
```bash
/provision-vertex create key for {project_id}, user: their-email@company.com
```

## How Authentication Works
- You authenticate as **yourself** using `gcloud auth application-default login`
- Your Google account ({owner_email}) has the "Vertex AI Administrator" role on this project
- Claude Code uses your credentials automatically via Application Default Credentials (ADC)
- No API keys needed for authentication

## Need Help?
- Claude Code Vertex AI docs: https://code.claude.com/docs/en/google-vertex-ai
- Full setup guide: knowledge-base/team/configure-claude-code-vertex-ai.md
```

**For Existing Projects (new user access granted):**
```markdown
✓ Vertex AI access granted for {user_email}

**Project ID:** {project_id}
**Region:** us-east5
**IAM Role:** Vertex AI User (roles/aiplatform.user)

## Setup Instructions for {username}

### Step 1: Authenticate with Google Cloud

You now have access to the project. Authenticate using your Google account:

```bash
# Authenticate with your Google Cloud credentials
gcloud auth application-default login

# Set the active project
gcloud config set project {project_id}

# Set the quota project to match (avoids quota warnings)
gcloud auth application-default set-quota-project {project_id}

# Verify you're authenticated
gcloud auth list
```

### Step 2: Configure Claude Code

Add to your `~/.zshrc` or `~/.bashrc`:

```bash
# Enable Vertex AI for Claude Code
export CLAUDE_CODE_USE_VERTEX=1
export CLOUD_ML_REGION=us-east5
export ANTHROPIC_VERTEX_PROJECT_ID="{project_id}"

# Optional: Override region for specific models when using CLOUD_ML_REGION=global
# export VERTEX_REGION_CLAUDE_3_5_HAIKU=us-east5
```

Then reload your shell:
```bash
source ~/.zshrc  # or source ~/.bashrc
```

### Step 3: Test Claude Code

```bash
claude-code "Say hello and confirm you're using Vertex AI"
```

## Available Models
- Claude Sonnet 4.5: claude-sonnet-4-5@20250929
- Claude Opus 4.5: claude-opus-4-5@20251101
- Claude Haiku 4.5: claude-haiku-4-5@20251001

## How Authentication Works
- You authenticate as **yourself** using `gcloud auth application-default login`
- Your Google account ({user_email}) now has the "Vertex AI User" role on project {project_id}
- This role includes the `aiplatform.endpoints.predict` permission needed to call Vertex AI endpoints
- Claude Code uses your credentials automatically via Application Default Credentials (ADC)

## Need Help?
- Claude Code Vertex AI docs: https://code.claude.com/docs/en/google-vertex-ai
- Full setup guide: knowledge-base/team/configure-claude-code-vertex-ai.md
```

## MCP Tool Usage

**Available Tool:**
- `run_gcloud_command` (from gcloud MCP server)

**Tool Signature:**
```
run_gcloud_command(command: string) -> string
```

**Usage Pattern:**
```
Use: run_gcloud_command
With: command = "gcloud projects list --filter='projectId:*marketing*'"
Returns: Command output as string
```

**Example:**
```
Tool call:
  run_gcloud_command("gcloud projects create marketing-vertex-ai --folder=123456789 --name='Marketing Vertex AI'")

Expected output:
  Create in progress for [https://cloudresourcemanager.googleapis.com/v1/projects/marketing-vertex-ai].
  Waiting for [operations/cp.12345...] to finish...done.
```

**Error Handling:**
- If command fails, parse error message
- Provide helpful context to user
- Common errors: Permission denied, resource already exists, quota exceeded
- See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed error handling

## API Key Annotations (Cost Tracking)

**Purpose:** Track API usage and costs by user for billing/chargeback.

**Annotation Strategy:**

**Master Key (created with project):**
```
Annotations:
  - key-type=master
  - created-by={owner_email}

Display Name: {business_unit}-vertex-key-master
Example: eci-lbmh-spruce-vertex-key-master
```

**User Keys (created later):**
```
Annotations:
  - key-type=user
  - user-email={user_email}
  - username={username}

Display Name: {business_unit}-vertex-key-{username}
Example: eci-lbmh-spruce-vertex-key-t.dolan
```

**Cost Reporting:**
GCP API usage is tracked by API key. Annotations allow you to:
- Filter API metrics by `key-type` (master vs user)
- Group costs by `username` for chargeback
- Identify which user owns each key via `user-email`

**Viewing Annotations:**
```bash
gcloud alpha services api-keys describe {key_name} --project={project_id}
```

---

## Critical Rules

**Security:**
- ✓ ALWAYS truncate API keys in chat output (first 10 chars only)
- ✓ NEVER log full API keys in any output visible to user
- ✓ ALWAYS provide full API key in shareable snippet (user copies it once)
- ✓ NEVER commit API keys to version control (skill can't prevent this, but warn user)

**Idempotency:**
- ✓ ALWAYS check if project exists before creating
- ✓ NEVER create duplicate projects
- ✓ If project exists, return "already exists" message
- ✓ Safe to re-run command multiple times

**Output:**
- ✓ ALWAYS provide minimal output (not overwhelming)
- ✓ ALWAYS include shareable snippet (copy/paste ready)
- ✓ ALWAYS link to full documentation for details
- ✓ NEVER include unnecessary technical details in main output

**API Keys:**
- ✓ API keys cannot be retrieved after creation (GCP security)
- ✓ Store in database or secure vault if needed for future retrieval (future enhancement)
- ✓ For existing projects, offer key rotation instead of retrieval

## Configuration

**Required Environment Variables:**

```bash
# Required
export GCP_BILLING_ACCOUNT="012345-ABCDEF-678901"  # Billing account to link

# Optional
export GCP_FOLDER_ID="123456789"           # Folder where projects should be created (optional - omit to create top-level projects)
export VERTEX_AI_REGION="us-east5"         # Default region (optional - defaults to us-east5)
```

**Where to set these:**
- In `.env` file (add to `.gitignore`)
- In shell profile (`~/.bashrc`, `~/.zshrc`)
- In CI/CD environment variables

**How skill uses these:**
```
When provisioning:
  - Use $GCP_BILLING_ACCOUNT for --billing-account parameter (required)
  - Use $GCP_FOLDER_ID for --folder parameter (optional - if not set, creates top-level project)
  - Use $VERTEX_AI_REGION (optional - defaults to us-east5)
```

**Folder vs. Top-Level Projects:**
```
With folder (organized):
  - Projects grouped under folder
  - Easier permission management
  - Can apply policies at folder level

Without folder (simpler):
  - Projects created at top level
  - Simpler setup
  - Fine for testing or smaller deployments
```

**Validation:**
Before running provisioning commands, check if environment variables are set:
```bash
if [[ -z "$GCP_BILLING_ACCOUNT" ]]; then
  echo "Error: GCP_BILLING_ACCOUNT environment variable not set"
  echo "Set it with: export GCP_BILLING_ACCOUNT='012345-ABCDEF-678901'"
  exit 1
fi

# Folder ID is optional
if [[ -n "$GCP_FOLDER_ID" ]]; then
  echo "Will create project in folder: $GCP_FOLDER_ID"
else
  echo "Will create top-level project (no folder)"
fi
```

## Prerequisites

**User must have:**
- ✓ gcloud CLI installed (`gcloud --version`)
- ✓ Authenticated with GCP (`gcloud auth login`)
- ✓ Application Default Credentials set (`gcloud auth application-default login`)
- ✓ Appropriate GCP permissions:
  - Project Creator (on folder)
  - Billing Account User
  - Service Usage Admin (to enable APIs)
  - API Keys Admin (to create API keys)

**Check before provisioning:**
```bash
# Check gcloud is installed
run_gcloud_command("gcloud --version")

# Check authenticated user
run_gcloud_command("gcloud auth list")
```

If not authenticated or missing permissions, provide helpful error message pointing to setup documentation.

## Further Reading

- [GCLOUD-COMMANDS.md](GCLOUD-COMMANDS.md) - Detailed gcloud command reference
- [EXAMPLES.md](EXAMPLES.md) - 7 provisioning scenarios with step-by-step flows
- [SECURITY.md](SECURITY.md) - API key safety and best practices
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues and solutions
- `knowledge-base/team/configure-claude-code-vertex-ai.md` - Full manual setup guide
