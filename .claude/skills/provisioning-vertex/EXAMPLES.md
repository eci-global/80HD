# Provision Vertex AI - Examples

This document provides 8 detailed examples of using the `/provisioning-vertex` skill.

## Contents

1. [Basic Provisioning (First Time)](#example-1-basic-provisioning-first-time)
2. [Create API Key Only (Existing Project)](#example-2-create-api-key-only-existing-project)
3. [Idempotent Re-run (Already Exists)](#example-3-idempotent-re-run-already-exists)
4. [List All Projects](#example-4-list-all-projects)
5. [Get Project Details](#example-5-get-project-details)
6. [Rotate API Key](#example-6-rotate-api-key)
7. [Error Handling (Permission Denied)](#example-7-error-handling-permission-denied)
8. [Multiple Business Units](#example-8-multiple-business-units)

---

## Example 1: Basic Provisioning (First Time)

**User Input:**
```
/provision-vertex create project for Marketing, owner: marketing@company.com
```

**Skill Execution Flow:**

### Step 1: Parse Input
```
Extracted parameters:
  business_unit: "marketing"
  owner_email: "marketing@company.com"
  project_id: "marketing-ai"
```

### Step 2: Check Existence
```
Tool: run_gcloud_command
Command: "gcloud projects list --filter='projectId:*marketing*' --format='value(projectId)'"

Output: (empty)

Result: Project doesn't exist, proceed with provisioning
```

### Step 3: Create Project
```
Tool: run_gcloud_command
Command: "gcloud projects create marketing-ai --folder=123456789 --name='marketing' --labels=business-unit=marketing,purpose=vertex-ai"

Output:
Create in progress for [https://cloudresourcemanager.googleapis.com/v1/projects/marketing-ai].
Waiting for [operations/cp.123456789] to finish...done.

Result: ✓ Project created
```

### Step 4: Link Billing
```
Tool: run_gcloud_command
Command: "gcloud billing projects link marketing-ai --billing-account=012345-ABCDEF-678901"

Output:
billingAccountName: billingAccounts/012345-ABCDEF-678901
billingEnabled: true
name: projects/marketing-ai/billingInfo
projectId: marketing-ai

Result: ✓ Billing linked
```

### Step 5: Enable Vertex AI API
```
Tool: run_gcloud_command
Command: "gcloud services enable aiplatform.googleapis.com --project=marketing-ai"

Output:
Operation "operations/acat.p2-123456789-..." finished successfully.

Result: ✓ Vertex AI API enabled (took ~3 minutes)
```

### Step 6: Create Master API Key (with annotations)
```
Tool: run_gcloud_command
Command: "gcloud alpha services api-keys create --display-name='marketing-vertex-key-master' --project=marketing-ai --api-target=service=aiplatform.googleapis.com --annotations=key-type=master,created-by=marketing@company.com"

Output:
name: projects/123456789/locations/global/keys/abcd1234-5678-90ef-ghij-klmnopqrstuv
displayName: marketing-vertex-key-master
keyString: AIzaSyD1234567890abcdefghijklmnopqrstuvwxyz
annotations:
  key-type: master
  created-by: marketing@company.com
restrictions:
  apiTargets:
  - service: aiplatform.googleapis.com

Extracted API Key: AIzaSyD1234567890abcdefghijklmnopqrstuvwxyz

Result: ✓ Master API key created with cost tracking annotations
```

### Step 7: Format Output

**Claude Response to User:**
```markdown
✓ Vertex AI project provisioned for Marketing

**Project ID:** marketing-ai
**Region:** us-east5
**API Key:** AIzaSyD123...

## Quick Setup (copy/paste)
export ANTHROPIC_API_KEY="AIzaSyD1234567890abcdefghijklmnopqrstuvwxyz"
export ANTHROPIC_BASE_URL="https://us-east5-aiplatform.googleapis.com/v1"
export ANTHROPIC_VERTEX_PROJECT_ID="marketing-ai"
export ANTHROPIC_VERTEX_LOCATION="us-east5"

## Available Models
- Claude Sonnet 4.5: claude-sonnet-4-5@20250929
- Claude Opus 4.5: claude-opus-4-5@20251101
- Claude Haiku 4.5: claude-haiku-4-5@20251001

## Test Command
curl -X POST "$ANTHROPIC_BASE_URL/projects/marketing-ai/locations/us-east5/publishers/anthropic/models/claude-sonnet-4-5@20250929:predict" \
  -H "Authorization: Bearer $ANTHROPIC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello, Claude!"}],
    "model": "claude-sonnet-4-5@20250929",
    "max_tokens": 100
  }'

## Need Help?
Full guide: knowledge-base/team/configure-claude-code-vertex-ai.md
```

---

## Example 2: Create API Key Only (Existing Project)

**User Input:**
```
/provisioning-vertex create key for eci-lbmh-spruce
```

**Skill Execution Flow:**

### Step 1: Parse Input
```
Extracted parameters:
  business_unit: "eci-lbmh-spruce"
  project_id: "eci-lbmh-spruce-ai"
  intent: "create_key_only"
```

### Step 2: Verify Project Exists
```
Tool: run_gcloud_command
Command: "gcloud projects describe eci-lbmh-spruce-ai"

Output:
createTime: '2026-01-21T20:00:00.000Z'
labels:
  business-unit: eci-lbmh-spruce
  purpose: vertex-ai
lifecycleState: ACTIVE
name: eci-lbmh-spruce
projectId: eci-lbmh-spruce-ai
projectNumber: '809348686514'

Result: ✓ Project exists, proceed with API key creation
```

### Step 3: Create User-Specific API Key (with annotations)
```
Tool: run_gcloud_command
Command: "gcloud alpha services api-keys create --display-name='eci-lbmh-spruce-vertex-key-t.dolan' --project=eci-lbmh-spruce-ai --api-target=service=aiplatform.googleapis.com --annotations=key-type=user,user-email=t.dolan@gmail.com,username=t.dolan"

Output:
Operation [operations/akmf.p7-809348686514-...] complete. Result: {
    "keyString":"AIzaBCD9876543210zyxwvutsrqponmlkjihgfedcba",
    "displayName":"eci-lbmh-spruce-vertex-key-t.dolan",
    "annotations":{
        "key-type":"user",
        "user-email":"t.dolan@gmail.com",
        "username":"t.dolan"
    },
    "restrictions":{
        "apiTargets":[
            {"service":"aiplatform.googleapis.com"}
        ]
    }
}

Extracted API Key: AIzaBCD9876543210zyxwvutsrqponmlkjihgfedcba

Result: ✓ API key created with user annotations for cost tracking
```

### Step 4: Format Output

**Claude Response to User:**
```markdown
✓ New API key created for eci-lbmh-spruce

**Project ID:** eci-lbmh-spruce-ai
**Region:** us-east5
**API Key:** AIzaBCD987...

## Quick Setup (copy/paste)
export ANTHROPIC_API_KEY="AIzaBCD9876543210zyxwvutsrqponmlkjihgfedcba"
export ANTHROPIC_BASE_URL="https://us-east5-aiplatform.googleapis.com/v1"
export ANTHROPIC_VERTEX_PROJECT_ID="eci-lbmh-spruce-ai"
export ANTHROPIC_VERTEX_LOCATION="us-east5"

## Available Models
- Claude Sonnet 4.5: claude-sonnet-4-5@20250929
- Claude Opus 4.5: claude-opus-4-5@20251101
- Claude Haiku 4.5: claude-haiku-4-5@20251001

## Security Note
⚠️ **Important:** Store this API key securely. It will not be retrievable later.
- Add to `.env` file and ensure `.env` is in `.gitignore`
- Never commit API keys to version control
- Consider using GCP Secret Manager for production

## Need Help?
Full guide: knowledge-base/team/configure-claude-code-vertex-ai.md
```

---

## Example 3: Idempotent Re-run (Already Exists)

**User Input:**
```
/provision-vertex create project for Marketing, owner: marketing@company.com
```

**Skill Execution Flow:**

### Step 1: Parse Input
```
Extracted parameters:
  business_unit: "marketing"
  owner_email: "marketing@company.com"
  project_id: "marketing-ai"
```

### Step 2: Check Existence
```
Tool: run_gcloud_command
Command: "gcloud projects list --filter='projectId:*marketing*' --format='value(projectId)'"

Output:
marketing-ai

Result: Project already exists, skip provisioning
```

### Step 3: Get Project Details
```
Tool: run_gcloud_command
Command: "gcloud projects describe marketing-ai"

Output:
createTime: '2026-01-15T10:30:00.000Z'
labels:
  business-unit: marketing
  purpose: vertex-ai
lifecycleState: ACTIVE
name: marketing
parent:
  id: '123456789'
  type: folder
projectId: marketing-ai
projectNumber: '987654321098'

Result: ✓ Project details retrieved
```

### Step 4: Format Output

**Claude Response to User:**
```markdown
✓ Vertex AI project already exists for Marketing

**Project ID:** marketing-ai

Note: This project was previously provisioned. API keys cannot be retrieved after creation for security reasons.

To create a new API key for another user:
- Run: `/provisioning-vertex create key for marketing, user: yourname@company.com`

## Need Help?
Full guide: knowledge-base/team/configure-claude-code-vertex-ai.md
```

---

## Example 4: List All Projects

**User Input:**
```
/provision-vertex list all projects
```

**Skill Execution Flow:**

### Step 1: List Projects
```
Tool: run_gcloud_command
Command: "gcloud projects list --filter='labels.purpose=vertex-ai' --format='table(projectId,name,labels.business-unit,createTime)'"

Output:
PROJECT_ID         NAME          BUSINESS_UNIT    CREATE_TIME
marketing-ai       marketing     marketing        2026-01-15T10:30:00.000Z
sales-ai           sales         sales            2026-01-16T14:20:00.000Z
engineering-ai     engineering   engineering      2026-01-17T09:15:00.000Z

Result: ✓ 3 Vertex AI projects found
```

### Step 2: Format Output

**Claude Response to User:**
```markdown
## Vertex AI Projects

| Business Unit | Project ID | Created |
|---------------|------------|---------|
| Marketing | marketing-ai | 2026-01-15 |
| Sales | sales-ai | 2026-01-16 |
| Engineering | engineering-ai | 2026-01-17 |

**Total:** 3 projects

To get details on a specific project:
- Run: `/provision-vertex get details for marketing`
```

---

## Example 4: Get Project Details

**User Input:**
```
/provision-vertex get details for marketing
```

**Skill Execution Flow:**

### Step 1: Parse Input
```
Extracted parameters:
  business_unit: "marketing"
  project_id: "marketing-ai"
```

### Step 2: Get Project Details
```
Tool: run_gcloud_command
Command: "gcloud projects describe marketing-ai"

Output:
createTime: '2026-01-15T10:30:00.000Z'
labels:
  business-unit: marketing
  purpose: vertex-ai
lifecycleState: ACTIVE
name: marketing
parent:
  id: '123456789'
  type: folder
projectId: marketing-ai
projectNumber: '987654321098'
```

### Step 3: Check API Status
```
Tool: run_gcloud_command
Command: "gcloud services list --enabled --project=marketing-ai --filter='name:aiplatform.googleapis.com' --format='value(name)'"

Output:
aiplatform.googleapis.com

Result: ✓ Vertex AI API is enabled
```

### Step 4: List API Keys
```
Tool: run_gcloud_command
Command: "gcloud alpha services api-keys list --project=marketing-ai --format='table(displayName,createTime,restrictions.apiTargets[0].service)'"

Output:
DISPLAY_NAME           CREATE_TIME              API_TARGET
marketing-vertex-key   2026-01-15T10:35:00.000Z aiplatform.googleapis.com

Result: ✓ 1 API key found
```

### Step 5: Format Output

**Claude Response to User:**
```markdown
## marketing Project

**Project ID:** marketing-ai
**Project Number:** 987654321098
**Status:** Active
**Created:** 2026-01-15 10:30 UTC

### Configuration
- **Folder ID:** 123456789
- **Labels:** business-unit=marketing, purpose=vertex-ai

### APIs
✓ Vertex AI API (aiplatform.googleapis.com) - Enabled

### API Keys
- marketing-vertex-key (created 2026-01-15)

**Note:** API key values cannot be retrieved after creation for security reasons.
```

---

## Example 5: Rotate API Key

**User Input:**
```
/provision-vertex rotate key for marketing
```

**Skill Execution Flow:**

### Step 1: Parse Input
```
Extracted parameters:
  business_unit: "marketing"
  project_id: "marketing-ai"
```

### Step 2: List Current Keys
```
Tool: run_gcloud_command
Command: "gcloud alpha services api-keys list --project=marketing-ai --format='value(name,displayName)'"

Output:
projects/123456789/locations/global/keys/old-key-id marketing-vertex-key

Result: ✓ Found 1 existing key
```

### Step 3: Create New API Key
```
Tool: run_gcloud_command
Command: "gcloud alpha services api-keys create --display-name='marketing-vertex-key-2' --project=marketing-ai --api-target=service=aiplatform.googleapis.com"

Output:
name: projects/123456789/locations/global/keys/new-key-id
displayName: marketing-vertex-key-2
keyString: AIzaBCD9876543210zyxwvutsrqponmlkjihgfedcba
restrictions:
  apiTargets:
  - service: aiplatform.googleapis.com

Extracted API Key: AIzaBCD9876543210zyxwvutsrqponmlkjihgfedcba

Result: ✓ New API key created
```

### Step 4: Optionally Delete Old Key
```
Ask user: "Do you want to delete the old API key (marketing-vertex-key)? This will invalidate any systems using it."

If user confirms:
  Tool: run_gcloud_command
  Command: "gcloud alpha services api-keys delete projects/123456789/locations/global/keys/old-key-id --project=marketing-ai"

  Output:
  Deleted [projects/123456789/locations/global/keys/old-key-id].

  Result: ✓ Old key deleted
```

### Step 5: Format Output

**Claude Response to User:**
```markdown
✓ New API key created for Marketing

**New API Key:** AIzaBCD987...

## Quick Setup (copy/paste)
export ANTHROPIC_API_KEY="AIzaBCD9876543210zyxwvutsrqponmlkjihgfedcba"
export ANTHROPIC_BASE_URL="https://us-east5-aiplatform.googleapis.com/v1"
export ANTHROPIC_VERTEX_PROJECT_ID="marketing-ai"
export ANTHROPIC_VERTEX_LOCATION="us-east5"

**Important:** Update this key in all systems that use it. The old key has been deleted and will no longer work.
```

---

## Example 6: Error Handling (Permission Denied)

**User Input:**
```
/provision-vertex create project for Marketing
```

**Skill Execution Flow:**

### Step 1: Parse Input
```
Extracted parameters:
  business_unit: "marketing"
  project_id: "marketing-ai"
```

### Step 2: Check Existence
```
Tool: run_gcloud_command
Command: "gcloud projects list --filter='projectId:*marketing*' --format='value(projectId)'"

Output: (empty)

Result: Project doesn't exist, proceed with provisioning
```

### Step 3: Create Project (ERROR)
```
Tool: run_gcloud_command
Command: "gcloud projects create marketing-ai --folder=123456789 --name='marketing'"

Error Output:
ERROR: (gcloud.projects.create) User [user@company.com] does not have permission to create projects in folder [123456789].
- '@type': type.googleapis.com/google.rpc.ErrorInfo
  domain: cloudresourcemanager.googleapis.com
  metadata:
    permission: resourcemanager.projects.create
  reason: IAM_PERMISSION_DENIED

Result: ✗ Permission denied
```

### Step 4: Format Error Response

**Claude Response to User:**
```markdown
✗ Failed to provision Vertex AI project for Marketing

**Error:** Permission denied

Your account (user@company.com) doesn't have permission to create projects in the specified folder.

## How to Fix

**Option 1: Request Permission**
Ask your GCP admin to grant you the "Project Creator" role on folder 123456789:
```bash
gcloud resource-manager folders add-iam-policy-binding 123456789 \
  --member="user:user@company.com" \
  --role="roles/resourcemanager.projectCreator"
```

**Option 2: Use Service Account**
If you're using a service account, ensure it has the required permissions.

## Required Permissions
- resourcemanager.projects.create (on folder)
- billing.resourceAssociations.create (to link billing)
- serviceusage.services.enable (to enable APIs)
- serviceusage.apiKeys.create (to create API keys)

## Need Help?
Full guide: knowledge-base/team/configure-claude-code-vertex-ai.md
Contact: IT Platform Team
```

---

## Example 7: Multiple Business Units

**User Input:**
```
/provision-vertex create projects for Marketing, Sales, and Engineering
```

**Skill Execution Flow:**

### Step 1: Parse Input
```
Extracted parameters:
  business_units: ["marketing", "sales", "engineering"]
```

### Step 2: Confirm with User
```
Ask: "You're about to create 3 Vertex AI projects:
- marketing-ai
- sales-ai
- engineering-ai

This will take approximately 10-15 minutes. Continue?"

User confirms: Yes
```

### Step 3: Provision Each Project

**For Marketing:**
```
[Same steps as Example 1]
Result: ✓ marketing-ai created
```

**For Sales:**
```
[Same steps as Example 1]
Result: ✓ sales-ai created
```

**For Engineering:**
```
[Same steps as Example 1]
Result: ✓ engineering-ai created
```

### Step 4: Format Summary Output

**Claude Response to User:**
```markdown
✓ 3 Vertex AI projects provisioned successfully

## Projects Created

### 1. Marketing
**Project ID:** marketing-ai
**API Key:** AIzaSyD123...

```bash
export ANTHROPIC_API_KEY="AIzaSyD1234567890abcdefghijklmnopqrstuvwxyz"
export ANTHROPIC_BASE_URL="https://us-east5-aiplatform.googleapis.com/v1"
export ANTHROPIC_VERTEX_PROJECT_ID="marketing-ai"
export ANTHROPIC_VERTEX_LOCATION="us-east5"
```

### 2. Sales
**Project ID:** sales-ai
**API Key:** AIzaXYZ456...

```bash
export ANTHROPIC_API_KEY="AIzaXYZ4567890abcdefghijklmnopqrstuvwxyz123"
export ANTHROPIC_BASE_URL="https://us-east5-aiplatform.googleapis.com/v1"
export ANTHROPIC_VERTEX_PROJECT_ID="sales-ai"
export ANTHROPIC_VERTEX_LOCATION="us-east5"
```

### 3. Engineering
**Project ID:** engineering-ai
**API Key:** AIzaABC789...

```bash
export ANTHROPIC_API_KEY="AIzaABC7890abcdefghijklmnopqrstuvwxyz456789"
export ANTHROPIC_BASE_URL="https://us-east5-aiplatform.googleapis.com/v1"
export ANTHROPIC_VERTEX_PROJECT_ID="engineering-ai"
export ANTHROPIC_VERTEX_LOCATION="us-east5"
```

## Next Steps
1. Distribute the setup snippets to each team
2. Teams can test their access using the test commands
3. Configure application environments with these variables

## Available Models (all projects)
- Claude Sonnet 4.5: claude-sonnet-4-5@20250929
- Claude Opus 4.5: claude-opus-4-5@20251101
- Claude Haiku 4.5: claude-haiku-4-5@20251001

## Need Help?
Full guide: knowledge-base/team/configure-claude-code-vertex-ai.md
```

---

## Summary of Examples

| Example | Scenario | Key Learning |
|---------|----------|--------------|
| 1 | Basic Provisioning | Full provisioning flow with shareable snippet |
| 2 | Idempotent Re-run | Safe to re-run, no duplicates created |
| 3 | List All Projects | Query and display all Vertex AI projects |
| 4 | Get Project Details | Detailed view of project configuration |
| 5 | Rotate API Key | Create new key and optionally delete old one |
| 6 | Error Handling | Helpful error messages with remediation steps |
| 7 | Multiple Business Units | Batch provisioning with summary output |

## Testing Checklist

After implementing this skill, test these scenarios:

- [ ] Create a new project (Example 1)
- [ ] Re-run provisioning for existing project (Example 2)
- [ ] List all projects (Example 3)
- [ ] Get details for a specific project (Example 4)
- [ ] Rotate an API key (Example 5)
- [ ] Trigger a permission error (Example 6)
- [ ] Provision multiple projects (Example 7)
