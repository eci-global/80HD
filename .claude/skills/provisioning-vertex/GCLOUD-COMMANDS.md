# gcloud Commands Reference

This document provides detailed reference for all gcloud commands used by the `/provision-vertex` skill.

## Contents

1. [Check if Project Exists](#1-check-if-project-exists)
2. [Create GCP Project](#2-create-gcp-project)
3. [Link Billing Account](#3-link-billing-account)
4. [Enable Vertex AI API](#4-enable-vertex-ai-api)
5. [Create API Key](#5-create-api-key)
6. [List API Keys](#6-list-api-keys)
7. [Delete API Key](#7-delete-api-key)
8. [List Projects](#8-list-projects)
9. [Describe Project](#9-describe-project)
10. [Check API Status](#10-check-api-status)

---

## 1. Check if Project Exists

**Purpose:** Determine if a project already exists for a business unit (idempotency check)

**Command:**
```bash
gcloud projects list \
  --filter='projectId:*${business_unit}*' \
  --format='value(projectId)'
```

**Parameters:**
- `${business_unit}`: Business unit name (e.g., "marketing", "sales")

**Example:**
```bash
gcloud projects list \
  --filter='projectId:*marketing*' \
  --format='value(projectId)'
```

**Expected Output (if exists):**
```
marketing-ai
```

**Expected Output (if not exists):**
```
(empty/no output)
```

**Parsing Logic:**
```
if output is non-empty:
  → Project exists
if output is empty:
  → Project doesn't exist
```

**Common Errors:**
- None (this is a read-only operation)

**Usage in Skill:**
- Run this FIRST before any provisioning
- Ensures idempotency (don't create duplicates)

---

## 2. Create GCP Project

**Purpose:** Create a new GCP project in the specified folder

**Command:**
```bash
gcloud projects create ${project_id} \
  --folder=${FOLDER_ID} \
  --name="${business_unit}" \
  --labels=business-unit=${business_unit},purpose=vertex-ai
```

**Parameters:**
- `${project_id}`: Project ID (e.g., "marketing-ai")
- `${FOLDER_ID}`: GCP folder ID where project should be created (from environment)
- `${Business Unit}`: Human-readable business unit name (e.g., "Marketing")
- `${business_unit}`: Normalized business unit (e.g., "marketing")

**Environment Variables Required:**
- `GCP_FOLDER_ID`: Folder where projects should be created

**Example:**
```bash
gcloud projects create marketing-ai \
  --folder=123456789 \
  --name="marketing" \
  --labels=business-unit=marketing,purpose=vertex-ai
```

**Expected Output:**
```
Create in progress for [https://cloudresourcemanager.googleapis.com/v1/projects/marketing-ai].
Waiting for [operations/cp.1234567890abcdef] to finish...done.
```

**Timing:**
- Usually completes in 10-30 seconds
- Can take up to 2 minutes

**Common Errors:**

**Error 1: Project ID already exists**
```
ERROR: (gcloud.projects.create) Resource in projects [marketing-ai] is the subject of a conflict: Requested entity already exists
```
**Solution:** This shouldn't happen if existence check was done first. If it does, treat as idempotent and continue.

**Error 2: Permission denied**
```
ERROR: (gcloud.projects.create) User [user@company.com] does not have permission to create projects in folder [123456789].
```
**Solution:** User needs "Project Creator" role on the folder. See TROUBLESHOOTING.md.

**Error 3: Invalid folder ID**
```
ERROR: (gcloud.projects.create) NOT_FOUND: Requested entity was not found.
```
**Solution:** Check that GCP_FOLDER_ID environment variable is set correctly.

**Error 4: Invalid project ID format**
```
ERROR: (gcloud.projects.create) INVALID_ARGUMENT: Request contains an invalid argument.
```
**Solution:** Project IDs must be 6-30 characters, lowercase letters, digits, and hyphens only. Cannot start with a digit.

**Usage in Skill:**
- Only run if existence check returns empty
- Wait for operation to complete before proceeding

---

## 3. Link Billing Account

**Purpose:** Enable billing for the newly created project

**Command:**
```bash
gcloud billing projects link ${project_id} \
  --billing-account=${BILLING_ACCOUNT}
```

**Parameters:**
- `${project_id}`: Project ID (e.g., "marketing-ai")
- `${BILLING_ACCOUNT}`: Billing account ID (from environment)

**Environment Variables Required:**
- `GCP_BILLING_ACCOUNT`: Billing account to link (format: "012345-ABCDEF-678901")

**Example:**
```bash
gcloud billing projects link marketing-ai \
  --billing-account=012345-ABCDEF-678901
```

**Expected Output:**
```
billingAccountName: billingAccounts/012345-ABCDEF-678901
billingEnabled: true
name: projects/marketing-ai/billingInfo
projectId: marketing-ai
```

**Timing:**
- Usually completes instantly (< 5 seconds)

**Common Errors:**

**Error 1: Billing account not found**
```
ERROR: (gcloud.billing.projects.link) INVALID_ARGUMENT: Request contains an invalid argument.
```
**Solution:** Check that GCP_BILLING_ACCOUNT is set correctly. List billing accounts with: `gcloud billing accounts list`

**Error 2: Permission denied**
```
ERROR: (gcloud.billing.projects.link) PERMISSION_DENIED: The caller does not have permission
```
**Solution:** User needs "Billing Account User" role. See TROUBLESHOOTING.md.

**Error 3: Billing account disabled**
```
ERROR: (gcloud.billing.projects.link) FAILED_PRECONDITION: Billing account is closed
```
**Solution:** Contact billing admin to reactivate the billing account.

**Usage in Skill:**
- Run immediately after project creation
- Required before enabling APIs

---

## 4. Enable Vertex AI API

**Purpose:** Enable the Vertex AI API for the project

**Command:**
```bash
gcloud services enable aiplatform.googleapis.com \
  --project=${project_id}
```

**Parameters:**
- `${project_id}`: Project ID (e.g., "marketing-ai")

**Example:**
```bash
gcloud services enable aiplatform.googleapis.com \
  --project=marketing-ai
```

**Expected Output:**
```
Operation "operations/acat.p2-123456789-abcd-1234-5678-90abcdef1234" finished successfully.
```

**Timing:**
- Usually takes 2-5 minutes
- Can occasionally take up to 10 minutes

**Progress Indicator:**
```
Waiting for async operation operations/acat.p2-123456789-abcd-1234-5678-90abcdef1234 to complete...
```

**Common Errors:**

**Error 1: Billing not enabled**
```
ERROR: (gcloud.services.enable) FAILED_PRECONDITION: Billing must be enabled for activation of service
```
**Solution:** Ensure billing was linked in previous step. Check with: `gcloud billing projects describe ${project_id}`

**Error 2: Permission denied**
```
ERROR: (gcloud.services.enable) PERMISSION_DENIED: The caller does not have permission
```
**Solution:** User needs "Service Usage Admin" role. See TROUBLESHOOTING.md.

**Error 3: Timeout**
```
ERROR: (gcloud.services.enable) DEADLINE_EXCEEDED: Deadline exceeded
```
**Solution:** API enablement is still in progress. Check status with: `gcloud services list --enabled --project=${project_id}`

**Usage in Skill:**
- Run after billing is linked
- Wait for operation to complete before creating API keys
- API keys cannot be created until API is fully enabled

---

## 5. Create API Key

**Purpose:** Generate a restricted API key for Vertex AI access

### Master Key (Created with Project)

**Command:**
```bash
gcloud alpha services api-keys create \
  --display-name="${business_unit}-vertex-key-master" \
  --project=${project_id} \
  --api-target=service=aiplatform.googleapis.com \
  --annotations=key-type=master,created-by=${owner_email}
```

**Parameters:**
- `${business_unit}`: Business unit name (e.g., "marketing")
- `${project_id}`: Project ID (e.g., "marketing-ai")
- `${owner_email}`: Email of the person who provisioned the project

**Example:**
```bash
gcloud alpha services api-keys create \
  --display-name="marketing-vertex-key-master" \
  --project=marketing-ai \
  --api-target=service=aiplatform.googleapis.com \
  --annotations=key-type=master,created-by=marketing@company.com
```

**Expected Output:**
```
name: projects/123456789/locations/global/keys/abcd1234-5678-90ef-ghij-klmnopqrstuv
displayName: marketing-vertex-key-master
keyString: AIzaSyD1234567890abcdefghijklmnopqrstuvwxyz
annotations:
  key-type: master
  created-by: marketing@company.com
restrictions:
  apiTargets:
  - service: aiplatform.googleapis.com
```

### User Key (Created Later for Additional Users)

**Command:**
```bash
gcloud alpha services api-keys create \
  --display-name="${business_unit}-vertex-key-${username}" \
  --project=${project_id} \
  --api-target=service=aiplatform.googleapis.com \
  --annotations=key-type=user,user-email=${user_email},username=${username}
```

**Parameters:**
- `${business_unit}`: Business unit name (e.g., "marketing")
- `${project_id}`: Project ID (e.g., "marketing-ai")
- `${user_email}`: Full email address of the user (e.g., "t.dolan@gmail.com")
- `${username}`: Extracted username from email (e.g., "t.dolan")

**Username Extraction Rules:**
- Extract part before `@`
- If `+` exists, extract part before `+`
- Examples:
  - `t.dolan+api1@gmail.com` → `t.dolan`
  - `travis.dolan@gmail.com` → `travis.dolan`

**Example:**
```bash
gcloud alpha services api-keys create \
  --display-name="marketing-vertex-key-t.dolan" \
  --project=marketing-ai \
  --api-target=service=aiplatform.googleapis.com \
  --annotations=key-type=user,user-email=t.dolan@gmail.com,username=t.dolan
```

**Expected Output:**
```
name: projects/123456789/locations/global/keys/wxyz9876-5432-10ab-cdef-klmnopqrstuv
displayName: marketing-vertex-key-t.dolan
keyString: AIzaBCD9876543210zyxwvutsrqponmlkjihgfedcba
annotations:
  key-type: user
  user-email: t.dolan@gmail.com
  username: t.dolan
restrictions:
  apiTargets:
  - service: aiplatform.googleapis.com
```

**Output Parsing:**
```yaml
Extract the following fields:
  - keyString: The actual API key value
  - name: The resource name (for deletion later)
  - displayName: Human-readable name
  - annotations: Key-value pairs for cost tracking
```

**Annotations for Cost Tracking:**
- **Master keys:** Tagged with `key-type=master` and `created-by={owner_email}`
- **User keys:** Tagged with `key-type=user`, `user-email={email}`, `username={username}`
- Use annotations to filter API usage and costs in GCP billing reports
- View annotations: `gcloud alpha services api-keys describe {key_name} --project={project_id}`

**CRITICAL:**
- The `keyString` is only shown ONCE during creation
- It cannot be retrieved later
- Store it securely or in the output for the user
- Truncate to first 10 chars in logs/chat for security

**Timing:**
- Usually completes instantly (< 2 seconds)

**Common Errors:**

**Error 1: API not enabled**
```
ERROR: (gcloud.alpha.services.api-keys.create) FAILED_PRECONDITION: Service aiplatform.googleapis.com is not enabled
```
**Solution:** Wait for API enablement to complete (previous step). Check with: `gcloud services list --enabled --project=${project_id}`

**Error 2: Permission denied**
```
ERROR: (gcloud.alpha.services.api-keys.create) PERMISSION_DENIED: The caller does not have permission
```
**Solution:** User needs "API Keys Admin" role. See TROUBLESHOOTING.md.

**Error 3: Invalid API target**
```
ERROR: (gcloud.alpha.services.api-keys.create) INVALID_ARGUMENT: Invalid API target
```
**Solution:** Ensure the service name is correct: `aiplatform.googleapis.com`

**Usage in Skill:**
- Run after API is fully enabled
- Extract `keyString` from output
- Provide full key in shareable snippet
- Truncate to 10 chars in chat output for security

---

## 6. List API Keys

**Purpose:** List all API keys for a project

**Command:**
```bash
gcloud alpha services api-keys list \
  --project=${project_id} \
  --filter="displayName:*${business_unit}*"
```

**Parameters:**
- `${project_id}`: Project ID (e.g., "marketing-ai")
- `${business_unit}`: Optional filter by business unit name

**Example:**
```bash
gcloud alpha services api-keys list \
  --project=marketing-ai \
  --filter="displayName:*marketing*"
```

**Expected Output:**
```
NAME                                                                      DISPLAY_NAME           CREATE_TIME
projects/123456789/locations/global/keys/abcd1234-5678-90ef-ghij-key1    marketing-vertex-key   2026-01-15T10:35:00.000Z
projects/123456789/locations/global/keys/wxyz9876-5432-10ab-cdef-key2    marketing-vertex-key-2 2026-01-16T14:20:00.000Z
```

**Output Parsing:**
```
Fields returned:
  - NAME: Full resource name (use for deletion)
  - DISPLAY_NAME: Human-readable name
  - CREATE_TIME: When the key was created

NOTE: keyString (the actual key value) is NOT returned for security reasons
```

**Formatted Output:**
```bash
gcloud alpha services api-keys list \
  --project=marketing-ai \
  --format='table(displayName,createTime,restrictions.apiTargets[0].service)'
```

**Usage in Skill:**
- Use to check for existing keys
- Use to find key names for deletion (rotation)
- Cannot retrieve key values (security feature)

---

## 7. Delete API Key

**Purpose:** Delete an API key (for rotation or cleanup)

**Command:**
```bash
gcloud alpha services api-keys delete ${key_name} \
  --project=${project_id}
```

**Parameters:**
- `${key_name}`: Full resource name of the key (from list command)
- `${project_id}`: Project ID (e.g., "marketing-ai")

**Example:**
```bash
gcloud alpha services api-keys delete projects/123456789/locations/global/keys/abcd1234-5678-90ef-ghij-key1 \
  --project=marketing-ai
```

**Expected Output:**
```
Deleted [projects/123456789/locations/global/keys/abcd1234-5678-90ef-ghij-key1].
```

**Confirmation Prompt:**
```
You are about to delete API key [marketing-vertex-key]

Do you want to continue (Y/n)?
```

**To skip prompt (for automation):**
```bash
gcloud alpha services api-keys delete ${key_name} \
  --project=${project_id} \
  --quiet
```

**WARNING:**
- Deletion is IMMEDIATE
- Any systems using this key will stop working
- Confirm with user before deleting production keys

**Usage in Skill:**
- Use during key rotation
- Always ask user for confirmation before deleting
- Provide warning that systems using the key will break

---

## 8. List Projects

**Purpose:** List all Vertex AI projects

**Command:**
```bash
gcloud projects list \
  --filter='labels.purpose=vertex-ai' \
  --format='table(projectId,name,labels.business-unit,createTime)'
```

**Example:**
```bash
gcloud projects list \
  --filter='labels.purpose=vertex-ai' \
  --format='table(projectId,name,labels.business-unit,createTime)'
```

**Expected Output:**
```
PROJECT_ID              NAME                     BUSINESS_UNIT    CREATE_TIME
marketing-ai     Marketing Vertex AI      marketing        2026-01-15T10:30:00.000Z
sales-vertex-ai         Sales Vertex AI          sales            2026-01-16T14:20:00.000Z
engineering-vertex-ai   Engineering Vertex AI    engineering      2026-01-17T09:15:00.000Z
```

**Alternative Formats:**
```bash
# JSON output
gcloud projects list --filter='labels.purpose=vertex-ai' --format=json

# CSV output
gcloud projects list --filter='labels.purpose=vertex-ai' --format=csv

# Just project IDs
gcloud projects list --filter='labels.purpose=vertex-ai' --format='value(projectId)'
```

**Usage in Skill:**
- Use for "list all projects" command
- Filter by `labels.purpose=vertex-ai` to show only Vertex AI projects

---

## 9. Describe Project

**Purpose:** Get detailed information about a project

**Command:**
```bash
gcloud projects describe ${project_id}
```

**Parameters:**
- `${project_id}`: Project ID (e.g., "marketing-ai")

**Example:**
```bash
gcloud projects describe marketing-ai
```

**Expected Output:**
```yaml
createTime: '2026-01-15T10:30:00.000Z'
labels:
  business-unit: marketing
  purpose: vertex-ai
lifecycleState: ACTIVE
name: Marketing Vertex AI
parent:
  id: '123456789'
  type: folder
projectId: marketing-ai
projectNumber: '987654321098'
```

**Output Parsing:**
```yaml
Key fields:
  - projectId: The project ID
  - projectNumber: The project number (used in some API calls)
  - name: Human-readable project name
  - labels: All labels attached to the project
  - lifecycleState: ACTIVE, DELETE_REQUESTED, or DELETE_IN_PROGRESS
  - parent: Folder or organization the project belongs to
  - createTime: When the project was created
```

**Usage in Skill:**
- Use for "get details" command
- Check project state and configuration
- Verify labels are set correctly

---

## 10. Check API Status

**Purpose:** Verify if Vertex AI API is enabled

**Command:**
```bash
gcloud services list \
  --enabled \
  --project=${project_id} \
  --filter='name:aiplatform.googleapis.com' \
  --format='value(name)'
```

**Parameters:**
- `${project_id}`: Project ID (e.g., "marketing-ai")

**Example:**
```bash
gcloud services list \
  --enabled \
  --project=marketing-ai \
  --filter='name:aiplatform.googleapis.com' \
  --format='value(name)'
```

**Expected Output (if enabled):**
```
aiplatform.googleapis.com
```

**Expected Output (if not enabled):**
```
(empty/no output)
```

**Parsing Logic:**
```
if output == "aiplatform.googleapis.com":
  → API is enabled
if output is empty:
  → API is not enabled
```

**Usage in Skill:**
- Use to verify API enablement status
- Use in "get details" command to show API status

---

## Environment Variables Summary

These environment variables must be set before using the skill:

```bash
# Required
export GCP_FOLDER_ID="123456789"                      # Folder ID where projects are created
export GCP_BILLING_ACCOUNT="012345-ABCDEF-678901"    # Billing account to link

# Optional
export VERTEX_AI_REGION="us-east5"                   # Default region (defaults to us-east5)
```

**How to Find These Values:**

**Folder ID:**
```bash
gcloud resource-manager folders list --organization=${ORG_ID}
```

**Billing Account:**
```bash
gcloud billing accounts list
```

---

## Command Execution Tips

**Using run_gcloud_command MCP tool:**
```
Tool: run_gcloud_command
Parameter: command = "gcloud projects list --filter='labels.purpose=vertex-ai'"
Returns: String output of the command
```

**Error Handling:**
- Always check if command failed (non-zero exit code)
- Parse error messages for helpful context
- Provide user with remediation steps
- See TROUBLESHOOTING.md for common errors

**Long-Running Operations:**
- Some commands take minutes (API enablement)
- gcloud CLI waits automatically (synchronous)
- Provide progress updates to user if possible
- Don't timeout too early

**Output Parsing:**
- Use `--format` flag to control output format
- `--format=value(field)` for single field extraction
- `--format=json` for structured parsing
- `--format=table(...)` for human-readable display

---

## Testing Commands Manually

Before implementing the skill, test these commands manually:

```bash
# Set environment variables
export GCP_FOLDER_ID="your-folder-id"
export GCP_BILLING_ACCOUNT="your-billing-account"

# Test project creation
gcloud projects create test-ai \
  --folder=$GCP_FOLDER_ID \
  --name="test" \
  --labels=business-unit=test,purpose=vertex-ai

# Test billing linkage
gcloud billing projects link test-ai \
  --billing-account=$GCP_BILLING_ACCOUNT

# Test API enablement
gcloud services enable aiplatform.googleapis.com \
  --project=test-ai

# Test API key creation
gcloud alpha services api-keys create \
  --display-name="test-vertex-key" \
  --project=test-ai \
  --api-target=service=aiplatform.googleapis.com

# Clean up test project
gcloud projects delete test-ai --quiet
```

**Expected Timeline:**
- Project creation: ~30 seconds
- Billing linkage: ~5 seconds
- API enablement: ~3 minutes
- API key creation: ~2 seconds
- **Total: ~4 minutes per project**
