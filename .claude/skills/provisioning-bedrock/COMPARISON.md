# AWS Bedrock vs GCP Vertex AI Provisioning Comparison

This document compares the provisioning models for AWS Bedrock and GCP Vertex AI to inform the design of the `provisioning-bedrock` skill.

## High-Level Architecture

| Aspect | GCP Vertex AI | AWS Bedrock |
|--------|---------------|-------------|
| **Resource Isolation** | Separate GCP projects per business unit | Single AWS account with IAM-based isolation |
| **Authentication** | API keys (restricted to Vertex AI API) | IAM access keys OR Bedrock API keys |
| **Cost Tracking** | By project + API key annotations | By IAM tags + resource tags |
| **Regional Setup** | Per-project, region specified in API calls | Per-account, region-specific model access |
| **Prerequisites** | gcloud CLI, Application Default Credentials | AWS CLI, IAM credentials |

## Provisioning Workflow Comparison

### GCP Vertex AI (7 steps)
1. Create GCP project (with billing account link)
2. Link billing account to project
3. Enable Vertex AI API (aiplatform.googleapis.com)
4. Create restricted API key (scoped to Vertex AI API only)
5. Add annotations to API key (for cost tracking)
6. Configure environment variables
7. Test with curl command

**Time to provision:** ~5-10 minutes (API enablement is slowest)

### AWS Bedrock (5 steps)
1. Enable Claude models in region (one-time, may require manual approval)
2. Create IAM user or role with Bedrock permissions
3. Attach IAM policy (BedrockFullAccess or custom)
4. Generate Bedrock API key (long-term or short-term)
5. Configure environment variables

**Time to provision:** ~2-5 minutes (model access approval may take longer if first time)

**Key Difference:** AWS Bedrock doesn't require creating separate accounts/projects. IAM provides the isolation.

## Authentication Models

### GCP Vertex AI: API Keys
```bash
# Restricted API key scoped to aiplatform.googleapis.com
gcloud alpha services api-keys create \
  --display-name='marketing-vertex-key-master' \
  --project=marketing-ai \
  --api-target=service=aiplatform.googleapis.com \
  --annotations=key-type=master,created-by=user@company.com
```

**Characteristics:**
- API keys are project-scoped
- Automatically restricted to specific API (aiplatform.googleapis.com)
- Annotations for metadata (cost tracking)
- Cannot be retrieved after creation
- Simple to use, just pass in header

### AWS Bedrock: IAM + API Keys
```bash
# Option 1: IAM User with Access Keys
aws iam create-user --user-name marketing-bedrock-user
aws iam attach-user-policy --user-name marketing-bedrock-user \
  --policy-arn arn:aws:iam::aws:policy/AmazonBedrockFullAccess
aws iam create-access-key --user-name marketing-bedrock-user

# Option 2: Bedrock-Specific API Keys (Newer)
aws iam create-service-specific-credential \
  --user-name marketing-bedrock-user \
  --service-name bedrock.amazonaws.com \
  --credential-age-days 30
```

**Characteristics:**
- Two authentication options: IAM access keys OR Bedrock API keys
- IAM provides fine-grained permissions via policies
- Tags for metadata (cost tracking)
- Short-term (12-hour) or long-term (configurable) keys
- More complex but more flexible

**Recommendation:** Use Bedrock API keys (Option 2) for simplicity and similarity to GCP approach.

## Cost Tracking

### GCP Vertex AI: Project + Annotation Based
```bash
# Cost tracked at project level
Project: marketing-ai
└── API Key: marketing-vertex-key-master
    └── Annotations: {key-type: master, created-by: marketing@company.com}

# Query costs
gcloud billing projects describe marketing-ai
gcloud alpha services api-keys describe <key-name> --project=marketing-ai
```

**Benefits:**
- Clear project isolation = clear cost boundaries
- API key annotations allow user-level tracking within project
- Easy to see costs per business unit (= per project)

**Limitations:**
- Cannot easily aggregate across multiple projects
- Annotations are metadata only, not queryable in billing

### AWS Bedrock: IAM Tag Based
```bash
# Cost tracked via IAM tags and resource tags
IAM User: marketing-bedrock-user
└── Tags: {business-unit: marketing, purpose: bedrock, owner: user@company.com}
└── API Key: <bedrock-service-specific-credential>

# Query costs
aws ce get-cost-and-usage \
  --time-period Start=2026-01-01,End=2026-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --filter '{"Tags": {"Key": "business-unit", "Values": ["marketing"]}}'
```

**Benefits:**
- Flexible tagging across all AWS resources
- Cost Explorer provides powerful querying by tags
- Can aggregate across multiple teams/projects easily
- Can track by IAM user, resource tag, or both

**Limitations:**
- Requires consistent tagging discipline
- More setup complexity (tags must be applied correctly)
- Not as visually isolated as separate GCP projects

## Security Model

### GCP Vertex AI: Project Isolation
```bash
# Each business unit gets separate project
marketing-ai:
  - Billing: Linked to company billing account
  - API Key: Restricted to aiplatform.googleapis.com
  - Permissions: Project-level IAM (who can manage this project)
  - Blast radius: Limited to single project

# Security considerations:
✓ Strong isolation (separate projects)
✓ Simple API key model (restricted to one API)
✗ API keys never expire by default
✗ Must manage multiple projects
```

**Threat model:** If API key is compromised, attacker can only access Vertex AI in that one project.

### AWS Bedrock: IAM Policy Isolation
```bash
# Single account, IAM policies control access
marketing-bedrock-user:
  - IAM Policy: AmazonBedrockFullAccess (or custom)
  - Resource Tags: {business-unit: marketing}
  - API Key: Expires in 30 days (configurable)
  - Blast radius: Defined by IAM policy scope

# Security considerations:
✓ Fine-grained permissions via IAM policies
✓ Short-term credentials available (12-hour tokens)
✓ CloudTrail logging for all API calls
✗ Weaker isolation (same account)
✗ More complex IAM policy management
```

**Threat model:** If API key is compromised, attacker can access Bedrock resources as permitted by IAM policy (could be broader than single project).

**Recommendation:** Use least-privilege IAM policies and short-term credentials for production.

## Regional Availability

### GCP Vertex AI
```bash
# Region specified in API endpoint
ANTHROPIC_BASE_URL="https://us-east5-aiplatform.googleapis.com/v1"
ANTHROPIC_VERTEX_LOCATION="us-east5"

# Available regions (for Claude):
- us-east5 (recommended)
- us-central1
- europe-west1
- asia-southeast1
```

**Model availability:** Consistent across supported regions.

### AWS Bedrock
```bash
# Region specified in API endpoint
AWS_REGION="us-east-1"
BEDROCK_ENDPOINT="https://bedrock-runtime.us-east-1.amazonaws.com"

# Available regions (for Claude):
- us-east-1 (recommended, most models)
- us-west-2
- eu-west-1
- ap-southeast-1
- And more...
```

**Model availability:** Varies by region. Some models only in certain regions.

**Important:** Model access must be enabled per region. First-time setup may require manual approval in console.

## Environment Configuration

### GCP Vertex AI
```bash
# Required environment variables
export ANTHROPIC_API_KEY="<api-key>"
export ANTHROPIC_BASE_URL="https://us-east5-aiplatform.googleapis.com/v1"
export ANTHROPIC_VERTEX_PROJECT_ID="marketing-ai"
export ANTHROPIC_VERTEX_LOCATION="us-east5"

# Alternative: Use Application Default Credentials
gcloud auth application-default login
# No API key needed, uses ADC
```

### AWS Bedrock
```bash
# Option 1: Bedrock API Key
export AWS_BEDROCK_API_KEY="<api-key>"
export AWS_REGION="us-east-1"
export ANTHROPIC_API_KEY="<same-as-bedrock-key>"

# Option 2: IAM Access Keys
export AWS_ACCESS_KEY_ID="<access-key-id>"
export AWS_SECRET_ACCESS_KEY="<secret-access-key>"
export AWS_REGION="us-east-1"

# Option 3: AWS CLI Profile
export AWS_PROFILE="marketing-profile"
export AWS_REGION="us-east-1"
```

**Flexibility:** AWS provides more authentication options, but this adds complexity.

## Model Access

### GCP Vertex AI
```bash
# Model IDs (standardized)
claude-sonnet-4-5@20250929
claude-opus-4-5@20251101
claude-haiku-4-5@20251001

# No enablement required - if you have project access, you have model access
```

### AWS Bedrock
```bash
# Model IDs (region-specific ARN format)
anthropic.claude-sonnet-4-5-v2:0
anthropic.claude-opus-4-5-v1:0
anthropic.claude-haiku-4-5-v1:0

# Enablement required (one-time per region)
# 1. Go to AWS Console → Bedrock → Model Access
# 2. Request access to Anthropic models
# 3. Wait for approval (usually instant, sometimes manual review)

# As of 2025-2026: Some regions now have automatic model access
```

**Key Difference:** AWS requires explicit model access request (one-time), GCP does not.

## Setup Complexity

### GCP Vertex AI: Higher Initial Complexity
**Steps required:**
1. Install gcloud CLI
2. Authenticate with `gcloud auth login`
3. Set up Application Default Credentials
4. Set billing account ID
5. Optionally set folder ID
6. Run provisioning skill

**Ongoing complexity:** Low (manage projects, rotate API keys)

### AWS Bedrock: Medium Initial Complexity
**Steps required:**
1. Install AWS CLI
2. Configure AWS credentials (`aws configure`)
3. Request model access in region (one-time)
4. Run provisioning skill

**Ongoing complexity:** Medium (manage IAM users/roles, rotate keys, maintain least-privilege policies)

## Recommendation for Skill Design

Based on this comparison, the `provisioning-bedrock` skill should:

1. **Use Bedrock API Keys** (not IAM access keys) for simplicity and similarity to GCP approach
2. **Create IAM users** (not roles) for straightforward API key generation
3. **Apply consistent tags** to IAM users for cost tracking (business-unit, owner, purpose)
4. **Default to us-east-1** region (most model availability)
5. **Check and enable model access** as part of provisioning workflow
6. **Support short-term (12-hour) and long-term (30-day) API keys** with preference for short-term
7. **Provide clear security warnings** about key storage and rotation
8. **Mirror GCP skill UX** for consistency (shareable snippets, minimal output)

## Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| IAM Users vs Roles | **IAM Users** | Simpler API key generation, similar to GCP projects |
| IAM Policy | **AmazonBedrockFullAccess** (managed) | Standard policy, easy to understand, can be customized later |
| API Key Type | **Long-term (30 days)** default | Balance between security and usability, with option for short-term |
| Region Default | **us-east-1** | Broadest model availability, standard AWS region |
| Cost Tracking | **IAM Tags** | Leverage AWS native cost allocation tags |
| Model Access | **Automatic check + enable** | Reduce manual steps, fail gracefully if approval needed |

## Next Steps

With this comparison in mind, the skill should:
1. Create IAM user with descriptive name: `{business-unit}-bedrock-user`
2. Attach `AmazonBedrockFullAccess` managed policy
3. Tag user with: `business-unit`, `purpose=bedrock`, `owner`, `created-by-skill=provisioning-bedrock`
4. Generate Bedrock API key (30-day expiration by default)
5. Return shareable environment snippet with clear security warnings
