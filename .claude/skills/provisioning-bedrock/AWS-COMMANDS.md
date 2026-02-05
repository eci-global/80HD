# AWS Commands Reference for Bedrock Provisioning

This document provides natural language command patterns for the AWS MCP Server used in the provisioning-bedrock skill.

## Overview

The AWS MCP Server accepts **natural language queries** instead of raw CLI commands. This document shows the patterns used by the skill.

## Bedrock Model Access

### Check Model Access
```
Natural language: "Check if Bedrock model access is enabled for Anthropic Claude models in us-east-1"

Alternative: "List available Bedrock foundation models in us-east-1 from Anthropic"

Expected response:
{
  "models": [
    {
      "modelId": "anthropic.claude-sonnet-4-5-v2:0",
      "modelName": "Claude Sonnet 4.5",
      "providerName": "Anthropic",
      "inferenceTypesSupported": ["ON_DEMAND"],
      "modelLifecycle": {"status": "ACTIVE"}
    },
    ...
  ]
}
```

### Enable Model Access (if needed)
```
Natural language: "Enable Bedrock model access for anthropic.claude-sonnet-4-5-v2:0 in us-east-1"

Note: This may require manual approval in AWS Console for first-time access.
Some regions now have automatic model access (no enablement required).
```

## IAM User Management

### Check if IAM User Exists
```
Natural language: "Check if IAM user marketing-bedrock-user exists"

Alternative: "Get details for IAM user marketing-bedrock-user"

Success response:
{
  "User": {
    "UserName": "marketing-bedrock-user",
    "UserId": "AIDACKCEVSQ6C2EXAMPLE",
    "Arn": "arn:aws:iam::123456789012:user/marketing-bedrock-user",
    "CreateDate": "2026-01-24T10:30:00Z"
  }
}

Error response (user doesn't exist):
{
  "Error": {
    "Code": "NoSuchEntity",
    "Message": "The user with name marketing-bedrock-user cannot be found."
  }
}
```

### Create IAM User
```
Natural language: "Create IAM user marketing-bedrock-user"

Response:
{
  "User": {
    "UserName": "marketing-bedrock-user",
    "UserId": "AIDACKCEVSQ6C2EXAMPLE",
    "Arn": "arn:aws:iam::123456789012:user/marketing-bedrock-user",
    "CreateDate": "2026-01-24T10:30:00Z"
  }
}
```

### Create IAM User with Tags
```
Natural language: "Create IAM user marketing-bedrock-user with tags business-unit=marketing, purpose=bedrock, owner=marketing@company.com, created-by=provisioning-bedrock-skill"

Alternative: "Create IAM user marketing-bedrock-user and tag it with business-unit=marketing and purpose=bedrock"

Response: Same as above, but user is created with specified tags

To verify tags were applied:
Natural language: "Show tags for IAM user marketing-bedrock-user"
```

### List IAM Users by Tag
```
Natural language: "List all IAM users with tag purpose=bedrock"

Alternative: "Find IAM users tagged with purpose=bedrock"

Response:
{
  "Users": [
    {
      "UserName": "marketing-bedrock-user",
      "Arn": "arn:aws:iam::123456789012:user/marketing-bedrock-user",
      "CreateDate": "2026-01-24T10:30:00Z",
      "Tags": [
        {"Key": "purpose", "Value": "bedrock"},
        {"Key": "business-unit", "Value": "marketing"}
      ]
    },
    ...
  ]
}
```

### Delete IAM User
```
Natural language: "Delete IAM user marketing-bedrock-user"

Important: Must delete all API keys first before deleting user

Response:
{
  "ResponseMetadata": {
    "HTTPStatusCode": 200
  }
}
```

## IAM Policy Management

### Attach Managed Policy to User
```
Natural language: "Attach AmazonBedrockFullAccess policy to IAM user marketing-bedrock-user"

Alternative: "Attach policy arn:aws:iam::aws:policy/AmazonBedrockFullAccess to user marketing-bedrock-user"

Response:
{
  "ResponseMetadata": {
    "HTTPStatusCode": 200
  }
}
```

### List Policies Attached to User
```
Natural language: "List policies attached to IAM user marketing-bedrock-user"

Alternative: "Show IAM policies for user marketing-bedrock-user"

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

### Detach Policy from User
```
Natural language: "Detach AmazonBedrockFullAccess policy from IAM user marketing-bedrock-user"

Response:
{
  "ResponseMetadata": {
    "HTTPStatusCode": 200
  }
}
```

## Bedrock API Key (Service-Specific Credentials)

### Create API Key
```
Natural language: "Create service-specific credential for IAM user marketing-bedrock-user for bedrock.amazonaws.com with 30-day expiration"

Alternative: "Generate Bedrock API key for user marketing-bedrock-user that expires in 30 days"

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

CRITICAL: ServicePassword (the API key) is only shown once. Store it securely.
```

### List API Keys for User
```
Natural language: "List service-specific credentials for IAM user marketing-bedrock-user for service bedrock.amazonaws.com"

Alternative: "Show all Bedrock API keys for user marketing-bedrock-user"

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

Note: ServicePassword (API key value) is NOT returned for security reasons
```

### Update API Key Status
```
Natural language: "Update service-specific credential ACCACKCEVSQEXAMPLE for user marketing-bedrock-user to status Inactive"

Alternative: "Disable Bedrock API key ACCACKCEVSQEXAMPLE for user marketing-bedrock-user"

Use cases:
- Status "Inactive": Temporarily disable key without deleting
- Status "Active": Re-enable previously disabled key

Response:
{
  "ResponseMetadata": {
    "HTTPStatusCode": 200
  }
}
```

### Delete API Key
```
Natural language: "Delete service-specific credential ACCACKCEVSQEXAMPLE for IAM user marketing-bedrock-user"

Alternative: "Remove Bedrock API key ACCACKCEVSQEXAMPLE from user marketing-bedrock-user"

Response:
{
  "ResponseMetadata": {
    "HTTPStatusCode": 200
  }
}

Warning: This permanently deletes the key. Any systems using it will stop working.
```

## Cost Tracking

### View IAM User Tags
```
Natural language: "Show tags for IAM user marketing-bedrock-user"

Alternative: "Get tags on IAM user marketing-bedrock-user"

Response:
{
  "Tags": [
    {"Key": "business-unit", "Value": "marketing"},
    {"Key": "purpose", "Value": "bedrock"},
    {"Key": "owner", "Value": "marketing@company.com"}
  ]
}
```

### Query Costs by Tag (Cost Explorer)
```
Natural language: "Show Bedrock costs for business-unit tag equals marketing in January 2026"

Alternative: "Get cost and usage for Bedrock service filtered by tag business-unit=marketing from 2026-01-01 to 2026-01-31"

Response:
{
  "ResultsByTime": [
    {
      "TimePeriod": {
        "Start": "2026-01-01",
        "End": "2026-01-31"
      },
      "Total": {
        "BlendedCost": {
          "Amount": "125.50",
          "Unit": "USD"
        }
      },
      "Groups": []
    }
  ]
}
```

## Identity Verification

### Check Current AWS Identity
```
Natural language: "Check my current AWS identity"

Alternative: "Who am I authenticated as in AWS"

Response:
{
  "UserId": "AIDACKCEVSQ6C2EXAMPLE",
  "Account": "123456789012",
  "Arn": "arn:aws:iam::123456789012:user/admin"
}

Use this to verify your AWS credentials are working before provisioning
```

## Region-Specific Operations

### List Models in Specific Region
```
Natural language: "List available Bedrock models in us-west-2"

Alternative: "Show Bedrock foundation models in region us-west-2"

Note: Model availability varies by region
```

### Create User in Specific Region
```
Note: IAM users are global (not region-specific)
Bedrock API keys work across all regions where Bedrock is available

However, Bedrock model access must be enabled per region
```

## Common Patterns

### Pattern: Check → Create → Attach → Tag
```
1. Natural language: "Check if IAM user {name} exists"
   → If exists: Skip to step 5
   → If not exists: Continue

2. Natural language: "Create IAM user {name}"

3. Natural language: "Attach AmazonBedrockFullAccess policy to user {name}"

4. Natural language: "Tag IAM user {name} with {tags}"

5. Natural language: "Create Bedrock API key for user {name} with {expiration}"
```

### Pattern: List → Select → Generate Key
```
1. Natural language: "List all IAM users with tag purpose=bedrock"

2. User selects existing user (e.g., marketing-bedrock-user)

3. Natural language: "Create Bedrock API key for user marketing-bedrock-user"
```

### Pattern: Rotate (Create New → Delete Old)
```
1. Natural language: "List Bedrock API keys for user {name}"
   → Get old key IDs

2. Natural language: "Create Bedrock API key for user {name}"
   → Get new key

3. Natural language: "Delete service-specific credential {old-key-id} for user {name}"
   → Remove old key
```

## Error Handling

### Common Errors and Meanings

**NoSuchEntity**
```
Error: "The user with name {name} cannot be found"
Meaning: IAM user doesn't exist
Action: Create the user first
```

**AccessDenied**
```
Error: "User: {arn} is not authorized to perform: {action}"
Meaning: Your AWS credentials lack required permissions
Action: Request IAM permissions or use different credentials
```

**EntityAlreadyExists**
```
Error: "User with name {name} already exists"
Meaning: IAM user already exists
Action: Use existing user or choose different name
```

**LimitExceeded**
```
Error: "LimitExceeded: Cannot exceed quota for {resource}"
Meaning: Hit AWS service limit (e.g., max IAM users, max API keys per user)
Action: Delete unused resources or request limit increase
```

**ValidationError**
```
Error: "1 validation error detected: Value '{value}' failed to satisfy constraint"
Meaning: Invalid parameter format (e.g., invalid expiration, invalid tag value)
Action: Check parameter format and retry
```

## Best Practices

**1. Always check before creating**
```
# Good: Check first
"Check if IAM user marketing-bedrock-user exists"
→ If exists: Handle idempotently
→ If not: Create

# Bad: Create directly
"Create IAM user marketing-bedrock-user"
→ Might fail if already exists
```

**2. Use descriptive names**
```
# Good: Descriptive, follows pattern
{business-unit}-bedrock-user

# Bad: Generic or unclear
bedrock-user-1
my-user
```

**3. Always tag resources**
```
# Good: Tag with business context
"Create IAM user marketing-bedrock-user with tags business-unit=marketing, purpose=bedrock"

# Bad: No tags
"Create IAM user marketing-bedrock-user"
→ Can't track costs or ownership
```

**4. Verify operations**
```
# After creating, verify
"Show tags for IAM user marketing-bedrock-user"
"List policies attached to IAM user marketing-bedrock-user"
→ Confirms tags and policies applied correctly
```

## Debugging Tips

**Test AWS credentials:**
```
Natural language: "Check my current AWS identity"
→ Should return your user ARN and account ID
```

**Test Bedrock access:**
```
Natural language: "List available Bedrock models in us-east-1"
→ Should return Claude models if access is enabled
```

**Check IAM permissions:**
```
Natural language: "List policies attached to my IAM user"
→ Shows what permissions you have
```

**Trace API calls:**
All AWS MCP Server operations are logged to CloudTrail
Use AWS Console → CloudTrail → Event history to debug issues
