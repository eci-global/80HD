# Troubleshooting AWS Bedrock Provisioning

This document provides solutions to common issues when using the provisioning-bedrock skill.

## Common Issues

### 1. AWS Credentials Not Configured

**Symptom:**
```
Error: Unable to locate credentials. You can configure credentials by running "aws configure"
```

**Cause:**
AWS CLI credentials are not configured.

**Solution:**
```bash
# Option 1: Configure default credentials
aws configure
# Enter: Access Key ID, Secret Access Key, Region (us-east-1), Output format (json)

# Option 2: Use environment variables
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_REGION="us-east-1"

# Option 3: Use AWS CLI profile
aws configure --profile bedrock-provisioner
export AWS_PROFILE="bedrock-provisioner"

# Verify credentials work
aws sts get-caller-identity
```

**Expected output:**
```json
{
  "UserId": "AIDACKCEVSQ6C2EXAMPLE",
  "Account": "123456789012",
  "Arn": "arn:aws:iam::123456789012:user/your-name"
}
```

---

### 2. Permission Denied (IAM)

**Symptom:**
```
Error: User: arn:aws:iam::123456789012:user/john is not authorized to perform: iam:CreateUser
```

**Cause:**
Your AWS credentials don't have permission to create IAM users.

**Solution:**

**Option A: Request permissions from AWS administrator**

Ask your AWS admin to attach this policy to your user:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "iam:CreateUser",
        "iam:GetUser",
        "iam:TagUser",
        "iam:AttachUserPolicy",
        "iam:CreateServiceSpecificCredential",
        "iam:ListServiceSpecificCredentials",
        "bedrock:ListFoundationModels",
        "bedrock:InvokeModel"
      ],
      "Resource": "*"
    }
  ]
}
```

**Option B: Use different AWS credentials**
```bash
# Switch to admin profile
export AWS_PROFILE="admin"

# Verify new identity
aws sts get-caller-identity
```

**Check your current permissions:**
```bash
# See what policies are attached to your user
aws iam list-attached-user-policies --user-name your-username

# See inline policies
aws iam list-user-policies --user-name your-username
```

---

### 3. Bedrock Model Access Not Enabled

**Symptom:**
```
Error: You don't have access to the model with the specified model ID
```

Or when checking models:
```
Response: { "models": [] }
```

**Cause:**
Bedrock model access not enabled in your AWS region.

**Solution:**

**Step 1: Check model access status**
```bash
aws bedrock list-foundation-models --region us-east-1 \
  --by-provider Anthropic

# Should see Claude models listed
```

**Step 2: Enable model access (Console - Recommended)**
```
1. Go to AWS Console → Bedrock
2. Select "Model access" in left sidebar
3. Click "Manage model access"
4. Check boxes for:
   - Anthropic Claude Sonnet 4.5
   - Anthropic Claude Opus 4.5
   - Anthropic Claude Haiku 4.5
5. Click "Request model access"
6. Wait for approval (usually instant, sometimes requires manual review)
```

**Step 3: Verify access**
```bash
aws bedrock list-foundation-models --region us-east-1 \
  --by-provider Anthropic

# Should now see models with status: ACTIVE
```

**Note:** As of 2025-2026, some regions have automatic model access. If you still don't see models, contact AWS Support.

---

### 4. IAM User Already Exists

**Symptom:**
```
Error: EntityAlreadyExists - User with name marketing-bedrock-user already exists
```

**Cause:**
The IAM user was previously created (skill is idempotent and should handle this).

**Solution:**

**Option A: Create API key for existing user**
```
/provisioning-bedrock create key for marketing
```

**Option B: Choose different name**
```
/provisioning-bedrock create access for marketing-team-2
```

**Option C: Delete and recreate (CAUTION)**
```bash
# First, delete all API keys for the user
aws iam list-service-specific-credentials \
  --user-name marketing-bedrock-user

# Delete each key
aws iam delete-service-specific-credential \
  --user-name marketing-bedrock-user \
  --service-specific-credential-id ACCACKCEVSQEXAMPLE

# Detach policies
aws iam detach-user-policy \
  --user-name marketing-bedrock-user \
  --policy-arn arn:aws:iam::aws:policy/AmazonBedrockFullAccess

# Delete user
aws iam delete-user --user-name marketing-bedrock-user

# Now re-run provisioning
/provisioning-bedrock create access for marketing
```

---

### 5. API Key Not Working

**Symptom:**
```python
# When testing with Python SDK
AnthropicError: 401 Unauthorized
```

Or:
```
Error: The security token included in the request is invalid
```

**Cause:**
API key is incorrect, expired, or not configured properly.

**Diagnosis:**

**Check 1: Verify API key format**
```bash
# Bedrock API keys start with "bdk_v1_"
echo $AWS_BEDROCK_API_KEY
# Should output: bdk_v1_abc123...

# If not set or wrong format, API calls will fail
```

**Check 2: Verify API key is active**
```bash
aws iam list-service-specific-credentials \
  --user-name marketing-bedrock-user

# Look for:
# - Status: Active (not Inactive)
# - CreateDate: Not more than 30 days ago (expiration)
```

**Check 3: Test with AWS CLI**
```bash
# This should work if API key is valid
export AWS_BEDROCK_API_KEY="bdk_v1_..."
export AWS_REGION="us-east-1"

# Unfortunately, AWS CLI doesn't support Bedrock API keys directly
# Must test with SDK (Python, JavaScript, etc.)
```

**Solution:**

**If expired:**
```
/provisioning-bedrock rotate key for marketing
```

**If inactive:**
```bash
aws iam update-service-specific-credential \
  --user-name marketing-bedrock-user \
  --service-specific-credential-id ACCACKCEVSQEXAMPLE \
  --status Active
```

**If lost/unknown:**
```
# API keys cannot be retrieved after creation
# Must create new key
/provisioning-bedrock create key for marketing
```

---

### 6. Region Mismatch

**Symptom:**
```
Error: Could not connect to the endpoint URL
```

Or models not available when trying to invoke.

**Cause:**
Your AWS_REGION doesn't match where you enabled Bedrock models.

**Diagnosis:**
```bash
# Check current region
echo $AWS_REGION

# Check where models are enabled
aws bedrock list-foundation-models --region us-east-1 --by-provider Anthropic
aws bedrock list-foundation-models --region us-west-2 --by-provider Anthropic

# Compare which region has models
```

**Solution:**
```bash
# Set region to where models are enabled (usually us-east-1)
export AWS_REGION="us-east-1"

# Re-test
python test_bedrock.py
```

**Available Bedrock regions:**
- us-east-1 (N. Virginia) - Most models
- us-west-2 (Oregon)
- eu-west-1 (Ireland)
- ap-southeast-1 (Singapore)
- Others (check AWS documentation for latest)

---

### 7. Rate Limiting / Throttling

**Symptom:**
```
Error: Rate exceeded for invokeModel
```

Or:
```
ThrottlingException: Rate exceeded
```

**Cause:**
Too many Bedrock API calls in short time period.

**Default Limits (varies by model and region):**
- Requests per minute: 10-100 (varies)
- Tokens per minute: 10,000-100,000 (varies)

**Solution:**

**Option A: Implement exponential backoff**
```python
import time
from anthropic import AnthropicBedrock

def invoke_with_retry(client, max_retries=5):
    for attempt in range(max_retries):
        try:
            response = client.messages.create(
                model="anthropic.claude-sonnet-4-5-v2:0",
                max_tokens=100,
                messages=[{"role": "user", "content": "Hello"}]
            )
            return response
        except Exception as e:
            if "Rate exceeded" in str(e) and attempt < max_retries - 1:
                wait_time = 2 ** attempt  # Exponential backoff: 1s, 2s, 4s, 8s, 16s
                print(f"Rate limited. Retrying in {wait_time}s...")
                time.sleep(wait_time)
            else:
                raise
```

**Option B: Request limit increase**
```bash
# Go to AWS Service Quotas
# Search for "Bedrock"
# Request increase for:
# - InvokeModel request rate
# - InvokeModel token rate

# Or via CLI
aws service-quotas request-service-quota-increase \
  --service-code bedrock \
  --quota-code L-xxx \
  --desired-value 1000
```

**Option C: Distribute load**
```
- Use multiple API keys (separate IAM users)
- Rate limit on client side
- Implement queueing system
```

---

### 8. Cost Explorer Not Showing Bedrock Costs

**Symptom:**
No Bedrock costs appear in Cost Explorer, even after using Bedrock.

**Cause:**
- Tags not applied correctly
- Cost allocation tags not enabled
- Costs too recent (Cost Explorer has 24-hour delay)

**Solution:**

**Step 1: Verify tags on IAM user**
```bash
aws iam get-user --user-name marketing-bedrock-user

# Should show tags:
# - business-unit
# - purpose
# - owner
```

**Step 2: Enable cost allocation tags (one-time setup)**
```bash
# Go to AWS Billing Console → Cost Allocation Tags
# Activate tags:
# - business-unit
# - purpose
# - owner

# Or via CLI
aws ce list-cost-allocation-tags

aws ce update-cost-allocation-tags \
  --cost-allocation-tag-keys '["business-unit", "purpose", "owner"]' \
  --status Active
```

**Step 3: Wait 24 hours**
```
Cost Explorer updates once per day
Costs from today may not appear until tomorrow
```

**Step 4: Query costs**
```bash
# After 24 hours, query by tag
aws ce get-cost-and-usage \
  --time-period Start=2026-01-01,End=2026-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --filter file://filter.json

# filter.json:
{
  "And": [
    {
      "Tags": {
        "Key": "business-unit",
        "Values": ["marketing"]
      }
    },
    {
      "Dimensions": {
        "Key": "SERVICE",
        "Values": ["Amazon Bedrock"]
      }
    }
  ]
}
```

---

### 9. AWS MCP Server Connection Issues

**Symptom:**
```
Error: Failed to connect to AWS MCP Server
```

Or skill commands don't execute.

**Cause:**
- MCP server not configured in .mcp.json
- AWS credentials not available to MCP server
- Network connectivity issues

**Solution:**

**Step 1: Verify MCP server configured**
```bash
cat .mcp.json | grep -A 10 '"aws"'

# Should show:
# "aws": {
#   "command": "npx",
#   "args": ["-y", "mcp-proxy-for-aws@latest"],
#   "env": {"AWS_REGION": "us-east-1"}
# }
```

**Step 2: Test AWS MCP server manually**
```bash
# Try running MCP server directly
npx -y mcp-proxy-for-aws@latest

# Should start without errors
```

**Step 3: Verify AWS credentials available**
```bash
# MCP server needs AWS credentials from environment or .aws/credentials
aws sts get-caller-identity

# If this works, MCP server should have access too
```

**Step 4: Restart Claude Code**
```bash
# Sometimes MCP server needs restart to pick up config changes
# Exit and restart Claude Code CLI
```

---

### 10. Model Not Available in Region

**Symptom:**
```
ValidationException: The provided model identifier is invalid
```

Or:
```
Error: Model anthropic.claude-opus-4-5-v1:0 not found in us-west-2
```

**Cause:**
Specific Claude model not available in your AWS region.

**Diagnosis:**
```bash
# Check which models are available in your region
aws bedrock list-foundation-models \
  --region us-west-2 \
  --by-provider Anthropic

# Compare to us-east-1 (most complete model selection)
aws bedrock list-foundation-models \
  --region us-east-1 \
  --by-provider Anthropic
```

**Solution:**

**Option A: Use different region**
```bash
export AWS_REGION="us-east-1"
```

**Option B: Use different model**
```python
# If Opus not available, use Sonnet
model="anthropic.claude-sonnet-4-5-v2:0"
```

**Option C: Request model access in region**
```
Some models require explicit access request per region
Go to AWS Console → Bedrock → Model Access → Request for specific region
```

**Current Model Availability (as of 2026):**
- us-east-1: All Claude models ✓
- us-west-2: Most Claude models ✓
- eu-west-1: Some Claude models
- Other regions: Check AWS documentation

---

## Diagnostic Commands

**Check AWS Configuration:**
```bash
# Verify credentials
aws sts get-caller-identity

# Verify region
aws configure get region

# List IAM users
aws iam list-users

# Check Bedrock model access
aws bedrock list-foundation-models --region us-east-1 --by-provider Anthropic
```

**Check IAM User:**
```bash
# Get user details
aws iam get-user --user-name marketing-bedrock-user

# Check tags
aws iam list-user-tags --user-name marketing-bedrock-user

# Check attached policies
aws iam list-attached-user-policies --user-name marketing-bedrock-user

# List API keys
aws iam list-service-specific-credentials --user-name marketing-bedrock-user
```

**Test Bedrock Access:**
```python
# test_bedrock.py
from anthropic import AnthropicBedrock
import os

try:
    client = AnthropicBedrock(aws_region=os.environ.get('AWS_REGION', 'us-east-1'))

    message = client.messages.create(
        model="anthropic.claude-sonnet-4-5-v2:0",
        max_tokens=100,
        messages=[{"role": "user", "content": "Say hello"}]
    )

    print("✓ Bedrock access working!")
    print(f"Response: {message.content[0].text}")

except Exception as e:
    print(f"✗ Bedrock access failed: {e}")
```

```bash
# Run test
export AWS_BEDROCK_API_KEY="bdk_v1_..."
export AWS_REGION="us-east-1"
python test_bedrock.py
```

---

## Getting Help

**If you're still stuck:**

1. **Check CloudTrail Logs**
   ```bash
   # See what API calls failed
   aws cloudtrail lookup-events \
     --lookup-attributes AttributeKey=EventName,AttributeValue=InvokeModel \
     --max-results 10
   ```

2. **Review AWS Service Health**
   ```
   https://health.aws.amazon.com/health/status
   Check if Bedrock is experiencing issues in your region
   ```

3. **Contact AWS Support**
   ```
   https://console.aws.amazon.com/support/
   Create a support case with:
   - Error message
   - Region
   - IAM user ARN
   - CloudTrail request ID
   ```

4. **Check Skill Documentation**
   - [SKILL.md](SKILL.md) - Main workflow
   - [EXAMPLES.md](EXAMPLES.md) - Working examples
   - [AWS-COMMANDS.md](AWS-COMMANDS.md) - Command reference
   - [SECURITY.md](SECURITY.md) - Security best practices

5. **GitHub Issues**
   ```
   https://github.com/awslabs/mcp/issues
   Check if others have reported similar issues with AWS MCP Server
   ```

---

## Prevention Checklist

**Before provisioning:**
- [ ] AWS credentials configured (`aws sts get-caller-identity`)
- [ ] IAM permissions verified (can create users, attach policies)
- [ ] Bedrock model access enabled in target region
- [ ] .mcp.json has AWS MCP Server configured
- [ ] Cost allocation tags enabled (if using Cost Explorer)

**After provisioning:**
- [ ] API key stored securely (Secrets Manager, 1Password)
- [ ] API key tested (successfully called Bedrock)
- [ ] IAM user tags verified (business-unit, purpose, owner)
- [ ] Expiration reminder set (30 days)
- [ ] Budget alert configured (optional)

**Ongoing:**
- [ ] Rotate API keys every 30 days
- [ ] Review Cost Explorer monthly
- [ ] Audit IAM users quarterly
- [ ] Monitor CloudTrail for anomalies
