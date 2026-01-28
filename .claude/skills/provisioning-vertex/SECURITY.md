# Security Best Practices

This document outlines security best practices for the `/provision-vertex` skill and GCP Vertex AI project provisioning.

## Contents

1. [API Key Safety](#api-key-safety)
2. [Key Rotation](#key-rotation)
3. [gcloud Authentication](#gcloud-authentication)
4. [Permissions and Least Privilege](#permissions-and-least-privilege)
5. [Incident Response](#incident-response)
6. [Audit and Monitoring](#audit-and-monitoring)
7. [Network Security](#network-security)

---

## API Key Safety

**Critical Rules:**

### Never Commit API Keys to Version Control
```bash
# ✗ WRONG - Never do this
git add .env
git commit -m "Add API keys"

# ✓ CORRECT - Add to .gitignore
echo ".env" >> .gitignore
echo "*.key" >> .gitignore
echo "credentials/" >> .gitignore
```

**Check for accidental commits:**
```bash
# Search git history for potential keys
git log -p | grep -E "AIza[0-9A-Za-z-_]{35}"

# Use git-secrets to prevent commits
git secrets --install
git secrets --register-aws
git secrets --add 'AIza[0-9A-Za-z-_]{35}'
```

### Store Keys Securely

**Option 1: Environment Variables (Recommended for development)**
```bash
# Store in .env file (add to .gitignore)
echo 'ANTHROPIC_API_KEY="AIzaSy..."' >> .env

# Load with direnv or dotenv
direnv allow
# OR
source .env
```

**Option 2: Secret Manager (Recommended for production)**
```bash
# Store in GCP Secret Manager
echo -n "AIzaSy..." | gcloud secrets create anthropic-api-key \
  --data-file=- \
  --project=marketing-vertex-ai

# Retrieve when needed
gcloud secrets versions access latest \
  --secret=anthropic-api-key \
  --project=marketing-vertex-ai
```

**Option 3: Encrypted Storage**
```bash
# Encrypt with gpg
echo "AIzaSy..." | gpg --encrypt --recipient user@company.com > api-key.gpg

# Decrypt when needed
gpg --decrypt api-key.gpg
```

### Truncate Keys in Logs and Chat

**Skill Implementation:**
```python
# When displaying API key to user
api_key = "AIzaSyD1234567890abcdefghijklmnopqrstuvwxyz"
truncated_key = f"{api_key[:10]}..."  # "AIzaSyD123..."

# Show truncated in chat
print(f"API Key: {truncated_key}")

# Provide full key only in shareable snippet (user copies once)
snippet = f'export ANTHROPIC_API_KEY="{api_key}"'
```

**Log Sanitization:**
```bash
# If logging gcloud commands, sanitize keys
command="gcloud alpha services api-keys create..."
log_command=$(echo "$command" | sed 's/AIza[^ ]*/AIza***/g')
echo "Running: $log_command"
```

### Restrict API Key Scope

**Always create restricted keys (not unrestricted):**
```bash
# ✓ CORRECT - Restricted to Vertex AI only
gcloud alpha services api-keys create \
  --display-name="marketing-vertex-key" \
  --project=marketing-vertex-ai \
  --api-target=service=aiplatform.googleapis.com

# ✗ WRONG - Unrestricted key (can access all APIs)
gcloud alpha services api-keys create \
  --display-name="marketing-key"
```

**Additional Restrictions (Optional):**
```bash
# Restrict by IP address (for server-side use)
gcloud alpha services api-keys update ${key_name} \
  --allowed-ips=203.0.113.0/24

# Restrict by HTTP referrer (for client-side use)
gcloud alpha services api-keys update ${key_name} \
  --allowed-referrers=https://myapp.com/*
```

---

## Key Rotation

**Policy:**
- Rotate API keys every 90 days (quarterly)
- Rotate immediately if key is compromised
- Rotate before team member offboarding

### Quarterly Rotation Process

**Step 1: Create New Key**
```bash
gcloud alpha services api-keys create \
  --display-name="marketing-vertex-key-$(date +%Y%m%d)" \
  --project=marketing-vertex-ai \
  --api-target=service=aiplatform.googleapis.com
```

**Step 2: Update All Systems**
```bash
# Update environment variables
export ANTHROPIC_API_KEY="<new-key>"

# Update Secret Manager
echo -n "<new-key>" | gcloud secrets versions add anthropic-api-key \
  --data-file=- \
  --project=marketing-vertex-ai

# Update CI/CD pipelines
# (specific steps depend on your CI/CD system)
```

**Step 3: Test New Key**
```bash
# Test API access with new key
curl -X POST "https://us-east5-aiplatform.googleapis.com/v1/projects/marketing-vertex-ai/locations/us-east5/publishers/anthropic/models/claude-sonnet-4-5@20250929:predict" \
  -H "Authorization: Bearer $ANTHROPIC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "test"}], "model": "claude-sonnet-4-5@20250929", "max_tokens": 10}'
```

**Step 4: Monitor for Errors**
```bash
# Monitor logs for authentication errors
gcloud logging read \
  "resource.type=aiplatform.googleapis.com/Endpoint AND severity=ERROR" \
  --project=marketing-vertex-ai \
  --limit=50
```

**Step 5: Delete Old Key**
```bash
# Wait 24-48 hours to ensure no systems are still using old key
# Then delete old key
gcloud alpha services api-keys delete ${old_key_name} \
  --project=marketing-vertex-ai
```

### Rotation Calendar

Set up automated reminders:
```bash
# Add to crontab for quarterly reminders
0 9 1 1,4,7,10 * echo "Rotate Vertex AI API keys" | mail -s "Quarterly Key Rotation" devops@company.com
```

**Track key creation dates:**
```bash
# List keys with creation dates
gcloud alpha services api-keys list \
  --project=marketing-vertex-ai \
  --format='table(displayName,createTime)'
```

---

## gcloud Authentication

**Best Practices:**

### Use Application Default Credentials (ADC)

**For Development:**
```bash
# Set up ADC for your user account
gcloud auth application-default login

# This creates credentials at:
# ~/.config/gcloud/application_default_credentials.json
```

**For Production (Service Accounts):**
```bash
# Create service account
gcloud iam service-accounts create vertex-provisioner \
  --display-name="Vertex AI Provisioner" \
  --project=your-admin-project

# Grant required roles (see below)
gcloud projects add-iam-policy-binding your-admin-project \
  --member="serviceAccount:vertex-provisioner@your-admin-project.iam.gserviceaccount.com" \
  --role="roles/resourcemanager.projectCreator"

# Download key
gcloud iam service-accounts keys create ~/vertex-provisioner-key.json \
  --iam-account=vertex-provisioner@your-admin-project.iam.gserviceaccount.com

# Activate service account
gcloud auth activate-service-account \
  --key-file=~/vertex-provisioner-key.json

# Set as ADC
export GOOGLE_APPLICATION_CREDENTIALS=~/vertex-provisioner-key.json
```

### Avoid User Credentials in Production

```bash
# ✗ WRONG - Don't use user credentials in automated systems
gcloud auth login
# This requires browser interaction and is tied to a person

# ✓ CORRECT - Use service accounts
gcloud auth activate-service-account --key-file=service-account.json
```

### Secure Service Account Keys

```bash
# Set restrictive permissions
chmod 600 ~/vertex-provisioner-key.json

# Encrypt at rest
gpg --encrypt --recipient ops@company.com vertex-provisioner-key.json
rm vertex-provisioner-key.json  # Remove unencrypted copy

# Store in secret manager
gcloud secrets create vertex-provisioner-key \
  --data-file=vertex-provisioner-key.json \
  --project=your-admin-project
```

### Revoke Compromised Credentials

```bash
# Revoke user credentials
gcloud auth revoke user@company.com

# Delete service account key
gcloud iam service-accounts keys delete ${KEY_ID} \
  --iam-account=vertex-provisioner@your-admin-project.iam.gserviceaccount.com

# Delete service account (if fully compromised)
gcloud iam service-accounts delete \
  vertex-provisioner@your-admin-project.iam.gserviceaccount.com
```

---

## Permissions and Least Privilege

**Principle:** Grant the minimum permissions required to perform the task.

### Required Permissions for Provisioning

**At Organization/Folder Level:**
- `resourcemanager.projects.create` - Create projects
- `resourcemanager.projects.setIamPolicy` - Set project IAM

**At Project Level (for new projects):**
- `billing.resourceAssociations.create` - Link billing
- `serviceusage.services.enable` - Enable APIs
- `serviceusage.apiKeys.create` - Create API keys

### Recommended IAM Roles

**Option 1: Predefined Roles (Simpler)**
```bash
# Grant at folder level for user
gcloud resource-manager folders add-iam-policy-binding ${FOLDER_ID} \
  --member="user:provisioner@company.com" \
  --role="roles/resourcemanager.projectCreator"

gcloud organizations add-iam-policy-binding ${ORG_ID} \
  --member="user:provisioner@company.com" \
  --role="roles/billing.user"

# Note: Service Usage Admin and API Keys Admin are granted at project level after creation
```

**Option 2: Custom Role (More Restrictive)**
```yaml
# custom-vertex-provisioner.yaml
title: "Vertex AI Provisioner"
description: "Minimal permissions to provision Vertex AI projects"
stage: "GA"
includedPermissions:
- resourcemanager.projects.create
- resourcemanager.projects.get
- resourcemanager.projects.list
- billing.resourceAssociations.create
- serviceusage.services.enable
- serviceusage.apiKeys.create
- serviceusage.apiKeys.list
```

```bash
# Create custom role
gcloud iam roles create vertexProvisioner \
  --organization=${ORG_ID} \
  --file=custom-vertex-provisioner.yaml

# Grant custom role
gcloud organizations add-iam-policy-binding ${ORG_ID} \
  --member="user:provisioner@company.com" \
  --role="organizations/${ORG_ID}/roles/vertexProvisioner"
```

### Service Account Permissions (For Automation)

```bash
# Create service account
gcloud iam service-accounts create vertex-provisioner \
  --project=admin-project

# Grant roles
gcloud resource-manager folders add-iam-policy-binding ${FOLDER_ID} \
  --member="serviceAccount:vertex-provisioner@admin-project.iam.gserviceaccount.com" \
  --role="roles/resourcemanager.projectCreator"

gcloud organizations add-iam-policy-binding ${ORG_ID} \
  --member="serviceAccount:vertex-provisioner@admin-project.iam.gserviceaccount.com" \
  --role="roles/billing.user"
```

### Avoid Over-Permissioning

```bash
# ✗ WRONG - Don't grant Owner role
gcloud organizations add-iam-policy-binding ${ORG_ID} \
  --member="user:provisioner@company.com" \
  --role="roles/owner"

# ✓ CORRECT - Grant specific roles only
gcloud resource-manager folders add-iam-policy-binding ${FOLDER_ID} \
  --member="user:provisioner@company.com" \
  --role="roles/resourcemanager.projectCreator"
```

---

## Incident Response

**If an API key is compromised:**

### Immediate Actions (Within 1 hour)

**Step 1: Revoke the Compromised Key**
```bash
# Delete the key immediately
gcloud alpha services api-keys delete ${compromised_key_name} \
  --project=marketing-vertex-ai \
  --quiet
```

**Step 2: Create New Key**
```bash
# Generate replacement key
gcloud alpha services api-keys create \
  --display-name="marketing-vertex-key-emergency-$(date +%Y%m%d)" \
  --project=marketing-vertex-ai \
  --api-target=service=aiplatform.googleapis.com
```

**Step 3: Update All Systems**
```bash
# Update environment variables
# Update secret managers
# Update CI/CD pipelines
# Notify all users
```

**Step 4: Monitor for Abuse**
```bash
# Check usage logs for anomalies
gcloud logging read \
  "resource.type=aiplatform.googleapis.com/Endpoint" \
  --project=marketing-vertex-ai \
  --limit=1000 \
  --format=json > usage-logs.json

# Analyze for:
# - Unusual IP addresses
# - High request volumes
# - Requests outside business hours
# - Requests to unexpected models
```

### Investigation (Within 24 hours)

**Step 5: Determine Scope of Compromise**
- How was the key exposed? (git commit, logs, screenshot, etc.)
- Who had access to the key?
- What systems used the key?
- What data was accessed?

**Step 6: Review Audit Logs**
```bash
# Admin activity logs
gcloud logging read \
  "protoPayload.serviceName=cloudresourcemanager.googleapis.com" \
  --project=marketing-vertex-ai \
  --limit=1000

# Data access logs (if enabled)
gcloud logging read \
  "protoPayload.methodName=~'aiplatform.*'" \
  --project=marketing-vertex-ai \
  --limit=1000
```

### Remediation (Within 1 week)

**Step 7: Implement Preventive Measures**
- Add git hooks to prevent key commits
- Implement secret scanning in CI/CD
- Review access controls
- Update security training

**Step 8: Document Incident**
```markdown
# Incident Report: API Key Compromise

**Date:** 2026-01-20
**Project:** marketing-vertex-ai
**Severity:** High

## Summary
API key was accidentally committed to public GitHub repository.

## Timeline
- 10:00 - Key committed to repo
- 10:15 - Exposed on GitHub
- 11:30 - Compromise detected
- 11:35 - Key revoked
- 11:40 - New key deployed
- 12:00 - Monitoring for abuse

## Root Cause
Developer committed .env file without checking .gitignore.

## Impact
Potential unauthorized access for 1.5 hours. No abuse detected in logs.

## Remediation
- Implemented git hooks to prevent credential commits
- Added .env to .gitignore template
- Updated developer onboarding to cover secret management

## Lessons Learned
- Need automated secret scanning in CI/CD
- Consider using Secret Manager instead of .env files
```

---

## Audit and Monitoring

### Enable Audit Logs

```bash
# Enable Data Access logs (generates costs)
gcloud logging settings update \
  --project=marketing-vertex-ai \
  --enable-data-access
```

### Monitor API Key Usage

**Set up log-based metrics:**
```bash
# Create metric for API key usage
gcloud logging metrics create vertex_api_calls \
  --description="Count of Vertex AI API calls" \
  --project=marketing-vertex-ai \
  --log-filter='resource.type="aiplatform.googleapis.com/Endpoint"'
```

**Set up alerting:**
```bash
# Create alert for unusual usage
gcloud alpha monitoring policies create \
  --notification-channels=${CHANNEL_ID} \
  --display-name="High Vertex AI Usage" \
  --condition-threshold-value=1000 \
  --condition-threshold-duration=3600s \
  --condition-filter='metric.type="logging.googleapis.com/user/vertex_api_calls"'
```

### Regular Access Reviews

**Quarterly Review Checklist:**
- [ ] Review who has project creator permissions
- [ ] Audit all Vertex AI projects
- [ ] Check API key creation dates
- [ ] Verify billing account usage
- [ ] Review IAM bindings
- [ ] Check for unused projects (delete if > 90 days inactive)

```bash
# List all users with project creator role
gcloud resource-manager folders get-iam-policy ${FOLDER_ID} \
  --flatten="bindings[].members" \
  --filter="bindings.role:roles/resourcemanager.projectCreator" \
  --format="table(bindings.members)"
```

---

## Network Security

### VPC Service Controls (Advanced)

For highly sensitive workloads, use VPC Service Controls:

```bash
# Create access policy
gcloud access-context-manager policies create \
  --organization=${ORG_ID} \
  --title="Vertex AI Policy"

# Create perimeter
gcloud access-context-manager perimeters create vertex_perimeter \
  --title="Vertex AI Perimeter" \
  --resources=projects/${PROJECT_NUMBER} \
  --restricted-services=aiplatform.googleapis.com \
  --policy=${POLICY_ID}
```

### Private Google Access

For projects that need to access Vertex AI without internet:

```bash
# Enable Private Google Access on subnet
gcloud compute networks subnets update ${SUBNET_NAME} \
  --region=${REGION} \
  --enable-private-ip-google-access
```

---

## Security Checklist

**Before Provisioning:**
- [ ] GCP_FOLDER_ID is set and correct
- [ ] GCP_BILLING_ACCOUNT is set and correct
- [ ] User has minimum required permissions
- [ ] .gitignore includes .env and credentials/

**During Provisioning:**
- [ ] API keys are restricted to aiplatform.googleapis.com only
- [ ] API keys are truncated in logs and chat
- [ ] Full keys only shown in shareable snippet (user copies once)

**After Provisioning:**
- [ ] API key stored securely (env file in .gitignore or Secret Manager)
- [ ] Key rotation calendar entry created (90 days)
- [ ] Access granted only to authorized users
- [ ] Audit logs enabled and monitored

**Ongoing:**
- [ ] Quarterly key rotation
- [ ] Quarterly permission review
- [ ] Monitor usage logs for anomalies
- [ ] Unused projects deleted after 90 days

---

## Additional Resources

- [GCP Security Best Practices](https://cloud.google.com/security/best-practices)
- [API Key Security](https://cloud.google.com/docs/authentication/api-keys)
- [Service Account Best Practices](https://cloud.google.com/iam/docs/best-practices-service-accounts)
- [Secret Manager Guide](https://cloud.google.com/secret-manager/docs)
- [VPC Service Controls](https://cloud.google.com/vpc-service-controls/docs)
