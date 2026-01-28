# Troubleshooting Guide

This document covers common issues when using the `/provision-vertex` skill and how to resolve them.

## Contents

1. [gcloud CLI Issues](#gcloud-cli-issues)
2. [Authentication Errors](#authentication-errors)
3. [Permission Denied Errors](#permission-denied-errors)
4. [Project Creation Failures](#project-creation-failures)
5. [Billing Account Issues](#billing-account-issues)
6. [API Enablement Timeouts](#api-enablement-timeouts)
7. [API Key Creation Failures](#api-key-creation-failures)
8. [Quota and Rate Limits](#quota-and-rate-limits)
9. [Environment Variable Issues](#environment-variable-issues)
10. [When to Escalate](#when-to-escalate)

---

## gcloud CLI Issues

### Issue: gcloud command not found

**Error:**
```
bash: gcloud: command not found
```

**Cause:** gcloud CLI is not installed or not in PATH.

**Solution:**

**Install gcloud CLI:**
```bash
# macOS (Homebrew)
brew install --cask google-cloud-sdk

# macOS (Manual)
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Linux
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Windows
# Download installer from: https://cloud.google.com/sdk/docs/install
```

**Verify installation:**
```bash
gcloud --version
```

**Expected output:**
```
Google Cloud SDK 460.0.0
bq 2.0.101
core 2024.01.15
gcloud-crc32c 1.0.0
gsutil 5.27
```

---

### Issue: gcloud components outdated

**Error:**
```
ERROR: (gcloud.alpha.services.api-keys.create) Invalid choice: 'api-keys'
```

**Cause:** gcloud alpha components not installed or outdated.

**Solution:**

**Update gcloud components:**
```bash
gcloud components update

# If alpha component not installed
gcloud components install alpha
```

**Verify alpha component:**
```bash
gcloud alpha --help
```

---

## Authentication Errors

### Issue: Not authenticated

**Error:**
```
ERROR: (gcloud.projects.create) You do not currently have an active account selected.
```

**Cause:** No authenticated account in gcloud.

**Solution:**

**Authenticate with user account:**
```bash
gcloud auth login
```

**Verify authentication:**
```bash
gcloud auth list
```

**Expected output:**
```
           Credentialed Accounts
ACTIVE  ACCOUNT
*       user@company.com
```

---

### Issue: Application Default Credentials not set

**Error:**
```
ERROR: (gcloud) UNAUTHENTICATED: Request had invalid authentication credentials
```

**Cause:** Application Default Credentials (ADC) not configured.

**Solution:**

**Set up ADC:**
```bash
gcloud auth application-default login
```

**Verify ADC:**
```bash
gcloud auth application-default print-access-token
```

**Expected:** Prints an access token.

---

### Issue: Wrong account selected

**Error:**
```
ERROR: (gcloud.projects.create) User [wrong-user@company.com] does not have permission...
```

**Cause:** Multiple accounts configured, wrong one is active.

**Solution:**

**List accounts:**
```bash
gcloud auth list
```

**Switch account:**
```bash
gcloud config set account user@company.com
```

**Verify:**
```bash
gcloud config get-value account
```

---

## Permission Denied Errors

### Issue: Cannot create projects

**Error:**
```
ERROR: (gcloud.projects.create) User [user@company.com] does not have permission to create projects in folder [123456789].
- '@type': type.googleapis.com/google.rpc.ErrorInfo
  domain: cloudresourcemanager.googleapis.com
  metadata:
    permission: resourcemanager.projects.create
  reason: IAM_PERMISSION_DENIED
```

**Cause:** User lacks `resourcemanager.projects.create` permission on the folder.

**Solution:**

**Option 1: Grant Project Creator role (recommended)**
```bash
gcloud resource-manager folders add-iam-policy-binding ${FOLDER_ID} \
  --member="user:user@company.com" \
  --role="roles/resourcemanager.projectCreator"
```

**Option 2: Request access from admin**
Contact your GCP organization admin and request:
- Role: `Project Creator`
- Scope: Folder `${FOLDER_ID}`

**Verify permissions:**
```bash
gcloud resource-manager folders get-iam-policy ${FOLDER_ID} \
  --flatten="bindings[].members" \
  --filter="bindings.members:user:user@company.com"
```

---

### Issue: Cannot link billing account

**Error:**
```
ERROR: (gcloud.billing.projects.link) PERMISSION_DENIED: The caller does not have permission
```

**Cause:** User lacks billing permissions.

**Solution:**

**Grant Billing Account User role:**
```bash
gcloud organizations add-iam-policy-binding ${ORG_ID} \
  --member="user:user@company.com" \
  --role="roles/billing.user"
```

**Or at billing account level:**
```bash
gcloud billing accounts add-iam-policy-binding ${BILLING_ACCOUNT} \
  --member="user:user@company.com" \
  --role="roles/billing.user"
```

**Verify billing access:**
```bash
gcloud billing accounts list
```

---

### Issue: Cannot enable APIs

**Error:**
```
ERROR: (gcloud.services.enable) PERMISSION_DENIED: The caller does not have permission
```

**Cause:** User lacks Service Usage Admin role.

**Solution:**

**Grant at project level (after project creation):**
```bash
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="user:user@company.com" \
  --role="roles/serviceusage.serviceUsageAdmin"
```

**Or grant at folder level:**
```bash
gcloud resource-manager folders add-iam-policy-binding ${FOLDER_ID} \
  --member="user:user@company.com" \
  --role="roles/serviceusage.serviceUsageAdmin"
```

---

### Issue: Cannot create API keys

**Error:**
```
ERROR: (gcloud.alpha.services.api-keys.create) PERMISSION_DENIED: The caller does not have permission
```

**Cause:** User lacks API Keys Admin role.

**Solution:**

**Grant at project level:**
```bash
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="user:user@company.com" \
  --role="roles/serviceusage.apiKeysAdmin"
```

---

## Project Creation Failures

### Issue: Project ID already exists

**Error:**
```
ERROR: (gcloud.projects.create) Resource in projects [marketing-vertex-ai] is the subject of a conflict: Requested entity already exists
```

**Cause:** Project ID is already in use (by you or someone else in the organization).

**Solution:**

**Check if project exists:**
```bash
gcloud projects list --filter="projectId:marketing-vertex-ai"
```

**If it's your project:**
- Skill should detect this and return "already exists" message
- This is expected behavior for idempotency

**If it's someone else's project:**
- Choose a different project ID
- Use business unit with more specificity (e.g., "marketing-na-vertex-ai")

---

### Issue: Invalid project ID format

**Error:**
```
ERROR: (gcloud.projects.create) INVALID_ARGUMENT: Request contains an invalid argument.
```

**Cause:** Project ID doesn't meet naming requirements.

**Requirements:**
- 6-30 characters
- Lowercase letters, digits, and hyphens only
- Must start with a letter
- Cannot end with a hyphen

**Examples:**
```bash
# ✓ Valid
marketing-vertex-ai
sales-team-vertex-ai
eng-vertex-ai-2026

# ✗ Invalid
Marketing-Vertex-AI  # Uppercase letters
123-vertex-ai        # Starts with digit
marketing-vertex-    # Ends with hyphen
m-v-a                # Too short (< 6 chars)
```

---

### Issue: Folder not found

**Error:**
```
ERROR: (gcloud.projects.create) NOT_FOUND: Requested entity was not found.
```

**Cause:** The folder ID specified in `GCP_FOLDER_ID` doesn't exist or you don't have access.

**Solution:**

**Verify folder exists:**
```bash
gcloud resource-manager folders describe ${FOLDER_ID}
```

**List folders you have access to:**
```bash
gcloud resource-manager folders list --organization=${ORG_ID}
```

**Check environment variable:**
```bash
echo $GCP_FOLDER_ID
```

**Update if incorrect:**
```bash
export GCP_FOLDER_ID="correct-folder-id"
```

---

## Billing Account Issues

### Issue: Billing account not found

**Error:**
```
ERROR: (gcloud.billing.projects.link) INVALID_ARGUMENT: Request contains an invalid argument.
```

**Cause:** Billing account ID is incorrect or doesn't exist.

**Solution:**

**List available billing accounts:**
```bash
gcloud billing accounts list
```

**Expected output:**
```
ACCOUNT_ID            NAME                OPEN  MASTER_ACCOUNT_ID
012345-ABCDEF-678901  My Billing Account  True
```

**Update environment variable:**
```bash
export GCP_BILLING_ACCOUNT="012345-ABCDEF-678901"
```

---

### Issue: Billing account closed

**Error:**
```
ERROR: (gcloud.billing.projects.link) FAILED_PRECONDITION: Billing account is closed
```

**Cause:** The billing account has been closed or disabled.

**Solution:**

**Check billing account status:**
```bash
gcloud billing accounts describe ${BILLING_ACCOUNT}
```

**Contact billing admin:**
- Request billing account reactivation
- Or use a different billing account

---

## API Enablement Timeouts

### Issue: API enablement takes too long

**Symptom:** `gcloud services enable` hangs for > 10 minutes.

**Cause:** API enablement can sometimes take a long time, especially for the first API in a new project.

**Solution:**

**Option 1: Wait (recommended)**
- API enablement can take up to 15 minutes
- The command will complete when ready

**Option 2: Check status manually**
```bash
# In another terminal
gcloud services list --enabled --project=${PROJECT_ID}
```

**Option 3: Cancel and retry**
```bash
# Press Ctrl+C to cancel
# Wait 5 minutes
# Retry the enable command
gcloud services enable aiplatform.googleapis.com --project=${PROJECT_ID}
```

---

### Issue: API enablement fails

**Error:**
```
ERROR: (gcloud.services.enable) FAILED_PRECONDITION: Billing must be enabled for activation of service
```

**Cause:** Billing is not enabled on the project.

**Solution:**

**Check billing status:**
```bash
gcloud billing projects describe ${PROJECT_ID}
```

**Expected output:**
```
billingAccountName: billingAccounts/012345-ABCDEF-678901
billingEnabled: true
...
```

**If billingEnabled is false:**
```bash
gcloud billing projects link ${PROJECT_ID} \
  --billing-account=${BILLING_ACCOUNT}
```

---

## API Key Creation Failures

### Issue: API key creation fails - API not enabled

**Error:**
```
ERROR: (gcloud.alpha.services.api-keys.create) FAILED_PRECONDITION: Service aiplatform.googleapis.com is not enabled
```

**Cause:** Vertex AI API is not fully enabled yet.

**Solution:**

**Check API status:**
```bash
gcloud services list --enabled --project=${PROJECT_ID} --filter="name:aiplatform.googleapis.com"
```

**If not listed:**
- Wait for API enablement to complete
- Can take 2-5 minutes after `gcloud services enable` completes

**Retry after API is enabled:**
```bash
# Wait 2 minutes, then retry
sleep 120
gcloud alpha services api-keys create \
  --display-name="marketing-vertex-key" \
  --project=${PROJECT_ID} \
  --api-target=service=aiplatform.googleapis.com
```

---

### Issue: Cannot retrieve API key value

**Error:** User says "I lost my API key, can you retrieve it?"

**Cause:** GCP does not allow retrieving API key values after creation (security feature).

**Solution:**

**Cannot retrieve - must rotate:**
```bash
# Create new key
gcloud alpha services api-keys create \
  --display-name="marketing-vertex-key-2" \
  --project=${PROJECT_ID} \
  --api-target=service=aiplatform.googleapis.com

# Delete old key
gcloud alpha services api-keys delete ${OLD_KEY_NAME} \
  --project=${PROJECT_ID}
```

**Prevention:**
- Store API keys in Secret Manager immediately after creation
- Or copy to secure password manager
- See SECURITY.md for best practices

---

## Quota and Rate Limits

### Issue: Project creation quota exceeded

**Error:**
```
ERROR: (gcloud.projects.create) RESOURCE_EXHAUSTED: Quota exceeded for quota metric 'Create requests'
```

**Cause:** You've hit the project creation quota (default: 5 projects per month for new organizations).

**Solution:**

**Request quota increase:**
1. Go to [Quotas page](https://console.cloud.google.com/iam-admin/quotas)
2. Filter for "Resource Manager API"
3. Find "Create requests"
4. Request increase

**Wait for quota reset:**
- Quotas reset monthly
- Check current quota:
```bash
gcloud compute project-info describe --project=${PROJECT_ID}
```

---

### Issue: API rate limit exceeded

**Error:**
```
ERROR: (gcloud.alpha.services.api-keys.create) RESOURCE_EXHAUSTED: Quota exceeded for quota metric 'Write requests'
```

**Cause:** Too many API requests in a short time.

**Solution:**

**Wait and retry:**
```bash
# Wait 1 minute
sleep 60

# Retry the command
gcloud alpha services api-keys create ...
```

**Implement exponential backoff:**
```bash
for i in {1..5}; do
  if gcloud alpha services api-keys create ...; then
    break
  else
    echo "Retry $i/5 in $((2**i)) seconds..."
    sleep $((2**i))
  fi
done
```

---

## Environment Variable Issues

### Issue: Environment variable not set

**Error:**
```
ERROR: Folder ID not set. Please set GCP_FOLDER_ID environment variable.
```

**Cause:** Required environment variable is missing.

**Solution:**

**Set environment variables:**
```bash
export GCP_FOLDER_ID="123456789"
export GCP_BILLING_ACCOUNT="012345-ABCDEF-678901"
```

**Make permanent (add to shell profile):**
```bash
# For bash
echo 'export GCP_FOLDER_ID="123456789"' >> ~/.bashrc
echo 'export GCP_BILLING_ACCOUNT="012345-ABCDEF-678901"' >> ~/.bashrc
source ~/.bashrc

# For zsh
echo 'export GCP_FOLDER_ID="123456789"' >> ~/.zshrc
echo 'export GCP_BILLING_ACCOUNT="012345-ABCDEF-678901"' >> ~/.zshrc
source ~/.zshrc
```

**Or use .env file:**
```bash
# Create .env file
cat > .env <<EOF
GCP_FOLDER_ID="123456789"
GCP_BILLING_ACCOUNT="012345-ABCDEF-678901"
EOF

# Load with direnv or source
source .env
```

---

### Issue: Environment variable incorrect format

**Error:**
```
ERROR: (gcloud.billing.projects.link) INVALID_ARGUMENT: Invalid billing account ID
```

**Cause:** Billing account format is incorrect.

**Format:**
- Should be: `012345-ABCDEF-678901` (6 digits, 6 hex chars, 6 digits, separated by hyphens)
- Not: `billingAccounts/012345-ABCDEF-678901` (no prefix)

**Solution:**

**Check current value:**
```bash
echo $GCP_BILLING_ACCOUNT
```

**Correct format:**
```bash
export GCP_BILLING_ACCOUNT="012345-ABCDEF-678901"  # ✓ Correct
```

**Incorrect formats:**
```bash
export GCP_BILLING_ACCOUNT="billingAccounts/012345-ABCDEF-678901"  # ✗ Wrong (has prefix)
export GCP_BILLING_ACCOUNT="012345ABCDEF678901"                     # ✗ Wrong (no hyphens)
```

---

## When to Escalate

**Escalate to GCP Admin if:**
- Permission errors persist after requesting IAM roles
- Billing account issues cannot be resolved
- Quota increases are needed
- Organization-level policies block provisioning
- Unknown errors not covered in this guide

**Escalate to Security Team if:**
- API key compromise suspected
- Unauthorized access detected
- Compliance questions arise

**Escalate to Platform Team if:**
- Skill behavior is incorrect
- MCP server errors occur
- Feature requests or improvements needed

---

## Diagnostic Commands

**When reporting issues, include output from:**

```bash
# gcloud version
gcloud --version

# Authentication status
gcloud auth list

# Current project
gcloud config get-value project

# Available billing accounts
gcloud billing accounts list

# Folder access
gcloud resource-manager folders list --organization=${ORG_ID}

# Environment variables
echo "FOLDER_ID: $GCP_FOLDER_ID"
echo "BILLING_ACCOUNT: $GCP_BILLING_ACCOUNT"
```

---

## Getting Help

**Documentation:**
- [GCP Documentation](https://cloud.google.com/docs)
- [gcloud CLI Reference](https://cloud.google.com/sdk/gcloud/reference)
- [Vertex AI Documentation](https://cloud.google.com/vertex-ai/docs)

**Support Channels:**
- Internal: IT Platform Team (#platform-engineering)
- GCP Support: [Google Cloud Support](https://cloud.google.com/support)
- Community: [Stack Overflow - google-cloud-platform](https://stackoverflow.com/questions/tagged/google-cloud-platform)

**Full Setup Guide:**
- `knowledge-base/team/configure-claude-code-vertex-ai.md`
