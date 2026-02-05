# Provision Bedrock - Examples

This document provides 7 detailed examples of using the `/provisioning-bedrock` skill.

## Contents

1. [Basic Provisioning (First Time)](#example-1-basic-provisioning-first-time)
2. [Create API Key Only (Existing IAM User)](#example-2-create-api-key-only-existing-iam-user)
3. [Idempotent Re-run (Already Exists)](#example-3-idempotent-re-run-already-exists)
4. [List All Bedrock Configurations](#example-4-list-all-bedrock-configurations)
5. [Get IAM User Details](#example-5-get-iam-user-details)
6. [Rotate API Key](#example-6-rotate-api-key)
7. [Error Handling (Permission Denied)](#example-7-error-handling-permission-denied)

---

## Example 1: Basic Provisioning (First Time)

**User Input:**
```
/provisioning-bedrock create access for Marketing, owner: marketing@company.com
```

**Skill Execution Flow:**

### Step 1: Parse Input
```
Extracted parameters:
  business_unit: "marketing"
  owner_email: "marketing@company.com"
  iam_user_name: "marketing-bedrock-user"
  region: "us-east-1" (default)
```

### Step 2: Check Model Access
```
Natural language: "Check if Bedrock model access is enabled for Anthropic Claude models in us-east-1"

Response:
{
  "models": [
    {
      "modelId": "anthropic.claude-sonnet-4-5-v2:0",
      "modelName": "Claude Sonnet 4.5",
      "providerName": "Anthropic",
      "customizationsSupported": ["FINE_TUNING"],
      "inferenceTypesSupported": ["ON_DEMAND"],
      "modelLifecycle": {
        "status": "ACTIVE"
      }
    },
    {
      "modelId": "anthropic.claude-opus-4-5-v1:0",
      "modelName": "Claude Opus 4.5",
      "providerName": "Anthropic",
      "inferenceTypesSupported": ["ON_DEMAND"],
      "modelLifecycle": {
        "status": "ACTIVE"
      }
    }
  ]
}

Result: ✓ Claude models are enabled in us-east-1
```

### Step 3: Check IAM User Existence
```
Natural language: "Check if IAM user marketing-bedrock-user exists"

Response:
Error: NoSuchEntity - User marketing-bedrock-user does not exist

Result: User doesn't exist, proceed with creation
```

### Step 4: Create IAM User
```
Natural language: "Create IAM user marketing-bedrock-user with tags business-unit=marketing, purpose=bedrock, owner=marketing@company.com, created-by=provisioning-bedrock-skill"

Response:
{
  "User": {
    "UserName": "marketing-bedrock-user",
    "UserId": "AIDACKCEVSQ6C2EXAMPLE",
    "Arn": "arn:aws:iam::123456789012:user/marketing-bedrock-user",
    "CreateDate": "2026-01-24T10:30:00Z",
    "Tags": [
      {"Key": "business-unit", "Value": "marketing"},
      {"Key": "purpose", "Value": "bedrock"},
      {"Key": "owner", "Value": "marketing@company.com"},
      {"Key": "created-by", "Value": "provisioning-bedrock-skill"}
    ]
  }
}

Result: ✓ IAM user created
```

### Step 5: Attach IAM Policy
```
Natural language: "Attach AmazonBedrockFullAccess policy to IAM user marketing-bedrock-user"

Response:
{
  "ResponseMetadata": {
    "RequestId": "EXAMPLE-REQUEST-ID",
    "HTTPStatusCode": 200
  }
}

Result: ✓ Policy attached
```

### Step 6: Create Bedrock API Key
```
Natural language: "Create service-specific credential for IAM user marketing-bedrock-user for bedrock.amazonaws.com with 30-day expiration"

Response:
{
  "ServiceSpecificCredential": {
    "CreateDate": "2026-01-24T10:32:00Z",
    "ServiceName": "bedrock.amazonaws.com",
    "ServiceUserName": "marketing-bedrock-user-at-123456789012",
    "ServicePassword": "bdk_v1_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz",
    "ServiceSpecificCredentialId": "ACCACKCEVSQEXAMPLE",
    "UserName": "marketing-bedrock-user",
    "Status": "Active"
  }
}

Extracted API Key: bdk_v1_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz

Result: ✓ API key created
```

### Step 7: Format Output

**Claude Response to User:**
```markdown
✓ Bedrock access provisioned for Marketing

**IAM User:** marketing-bedrock-user
**Region:** us-east-1
**API Key:** bdk_v1_abc12...
**Expires:** 2026-02-23

## Quick Setup (copy/paste)
export AWS_BEDROCK_API_KEY="bdk_v1_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz"
export AWS_REGION="us-east-1"
export ANTHROPIC_API_KEY="bdk_v1_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz"

## Available Models
- Claude Sonnet 4.5: anthropic.claude-sonnet-4-5-v2:0
- Claude Opus 4.5: anthropic.claude-opus-4-5-v1:0
- Claude Haiku 4.5: anthropic.claude-haiku-4-5-v1:0

## Test Command (Python)
pip install anthropic
python -c "
from anthropic import AnthropicBedrock
import os

client = AnthropicBedrock(
    aws_region=os.environ['AWS_REGION']
)

message = client.messages.create(
    model='anthropic.claude-sonnet-4-5-v2:0',
    max_tokens=100,
    messages=[{'role': 'user', 'content': 'Hello, Claude!'}]
)
print(message.content[0].text)
"

## Security Reminder
⚠️ **Important:** Store this API key securely. It will not be retrievable later.
- Add to `.env` file and ensure `.env` is in `.gitignore`
- Never commit API keys to version control
- Rotate every 30 days (expiration: 2026-02-23)
- Consider using AWS Secrets Manager for production

## Cost Tracking
This IAM user is tagged with:
- business-unit: marketing
- purpose: bedrock
- owner: marketing@company.com

Query costs in AWS Cost Explorer by filtering on these tags.
```

---

## Example 2: Create API Key Only (Existing IAM User)

**User Input:**
```
/provisioning-bedrock create key for marketing
```

**Skill Execution Flow:**

### Step 1: Parse Input
```
Extracted parameters:
  business_unit: "marketing"
  iam_user_name: "marketing-bedrock-user"
```

### Step 2: Verify IAM User Exists
```
Natural language: "Check if IAM user marketing-bedrock-user exists"

Response:
{
  "User": {
    "UserName": "marketing-bedrock-user",
    "UserId": "AIDACKCEVSQ6C2EXAMPLE",
    "Arn": "arn:aws:iam::123456789012:user/marketing-bedrock-user",
    "CreateDate": "2026-01-24T10:30:00Z",
    "Tags": [
      {"Key": "business-unit", "Value": "marketing"},
      {"Key": "purpose", "Value": "bedrock"},
      {"Key": "owner", "Value": "marketing@company.com"}
    ]
  }
}

Result: ✓ IAM user exists
```

### Step 3: List Existing API Keys
```
Natural language: "List service-specific credentials for IAM user marketing-bedrock-user for service bedrock.amazonaws.com"

Response:
{
  "ServiceSpecificCredentials": [
    {
      "UserName": "marketing-bedrock-user",
      "Status": "Active",
      "ServiceUserName": "marketing-bedrock-user-at-123456789012",
      "CreateDate": "2026-01-24T10:32:00Z",
      "ServiceSpecificCredentialId": "ACCACKCEVSQEXAMPLE",
      "ServiceName": "bedrock.amazonaws.com"
    }
  ]
}

Result: Found 1 existing key (created 2026-01-24)
```

### Step 4: Create New API Key
```
Natural language: "Create service-specific credential for IAM user marketing-bedrock-user for bedrock.amazonaws.com with 30-day expiration"

Response:
{
  "ServiceSpecificCredential": {
    "CreateDate": "2026-01-24T15:00:00Z",
    "ServiceName": "bedrock.amazonaws.com",
    "ServiceUserName": "marketing-bedrock-user-at-123456789012",
    "ServicePassword": "bdk_v1_xyz789uvw456rst123opq890lmn567ijk234hgf901cde678ab",
    "ServiceSpecificCredentialId": "ACCBCKCEVSQEXAMPLE",
    "UserName": "marketing-bedrock-user",
    "Status": "Active"
  }
}

Result: ✓ New API key created
```

### Step 5: Format Output

**Claude Response to User:**
```markdown
✓ New API key created for Marketing

**IAM User:** marketing-bedrock-user
**Region:** us-east-1
**API Key:** bdk_v1_xyz78...
**Expires:** 2026-02-23

## Quick Setup (copy/paste)
export AWS_BEDROCK_API_KEY="bdk_v1_xyz789uvw456rst123opq890lmn567ijk234hgf901cde678ab"
export AWS_REGION="us-east-1"
export ANTHROPIC_API_KEY="bdk_v1_xyz789uvw456rst123opq890lmn567ijk234hgf901cde678ab"

## Available Models
- Claude Sonnet 4.5: anthropic.claude-sonnet-4-5-v2:0
- Claude Opus 4.5: anthropic.claude-opus-4-5-v1:0
- Claude Haiku 4.5: anthropic.claude-haiku-4-5-v1:0

## Note
You now have 2 active API keys for this IAM user. Consider rotating/deleting the old key if no longer needed:
- Old key created: 2026-01-24 10:32 UTC
- New key created: 2026-01-24 15:00 UTC

To delete old key: `/provisioning-bedrock rotate key for marketing`
```

---

## Example 3: Idempotent Re-run (Already Exists)

**User Input:**
```
/provisioning-bedrock create access for Marketing, owner: marketing@company.com
```

**Skill Execution Flow:**

### Step 1: Parse Input
```
Extracted parameters:
  business_unit: "marketing"
  owner_email: "marketing@company.com"
  iam_user_name: "marketing-bedrock-user"
```

### Step 2: Check IAM User Existence
```
Natural language: "Check if IAM user marketing-bedrock-user exists"

Response:
{
  "User": {
    "UserName": "marketing-bedrock-user",
    "UserId": "AIDACKCEVSQ6C2EXAMPLE",
    "Arn": "arn:aws:iam::123456789012:user/marketing-bedrock-user",
    "CreateDate": "2026-01-24T10:30:00Z",
    "Tags": [
      {"Key": "business-unit", "Value": "marketing"},
      {"Key": "purpose", "Value": "bedrock"}
    ]
  }
}

Result: IAM user already exists
```

### Step 3: Format Output

**Claude Response to User:**
```markdown
✓ Bedrock IAM user already exists for Marketing

**IAM User:** marketing-bedrock-user
**Region:** us-east-1
**Created:** 2026-01-24

Note: This IAM user was previously created. API keys cannot be retrieved after creation for security reasons.

To create a new API key:
- Run: `/provisioning-bedrock create key for marketing`

To rotate API key (create new, delete old):
- Run: `/provisioning-bedrock rotate key for marketing`

## Cost Tracking
Query costs in AWS Cost Explorer by filtering on tag: business-unit=marketing
```

---

## Example 4: List All Bedrock Configurations

**User Input:**
```
/provisioning-bedrock list all configurations
```

**Skill Execution Flow:**

### Step 1: List IAM Users with Bedrock Tag
```
Natural language: "List all IAM users with tag purpose=bedrock"

Response:
{
  "Users": [
    {
      "UserName": "marketing-bedrock-user",
      "Arn": "arn:aws:iam::123456789012:user/marketing-bedrock-user",
      "CreateDate": "2026-01-24T10:30:00Z",
      "Tags": [
        {"Key": "business-unit", "Value": "marketing"},
        {"Key": "purpose", "Value": "bedrock"},
        {"Key": "owner", "Value": "marketing@company.com"}
      ]
    },
    {
      "UserName": "sales-bedrock-user",
      "Arn": "arn:aws:iam::123456789012:user/sales-bedrock-user",
      "CreateDate": "2026-01-20T14:20:00Z",
      "Tags": [
        {"Key": "business-unit", "Value": "sales"},
        {"Key": "purpose", "Value": "bedrock"},
        {"Key": "owner", "Value": "sales@company.com"}
      ]
    },
    {
      "UserName": "engineering-bedrock-user",
      "Arn": "arn:aws:iam::123456789012:user/engineering-bedrock-user",
      "CreateDate": "2026-01-15T09:15:00Z",
      "Tags": [
        {"Key": "business-unit", "Value": "engineering"},
        {"Key": "purpose", "Value": "bedrock"}
      ]
    }
  ]
}

Result: Found 3 Bedrock configurations
```

### Step 2: Format Output

**Claude Response to User:**
```markdown
## Bedrock IAM Configurations

| Business Unit | IAM User | Owner | Created |
|---------------|----------|-------|---------|
| Marketing | marketing-bedrock-user | marketing@company.com | 2026-01-24 |
| Sales | sales-bedrock-user | sales@company.com | 2026-01-20 |
| Engineering | engineering-bedrock-user | (none) | 2026-01-15 |

**Total:** 3 configurations

**Region:** us-east-1 (default)

To get details on a specific configuration:
- Run: `/provisioning-bedrock get details for marketing`

To create a new API key for existing configuration:
- Run: `/provisioning-bedrock create key for [business-unit]`
```

---

## Example 5: Get IAM User Details

**User Input:**
```
/provisioning-bedrock get details for marketing
```

**Skill Execution Flow:**

### Step 1: Parse Input
```
Extracted parameters:
  business_unit: "marketing"
  iam_user_name: "marketing-bedrock-user"
```

### Step 2: Get IAM User Details
```
Natural language: "Get details for IAM user marketing-bedrock-user including tags"

Response:
{
  "User": {
    "UserName": "marketing-bedrock-user",
    "UserId": "AIDACKCEVSQ6C2EXAMPLE",
    "Arn": "arn:aws:iam::123456789012:user/marketing-bedrock-user",
    "CreateDate": "2026-01-24T10:30:00Z",
    "Tags": [
      {"Key": "business-unit", "Value": "marketing"},
      {"Key": "purpose", "Value": "bedrock"},
      {"Key": "owner", "Value": "marketing@company.com"},
      {"Key": "created-by", "Value": "provisioning-bedrock-skill"}
    ]
  }
}
```

### Step 3: List Attached Policies
```
Natural language: "List policies attached to IAM user marketing-bedrock-user"

Response:
{
  "AttachedPolicies": [
    {
      "PolicyName": "AmazonBedrockFullAccess",
      "PolicyArn": "arn:aws:iam::aws:policy/AmazonBedrockFullAccess"
    }
  ]
}
```

### Step 4: List API Keys
```
Natural language: "List service-specific credentials for IAM user marketing-bedrock-user"

Response:
{
  "ServiceSpecificCredentials": [
    {
      "UserName": "marketing-bedrock-user",
      "Status": "Active",
      "CreateDate": "2026-01-24T10:32:00Z",
      "ServiceSpecificCredentialId": "ACCACKCEVSQEXAMPLE",
      "ServiceName": "bedrock.amazonaws.com"
    },
    {
      "UserName": "marketing-bedrock-user",
      "Status": "Active",
      "CreateDate": "2026-01-24T15:00:00Z",
      "ServiceSpecificCredentialId": "ACCBCKCEVSQEXAMPLE",
      "ServiceName": "bedrock.amazonaws.com"
    }
  ]
}
```

### Step 5: Format Output

**Claude Response to User:**
```markdown
## Marketing Bedrock Configuration

**IAM User:** marketing-bedrock-user
**User ID:** AIDACKCEVSQ6C2EXAMPLE
**ARN:** arn:aws:iam::123456789012:user/marketing-bedrock-user
**Created:** 2026-01-24 10:30 UTC

### Tags
- business-unit: marketing
- purpose: bedrock
- owner: marketing@company.com
- created-by: provisioning-bedrock-skill

### IAM Policies
✓ AmazonBedrockFullAccess (managed policy)

### API Keys
- Key 1: Created 2026-01-24 10:32 UTC (Active)
- Key 2: Created 2026-01-24 15:00 UTC (Active)

**Total:** 2 active API keys

**Note:** API key values cannot be retrieved after creation for security reasons.

To create a new key: `/provisioning-bedrock create key for marketing`
To rotate keys: `/provisioning-bedrock rotate key for marketing`
```

---

## Example 6: Rotate API Key

**User Input:**
```
/provisioning-bedrock rotate key for marketing
```

**Skill Execution Flow:**

### Step 1: Parse Input
```
Extracted parameters:
  business_unit: "marketing"
  iam_user_name: "marketing-bedrock-user"
  intent: "rotate_key"
```

### Step 2: List Current API Keys
```
Natural language: "List service-specific credentials for IAM user marketing-bedrock-user"

Response:
{
  "ServiceSpecificCredentials": [
    {
      "UserName": "marketing-bedrock-user",
      "Status": "Active",
      "CreateDate": "2026-01-24T10:32:00Z",
      "ServiceSpecificCredentialId": "ACCACKCEVSQEXAMPLE",
      "ServiceName": "bedrock.amazonaws.com"
    }
  ]
}

Result: Found 1 existing key to rotate
```

### Step 3: Create New API Key
```
Natural language: "Create service-specific credential for IAM user marketing-bedrock-user for bedrock.amazonaws.com with 30-day expiration"

Response:
{
  "ServiceSpecificCredential": {
    "CreateDate": "2026-01-24T16:00:00Z",
    "ServiceName": "bedrock.amazonaws.com",
    "ServicePassword": "bdk_v1_new123key456abc789def012ghi345jkl678mno901pqr234st",
    "ServiceSpecificCredentialId": "ACCCCKCEVSQEXAMPLE",
    "UserName": "marketing-bedrock-user",
    "Status": "Active"
  }
}

Result: ✓ New API key created
```

### Step 4: Delete Old API Key
```
Ask user: "New API key created. Delete old key (created 2026-01-24 10:32 UTC)? This will invalidate any systems using it."

User confirms: Yes

Natural language: "Delete service-specific credential ACCACKCEVSQEXAMPLE for IAM user marketing-bedrock-user"

Response:
{
  "ResponseMetadata": {
    "HTTPStatusCode": 200
  }
}

Result: ✓ Old key deleted
```

### Step 5: Format Output

**Claude Response to User:**
```markdown
✓ API key rotated for Marketing

**New API Key:** bdk_v1_new12...
**Expires:** 2026-02-23

## Quick Setup (copy/paste)
export AWS_BEDROCK_API_KEY="bdk_v1_new123key456abc789def012ghi345jkl678mno901pqr234st"
export AWS_REGION="us-east-1"
export ANTHROPIC_API_KEY="bdk_v1_new123key456abc789def012ghi345jkl678mno901pqr234st"

## Important
⚠️ The old API key has been deleted and will no longer work.

**Next steps:**
1. Update this key in all systems that use it
2. Test with the command above to verify access
3. Update production environment variables
4. Clear any cached credentials

**Rotation completed:**
- Old key (2026-01-24 10:32): DELETED
- New key (2026-01-24 16:00): ACTIVE
```

---

## Example 7: Error Handling (Permission Denied)

**User Input:**
```
/provisioning-bedrock create access for Marketing
```

**Skill Execution Flow:**

### Step 1: Parse Input
```
Extracted parameters:
  business_unit: "marketing"
  iam_user_name: "marketing-bedrock-user"
```

### Step 2: Check Model Access (SUCCESS)
```
Natural language: "Check if Bedrock model access is enabled for Claude in us-east-1"

Result: ✓ Models enabled
```

### Step 3: Create IAM User (ERROR)
```
Natural language: "Create IAM user marketing-bedrock-user"

Error Response:
{
  "Error": {
    "Code": "AccessDenied",
    "Message": "User: arn:aws:iam::123456789012:user/john is not authorized to perform: iam:CreateUser on resource: user marketing-bedrock-user with an explicit deny"
  }
}

Result: ✗ Permission denied
```

### Step 4: Format Error Response

**Claude Response to User:**
```markdown
✗ Failed to provision Bedrock access for Marketing

**Error:** Permission denied

Your AWS identity (arn:aws:iam::123456789012:user/john) doesn't have permission to create IAM users.

## How to Fix

**Option 1: Request IAM Permissions**
Ask your AWS administrator to grant you the following IAM permissions:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "iam:CreateUser",
        "iam:AttachUserPolicy",
        "iam:TagUser",
        "iam:CreateServiceSpecificCredential"
      ],
      "Resource": "*"
    }
  ]
}
```

**Option 2: Use Different AWS Credentials**
If you have another AWS profile with appropriate permissions:
```bash
export AWS_PROFILE="admin-profile"
```

Then re-run the provisioning command.

## Required Permissions

To use this skill, you need IAM permissions for:
- `iam:CreateUser` - Create IAM users
- `iam:AttachUserPolicy` - Attach Bedrock policies
- `iam:TagUser` - Add cost tracking tags
- `iam:CreateServiceSpecificCredential` - Generate API keys
- `bedrock:ListFoundationModels` - Check model access

## Verify Your Permissions
```bash
# Check your current identity
aws sts get-caller-identity

# Check your IAM policies
aws iam list-attached-user-policies --user-name john
```

## Need Help?
- See [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- Contact: AWS Administrator
```

---

## Summary of Examples

| Example | Scenario | Key Learning |
|---------|----------|--------------|
| 1 | Basic Provisioning | Full provisioning flow with shareable snippet |
| 2 | API Key Only | Create additional key for existing IAM user |
| 3 | Idempotent Re-run | Safe to re-run, detects existing resources |
| 4 | List Configurations | View all Bedrock IAM users |
| 5 | Get Details | Detailed view of specific configuration |
| 6 | Rotate API Key | Create new key and delete old one |
| 7 | Error Handling | Helpful error messages with remediation steps |

## Testing Checklist

After implementing this skill, test these scenarios:

- [ ] Create new Bedrock access (Example 1)
- [ ] Create API key for existing IAM user (Example 2)
- [ ] Re-run provisioning for existing user (Example 3)
- [ ] List all configurations (Example 4)
- [ ] Get details for specific configuration (Example 5)
- [ ] Rotate an API key (Example 6)
- [ ] Trigger a permission error (Example 7)
- [ ] Test in different AWS region (us-west-2)
- [ ] Verify cost tracking tags appear in Cost Explorer
- [ ] Test API key with actual Bedrock inference call
