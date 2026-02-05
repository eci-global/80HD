# Security Best Practices for AWS Bedrock Provisioning

This document provides security guidance for managing AWS Bedrock API keys and IAM resources created by the provisioning-bedrock skill.

## API Key Security

### Critical Security Rules

**1. API Keys Are Secrets**
```
✓ Treat API keys like passwords
✓ Never commit to version control
✓ Never share in chat/email/Slack
✓ Store in secure credential manager
✗ Don't log full keys
✗ Don't store in plaintext files
✗ Don't hardcode in applications
```

**2. API Keys Cannot Be Retrieved**
```
AWS Security Model:
- API key (ServicePassword) shown ONLY once at creation
- Cannot be retrieved later via AWS API or Console
- If lost, must rotate (create new, delete old)

Implications:
✓ Store immediately in secure location
✓ Have backup storage (1Password, AWS Secrets Manager)
✓ Document key rotation procedure
```

### API Key Lifecycle

**Creation:**
```bash
# When provisioning-bedrock creates a key:
1. Key is generated with 30-day expiration (default)
2. Key shown in shareable snippet (full value, one time)
3. Key truncated in chat output (first 12 chars only)

# What you must do:
1. Copy full key from snippet immediately
2. Store in secure location:
   - AWS Secrets Manager (recommended for production)
   - 1Password, LastPass, or similar
   - Environment variable (for local dev only)
3. Never commit to git
```

**Storage Best Practices:**
```bash
# Option 1: Environment variable (local development)
echo 'export AWS_BEDROCK_API_KEY="bdk_v1_..."' >> ~/.bashrc
echo 'export AWS_REGION="us-east-1"' >> ~/.bashrc
source ~/.bashrc

# Add to .gitignore
echo '.env' >> .gitignore
echo '*.env' >> .gitignore

# Option 2: AWS Secrets Manager (production)
aws secretsmanager create-secret \
  --name marketing/bedrock/api-key \
  --secret-string "bdk_v1_..." \
  --tags Key=business-unit,Value=marketing Key=purpose=bedrock

# Retrieve in application:
aws secretsmanager get-secret-value \
  --secret-id marketing/bedrock/api-key \
  --query SecretString \
  --output text

# Option 3: .env file (local development, gitignored)
cat > .env <<EOF
AWS_BEDROCK_API_KEY=bdk_v1_...
AWS_REGION=us-east-1
EOF

chmod 600 .env  # Restrict permissions
```

**Rotation (Every 30 Days):**
```bash
# Use provisioning-bedrock skill:
/provisioning-bedrock rotate key for marketing

# What happens:
1. New API key created with fresh 30-day expiration
2. Old key optionally deleted (or disabled)
3. New key provided in snippet

# What you must do:
1. Update key in all systems using it
2. Test with new key
3. Confirm old key deleted/disabled
4. Update documentation with rotation date
```

**Revocation (If Compromised):**
```bash
# Immediate action if key is compromised:
1. Run: /provisioning-bedrock rotate key for {business-unit}
2. Choose to DELETE old key immediately
3. Update all legitimate systems with new key
4. Monitor CloudTrail for suspicious activity
5. Review Cost Explorer for unexpected charges

# Manual revocation (without rotation):
aws iam delete-service-specific-credential \
  --user-name marketing-bedrock-user \
  --service-specific-credential-id ACCACKCEVSQEXAMPLE

# Or disable (temporary):
aws iam update-service-specific-credential \
  --user-name marketing-bedrock-user \
  --service-specific-credential-id ACCACKCEVSQEXAMPLE \
  --status Inactive
```

### Key Expiration

**Default: 30 Days**
```
Why 30 days?
- Forces regular rotation
- Limits blast radius if key is compromised
- Aligns with security best practices

Can be customized:
- Minimum: 1 day
- Maximum: 90 days (for long-term keys)
- Recommended: 30 days for production, 7 days for testing
```

**Expiration Monitoring:**
```bash
# List keys with expiration dates
aws iam list-service-specific-credentials \
  --user-name marketing-bedrock-user

# Check expiration date
# If CreateDate + 30 days < Today → Key expired or expiring soon

# Set up reminder:
- Calendar reminder 1 week before expiration
- Automate with AWS EventBridge (trigger rotation)
- Monitor with AWS CloudWatch (alert on key age)
```

**What Happens at Expiration:**
```
Automatic:
- Key becomes invalid (API calls fail with 401 Unauthorized)
- AWS automatically disables the key
- Key still appears in list with Status=Inactive

Manual action required:
- Create new key before expiration
- Update systems with new key
- Delete expired key (cleanup)
```

## IAM Security

### Least Privilege Principle

**For Provisioning (Admin):**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BedrockProvisioningMinimal",
      "Effect": "Allow",
      "Action": [
        "iam:CreateUser",
        "iam:GetUser",
        "iam:ListUsers",
        "iam:TagUser",
        "iam:AttachUserPolicy",
        "iam:ListAttachedUserPolicies",
        "iam:CreateServiceSpecificCredential",
        "iam:ListServiceSpecificCredentials",
        "iam:UpdateServiceSpecificCredential",
        "iam:DeleteServiceSpecificCredential",
        "bedrock:ListFoundationModels",
        "bedrock:GetFoundationModel",
        "bedrock:InvokeModel"
      ],
      "Resource": "*"
    }
  ]
}

Attach to: User running provisioning-bedrock skill
```

**For End Users (Bedrock Access):**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BedrockInferenceOnly",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": [
        "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-sonnet-4-5-v2:0",
        "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-opus-4-5-v1:0",
        "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-haiku-4-5-v1:0"
      ]
    }
  ]
}

Attach to: IAM users created for business units (via AmazonBedrockFullAccess or custom policy)
```

**Restrict by Region (Optional):**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "bedrock:InvokeModel",
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": ["us-east-1", "us-west-2"]
        }
      }
    }
  ]
}
```

### IAM User Tagging

**Required Tags (for cost tracking):**
```
- business-unit: {business_unit}
- purpose: bedrock
- owner: {owner_email} (optional but recommended)
- created-by: provisioning-bedrock-skill
```

**Why Tags Matter:**
```
1. Cost Allocation:
   - Track Bedrock spend by business unit
   - Chargeback to correct department
   - Budget alerts per team

2. Access Control:
   - Can create IAM policies based on tags
   - Example: Only marketing team can manage marketing-bedrock-user

3. Compliance:
   - Audit who created resources
   - Track resource ownership
   - GDPR data lineage
```

**Tag-Based Access Control (Advanced):**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "iam:*",
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "iam:ResourceTag/business-unit": "${aws:username}"
        }
      }
    }
  ]
}

Allows users to only manage IAM resources tagged with their username
```

## CloudTrail Logging

**All IAM and Bedrock actions are logged:**
```
Logged events:
- IAM user creation
- Policy attachments
- API key creation/deletion
- Bedrock model invocations
- Permission errors

Use CloudTrail to:
- Audit who provisioned what
- Investigate security incidents
- Track API key usage
- Detect anomalies
```

**Query CloudTrail for Bedrock Activity:**
```bash
# Find all Bedrock API calls in last 7 days
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=InvokeModel \
  --start-time $(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%S) \
  --max-results 50

# Find IAM user creation events
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=CreateUser \
  --max-results 50

# Find API key creation
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=CreateServiceSpecificCredential
```

**Set Up Alerts (CloudWatch):**
```bash
# Alert on high-volume Bedrock usage
# Alert on API key creation from unknown IP
# Alert on permission denied errors (potential attack)
```

## Network Security

**IP Restrictions (Optional):**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "bedrock:InvokeModel",
      "Resource": "*",
      "Condition": {
        "IpAddress": {
          "aws:SourceIp": [
            "203.0.113.0/24",
            "198.51.100.0/24"
          ]
        }
      }
    }
  ]
}

Restricts Bedrock access to specific IP ranges (office, VPN)
```

**VPC Endpoints (Advanced):**
```bash
# Create VPC endpoint for Bedrock (keeps traffic within AWS network)
aws ec2 create-vpc-endpoint \
  --vpc-id vpc-12345678 \
  --service-name com.amazonaws.us-east-1.bedrock-runtime \
  --route-table-ids rtb-12345678

Benefits:
- Traffic doesn't traverse public internet
- Lower latency
- Enhanced security
```

## Cost Monitoring & Budget Alerts

**Set Up Budget Alerts:**
```bash
# Alert if Bedrock costs exceed $500/month for marketing team
aws budgets create-budget \
  --account-id 123456789012 \
  --budget file://budget.json

# budget.json:
{
  "BudgetName": "marketing-bedrock-budget",
  "BudgetLimit": {
    "Amount": "500",
    "Unit": "USD"
  },
  "TimeUnit": "MONTHLY",
  "CostFilters": {
    "TagKeyValue": ["business-unit$marketing"],
    "Service": ["Amazon Bedrock"]
  },
  "NotificationsWithSubscribers": [
    {
      "Notification": {
        "NotificationType": "ACTUAL",
        "ComparisonOperator": "GREATER_THAN",
        "Threshold": 80
      },
      "Subscribers": [
        {
          "SubscriptionType": "EMAIL",
          "Address": "marketing@company.com"
        }
      ]
    }
  ]
}
```

**Monitor Anomalous Usage:**
```
AWS Cost Anomaly Detection:
- Automatically detects unusual spending patterns
- Alerts on sudden spikes in Bedrock usage
- Helps detect compromised API keys
```

## Incident Response

**If API Key Is Compromised:**

**Step 1: Immediate Containment (Within 5 Minutes)**
```bash
# Disable the key immediately
aws iam update-service-specific-credential \
  --user-name marketing-bedrock-user \
  --service-specific-credential-id ACCACKCEVSQEXAMPLE \
  --status Inactive

# Or delete it
aws iam delete-service-specific-credential \
  --user-name marketing-bedrock-user \
  --service-specific-credential-id ACCACKCEVSQEXAMPLE
```

**Step 2: Assess Impact (Within 30 Minutes)**
```bash
# Check CloudTrail for unauthorized usage
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=Username,AttributeValue=marketing-bedrock-user \
  --start-time $(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%S)

# Check Cost Explorer for unexpected charges
# Review CloudWatch logs for anomalies
```

**Step 3: Rotate Credentials (Within 1 Hour)**
```bash
# Create new API key
/provisioning-bedrock rotate key for marketing

# Update all legitimate systems with new key
# Test to ensure services are working
```

**Step 4: Post-Incident (Within 24 Hours)**
```bash
# Document incident
# Review security practices
# Update IAM policies if needed
# Consider additional controls (IP restrictions, MFA)
```

## Compliance Considerations

**GDPR:**
```
- Tag IAM users with data classification
- Log all data access (CloudTrail)
- Implement data retention policies
- Provide data access transparency
```

**SOC 2:**
```
- Regular API key rotation (30 days)
- Audit logging (CloudTrail)
- Access reviews (quarterly)
- Incident response plan
```

**PCI DSS (if handling payment data):**
```
- Encrypt API keys at rest (Secrets Manager)
- Restrict network access (VPC endpoints)
- Multi-factor authentication
- Key rotation every 90 days
```

## Security Checklist

**Initial Setup:**
- [ ] AWS credentials configured securely (not in code)
- [ ] IAM permissions follow least privilege
- [ ] CloudTrail logging enabled
- [ ] Budget alerts configured

**Per Provisioning:**
- [ ] API key stored in secure location (Secrets Manager, 1Password)
- [ ] API key NOT committed to git
- [ ] IAM user tagged correctly (business-unit, purpose, owner)
- [ ] Expiration reminder set (calendar, automation)

**Ongoing:**
- [ ] Rotate API keys every 30 days
- [ ] Review CloudTrail logs monthly
- [ ] Review Cost Explorer for anomalies
- [ ] Update IAM policies as needed
- [ ] Audit IAM users quarterly (delete unused)

**If Compromised:**
- [ ] Disable/delete key immediately
- [ ] Assess impact via CloudTrail and Cost Explorer
- [ ] Rotate to new key
- [ ] Update incident response documentation

## Additional Resources

- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [AWS Bedrock Security](https://docs.aws.amazon.com/bedrock/latest/userguide/security.html)
- [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/)
- [CloudTrail Logging](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/)
