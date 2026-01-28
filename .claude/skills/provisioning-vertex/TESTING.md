# Testing Guide: provisioning-vertex Skill

This guide walks through testing the `/provisioning-vertex` skill step-by-step.

## Prerequisites Checklist

Before testing, ensure you have:

- [ ] gcloud CLI installed
- [ ] Authenticated with GCP
- [ ] Application Default Credentials set
- [ ] Required GCP permissions
- [ ] Environment variables configured
- [ ] Claude Code restarted (to load the skill)

---

## Step 1: Install gcloud CLI

**Check if installed:**
```bash
gcloud --version
```

**If not installed:**
```bash
# macOS
brew install --cask google-cloud-sdk

# Linux
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Windows
# Download from: https://cloud.google.com/sdk/docs/install
```

**Verify installation:**
```bash
gcloud --version
# Should show: Google Cloud SDK 460.0.0 or higher
```

---

## Step 2: Authenticate with GCP

**User authentication:**
```bash
gcloud auth login
```
- Opens browser for Google account login
- Authenticate with your GCP account

**Set up Application Default Credentials:**
```bash
gcloud auth application-default login
```
- Also opens browser
- Creates credentials for applications (like the gcloud MCP server)

**Verify authentication:**
```bash
# Check user authentication
gcloud auth list
# Should show: * user@company.com (active account)

# Check ADC is working
gcloud auth application-default print-access-token
# Should print: ya29.a0A... (access token)
```

---

## Step 3: Verify GCP Permissions

**Check you have the required roles:**

```bash
# Get your organization ID
gcloud organizations list

# Check your permissions on a folder (if you know the folder ID)
gcloud resource-manager folders get-iam-policy ${FOLDER_ID} \
  --flatten="bindings[].members" \
  --filter="bindings.members:user:$(gcloud config get-value account)"

# Check billing accounts you can use
gcloud billing accounts list
```

**Required roles:**
- Project Creator (on folder or organization)
- Billing Account User
- Service Usage Admin (or granted after project creation)
- API Keys Admin (or granted after project creation)

**If missing permissions:**
Contact your GCP admin and request:
```
Role: Project Creator
Scope: Folder ID where Vertex AI projects should be created

Role: Billing Account User
Scope: Billing account to be used for projects
```

---

## Step 4: Configure Environment Variables

**Find your configuration values:**

```bash
# Find folder ID (where projects will be created)
gcloud resource-manager folders list --organization=${ORG_ID}

# Find billing account
gcloud billing accounts list
```

**Set environment variables:**

**Option A: .env file (recommended for development)**
```bash
# Create .env file
cat > .env <<'EOF'
GCP_FOLDER_ID="123456789"
GCP_BILLING_ACCOUNT="012345-ABCDEF-678901"
VERTEX_AI_REGION="us-east5"
EOF

# Add to .gitignore
echo ".env" >> .gitignore

# Load variables
source .env
```

**Option B: Shell profile (persistent)**
```bash
# Add to ~/.bashrc or ~/.zshrc
echo 'export GCP_FOLDER_ID="123456789"' >> ~/.zshrc
echo 'export GCP_BILLING_ACCOUNT="012345-ABCDEF-678901"' >> ~/.zshrc
echo 'export VERTEX_AI_REGION="us-east5"' >> ~/.zshrc

# Reload
source ~/.zshrc
```

**Verify variables are set:**
```bash
echo "Folder ID: $GCP_FOLDER_ID"
echo "Billing Account: $GCP_BILLING_ACCOUNT"
echo "Region: $VERTEX_AI_REGION"
```

---

## Step 5: Restart Claude Code

**Restart Claude Code to load the skill:**

1. Exit Claude Code completely
2. Restart Claude Code
3. The skill should now be available

**Verify skill is loaded:**
In Claude Code, try:
```
User: What skills are available?
```

You should see `provisioning-vertex` in the list.

---

## Step 6: Verify gcloud MCP Server

**Test that the gcloud MCP server is working:**

```
User: What gcloud tools are available?
```

**Expected response:**
Claude should mention it has access to `run_gcloud_command` tool from the gcloud MCP server.

**Alternatively, test directly:**
```
User: Run this gcloud command: gcloud auth list
```

**Expected response:**
Should show the output of `gcloud auth list` showing your authenticated account.

---

## Step 7: Test Skill - Basic Flow

### Test 1: Check Prerequisites

```
User: /provisioning-vertex - check if I'm set up correctly
```

**Expected behavior:**
- Claude should check gcloud installation
- Verify authentication
- Check environment variables
- Report any issues

### Test 2: List Existing Projects (if any)

```
User: /provisioning-vertex list all projects
```

**Expected behavior:**
- Runs `gcloud projects list --filter='labels.purpose=vertex-ai'`
- Shows table of existing Vertex AI projects (or "No projects found")

### Test 3: Create Test Project

```
User: /provisioning-vertex create project for TestUnit, owner: test@company.com
```

**Expected behavior:**
1. Parses input: business_unit="testunit", owner="test@company.com"
2. Checks if project exists (should not exist)
3. Creates GCP project `testunit-vertex-ai`
4. Links billing account
5. Enables Vertex AI API (takes 2-5 minutes)
6. Creates restricted API key
7. Returns minimal output with:
   - Success message
   - Project ID
   - Truncated API key (first 10 chars)
   - Shareable snippet with full API key

**Expected output format:**
```
✓ Vertex AI project provisioned for TestUnit

**Project ID:** testunit-vertex-ai
**Region:** us-east5
**API Key:** AIzaSyD123...

## Quick Setup (copy/paste)
export ANTHROPIC_API_KEY="AIzaSyD1234567890abcdefghijklmnopqrstuvwxyz"
export ANTHROPIC_BASE_URL="https://us-east5-aiplatform.googleapis.com/v1"
export ANTHROPIC_VERTEX_PROJECT_ID="testunit-vertex-ai"
export ANTHROPIC_VERTEX_LOCATION="us-east5"

## Available Models
- Claude Sonnet 4.5: claude-sonnet-4-5@20250929
- Claude Opus 4.5: claude-opus-4-5@20251101
- Claude Haiku 4.5: claude-haiku-4-5@20251001

## Test Command
[curl command...]

## Need Help?
Full guide: knowledge-base/team/configure-claude-code-vertex-ai.md
```

**Timeline:** Expect 4-5 minutes total
- Project creation: ~30 seconds
- Billing linkage: ~5 seconds
- API enablement: ~3 minutes (longest step)
- API key creation: ~2 seconds

### Test 4: Idempotency Check

```
User: /provisioning-vertex create project for TestUnit, owner: test@company.com
```

**Expected behavior:**
- Detects project already exists
- Returns "already exists" message
- Does NOT create duplicate project

**Expected output:**
```
✓ Vertex AI project already exists for TestUnit

**Project ID:** testunit-vertex-ai

Note: This project was previously provisioned. API keys cannot be retrieved after creation for security reasons.

To rotate or create a new API key:
- Run: `/provisioning-vertex rotate key for testunit`
- Or manually: `gcloud alpha services api-keys create --project=testunit-vertex-ai ...`
```

### Test 5: Get Project Details

```
User: /provisioning-vertex get details for testunit
```

**Expected behavior:**
- Shows project information
- Lists enabled APIs
- Shows API keys (names only, not values)

### Test 6: Clean Up Test Project

```bash
# Manually delete the test project
gcloud projects delete testunit-vertex-ai
```

Or ask Claude:
```
User: Delete the testunit-vertex-ai project
```

---

## Step 8: Verify in GCP Console

**Check the project in GCP Console:**

1. Go to [GCP Console](https://console.cloud.google.com)
2. Navigate to IAM & Admin → Manage Resources
3. Find `testunit-vertex-ai` project
4. Verify:
   - Project is in correct folder
   - Billing is linked
   - Labels are set: `business-unit=testunit`, `purpose=vertex-ai`

**Check API is enabled:**
1. Select the project
2. Go to APIs & Services → Enabled APIs
3. Verify `Vertex AI API` is enabled

**Check API key:**
1. Go to APIs & Services → Credentials
2. Find the API key named `testunit-vertex-key`
3. Verify it's restricted to `aiplatform.googleapis.com`

---

## Test Scenarios

### Scenario 1: Happy Path (New Project)

**Input:**
```
/provisioning-vertex create project for Marketing, owner: marketing@company.com
```

**Expected:**
- ✓ Creates project `marketing-vertex-ai`
- ✓ Links billing
- ✓ Enables Vertex AI API
- ✓ Creates API key
- ✓ Returns shareable snippet

### Scenario 2: Idempotent Re-run

**Input:**
```
/provisioning-vertex create project for Marketing, owner: marketing@company.com
```
(Run a second time)

**Expected:**
- ✓ Detects existing project
- ✓ Does NOT create duplicate
- ✓ Returns "already exists" message

### Scenario 3: Permission Denied

**Setup:** Remove Project Creator role temporarily

**Input:**
```
/provisioning-vertex create project for Test
```

**Expected:**
- ✗ Permission denied error
- ✓ Helpful error message with remediation steps
- ✓ Links to troubleshooting guide

### Scenario 4: Multiple Projects

**Input:**
```
/provisioning-vertex create projects for Marketing, Sales, and Engineering
```

**Expected:**
- ✓ Confirms with user before proceeding
- ✓ Creates 3 projects
- ✓ Returns summary with all 3 API keys

### Scenario 5: List Projects

**Input:**
```
/provisioning-vertex list all projects
```

**Expected:**
- ✓ Shows table of all Vertex AI projects
- ✓ Includes business unit, project ID, creation date

### Scenario 6: Get Details

**Input:**
```
/provisioning-vertex get details for marketing
```

**Expected:**
- ✓ Shows project metadata
- ✓ Shows enabled APIs
- ✓ Lists API keys (names only)

### Scenario 7: Rotate API Key

**Input:**
```
/provisioning-vertex rotate key for marketing
```

**Expected:**
- ✓ Creates new API key
- ✓ Asks user if they want to delete old key
- ✓ Returns new shareable snippet

---

## Troubleshooting Tests

### Test: gcloud Not Installed

**Simulate:** Temporarily rename gcloud binary

**Expected:**
- ✓ Error: gcloud command not found
- ✓ Helpful instructions to install gcloud

### Test: Not Authenticated

**Simulate:**
```bash
gcloud auth revoke
```

**Expected:**
- ✓ Error: No active account
- ✓ Instructions to run `gcloud auth login`

### Test: Missing ADC

**Simulate:** Remove ADC file
```bash
mv ~/.config/gcloud/application_default_credentials.json ~/.config/gcloud/application_default_credentials.json.bak
```

**Expected:**
- ✓ Error: Invalid authentication credentials
- ✓ Instructions to run `gcloud auth application-default login`

### Test: Environment Variable Not Set

**Simulate:**
```bash
unset GCP_FOLDER_ID
```

**Expected:**
- ✓ Error: GCP_FOLDER_ID not set
- ✓ Instructions to set it

---

## Verification Checklist

After testing, verify:

**GCP Console:**
- [ ] Project exists in correct folder
- [ ] Billing is linked
- [ ] Labels are set correctly
- [ ] Vertex AI API is enabled
- [ ] API key is created and restricted

**Local Environment:**
- [ ] API key is in shareable snippet (full value)
- [ ] API key is truncated in chat (first 10 chars only)
- [ ] No API keys committed to git

**Skill Behavior:**
- [ ] Idempotency works (no duplicates)
- [ ] Error messages are helpful
- [ ] Output is minimal and clean
- [ ] Shareable snippet is copy/paste ready

**Security:**
- [ ] API key restricted to aiplatform.googleapis.com only
- [ ] Full API key only in shareable snippet
- [ ] Truncated API key in chat

---

## Performance Benchmarks

**Expected timings:**
- Project creation: ~30 seconds
- Billing linkage: ~5 seconds
- API enablement: 2-5 minutes (longest step)
- API key creation: ~2 seconds
- **Total: ~4-5 minutes per project**

**If slower than expected:**
- Check network connection
- Check GCP region (some regions slower than others)
- API enablement can occasionally take up to 10 minutes

---

## Cleanup

**After testing, clean up test resources:**

```bash
# Delete test project
gcloud projects delete testunit-vertex-ai

# Or ask Claude
```

```
User: Delete the testunit-vertex-ai project
```

**Restore authentication (if revoked during troubleshooting tests):**
```bash
gcloud auth login
gcloud auth application-default login
```

**Restore environment variables (if unset during tests):**
```bash
source .env
# or
source ~/.zshrc
```

---

## Next Steps

After successful testing:

1. Document the process for your team
2. Share the skill with other users
3. Create real business unit projects
4. Set up quarterly API key rotation reminders
5. Configure monitoring and alerting (see SECURITY.md)

---

## Getting Help

**If tests fail:**
1. Check TROUBLESHOOTING.md for common issues
2. Verify prerequisites are met
3. Check gcloud CLI version is up to date
4. Review SECURITY.md for authentication setup
5. Escalate to GCP admin if permission issues persist

**Escalation contacts:**
- GCP Admin: [your-gcp-admin@company.com]
- IT Platform Team: #platform-engineering
- Skill Issues: [your-team-contact]
