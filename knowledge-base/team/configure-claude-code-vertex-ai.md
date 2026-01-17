---
title: Configure Claude Code to Use Vertex AI
category: team
tags: [claude-code, vertex-ai, gcp, setup, configuration, cross-platform]
author: Travis Edgar
date: 2026-01-17
---

# Configure Claude Code to Use Vertex AI

This guide walks you through configuring Claude Code to use Google Cloud's Vertex AI as the backend instead of Anthropic's direct API. This is the **official method** recommended by Anthropic and works across macOS, Linux, and Windows.

## Why Use Vertex AI?

Using Vertex AI with Claude Code provides several advantages:

- **Unified billing** with other Google Cloud services
- **IAM-controlled access** instead of API keys
- **Regional model endpoints**, often with better latency
- **Consistent security posture** across your organization
- **No dependency** on Anthropic's identity system
- **Enterprise controls** and governance

## Prerequisites

Before starting, ensure you have:

1. **Google Cloud Project** with billing enabled
2. **Vertex AI API** enabled in your project
3. **Access to Claude models** (Opus 4.5, Sonnet 4.5, Haiku 4.5)
4. **Google Cloud SDK** (`gcloud`) installed
5. **Claude Code CLI** installed (`npm install -g @anthropic-ai/claude-code`)

## Step 1: Install Google Cloud SDK

### macOS

```bash
# Using Homebrew
brew install --cask google-cloud-sdk

# Verify installation
gcloud --version
```

### Linux

```bash
# Download and install
curl https://sdk.cloud.google.com | bash

# Restart your shell
exec -l $SHELL

# Verify installation
gcloud --version
```

### Windows

Download and run the installer from:
https://cloud.google.com/sdk/docs/install#windows

Or using PowerShell:

```powershell
# Using Chocolatey
choco install gcloudsdk

# Verify installation
gcloud --version
```

## Step 2: Enable Vertex AI and Request Model Access

### Enable the Vertex AI API

```bash
# Set your project ID
gcloud config set project YOUR-PROJECT-ID

# Enable Vertex AI API
gcloud services enable aiplatform.googleapis.com
```

**Replace `YOUR-PROJECT-ID` with your actual Google Cloud project ID.**

### Request Access to Claude Models

1. Navigate to the [Vertex AI Model Garden](https://console.cloud.google.com/vertex-ai/model-garden)
2. Search for "Claude"
3. Enable each model you want to use:
   - Claude Opus 4.5 (`claude-opus-4-5@20251101`)
   - Claude Sonnet 4.5 (`claude-sonnet-4-5@20250929`)
   - Claude Haiku 4.5 (`claude-haiku-4-5@20251001`)
4. Accept the terms of service
5. Access is typically granted immediately (though it may take 24-48 hours in some cases)

## Step 3: Configure Google Cloud Authentication

Claude Code uses **Application Default Credentials (ADC)**, which is Google Cloud's standard authentication method.

### Authenticate

```bash
# Log in to Google Cloud (opens browser)
gcloud auth login

# Set up Application Default Credentials (opens browser)
gcloud auth application-default login
```

The second command stores credentials locally:
- **macOS/Linux**: `~/.config/gcloud/application_default_credentials.json`
- **Windows**: `%APPDATA%\gcloud\application_default_credentials.json`

### Verify Authentication

```bash
# Test that credentials are working
gcloud auth application-default print-access-token
```

If this returns an access token, you're authenticated correctly.

## Step 4: Configure Environment Variables

Claude Code automatically uses Vertex AI when these environment variables are set.

### macOS / Linux

Add to your shell configuration file (`~/.zshrc`, `~/.bashrc`, or `~/.profile`):

```bash
# Enable Vertex AI integration
export CLAUDE_CODE_USE_VERTEX=1

# Your Google Cloud project ID
export ANTHROPIC_VERTEX_PROJECT_ID=YOUR-PROJECT-ID

# Region configuration (global or specific region)
export CLOUD_ML_REGION=global

# Optional: Specify which models to use
export ANTHROPIC_MODEL="claude-sonnet-4-5@20250929"
export ANTHROPIC_SMALL_FAST_MODEL="claude-haiku-4-5@20251001"

# Optional: Disable prompt caching if needed
# export DISABLE_PROMPT_CACHING=1
```

**Replace `YOUR-PROJECT-ID` with your actual project ID.**

Reload your shell configuration:

```bash
source ~/.zshrc  # or ~/.bashrc
```

### Windows (PowerShell)

Add to your PowerShell profile (`$PROFILE`):

```powershell
# Enable Vertex AI integration
$env:CLAUDE_CODE_USE_VERTEX = "1"

# Your Google Cloud project ID
$env:ANTHROPIC_VERTEX_PROJECT_ID = "YOUR-PROJECT-ID"

# Region configuration
$env:CLOUD_ML_REGION = "global"

# Optional: Specify which models to use
$env:ANTHROPIC_MODEL = "claude-sonnet-4-5@20250929"
$env:ANTHROPIC_SMALL_FAST_MODEL = "claude-haiku-4-5@20251001"

# Optional: Disable prompt caching
# $env:DISABLE_PROMPT_CACHING = "1"
```

To edit your PowerShell profile:

```powershell
notepad $PROFILE
```

Reload your profile:

```powershell
. $PROFILE
```

### Windows (Command Prompt)

For persistent environment variables, use System Properties:

1. Open **System Properties** → **Advanced** → **Environment Variables**
2. Under **User variables**, click **New** for each variable:
   - `CLAUDE_CODE_USE_VERTEX` = `1`
   - `ANTHROPIC_VERTEX_PROJECT_ID` = `YOUR-PROJECT-ID`
   - `CLOUD_ML_REGION` = `global`
   - `ANTHROPIC_MODEL` = `claude-sonnet-4-5@20250929`
   - `ANTHROPIC_SMALL_FAST_MODEL` = `claude-haiku-4-5@20251001`

## Step 5: Understanding Model Configuration

### Default Models

Claude Code uses these defaults for Vertex AI:

| Model Type | Default Model | Purpose |
|-----------|---------------|---------|
| Primary (default) | `claude-sonnet-4-5@20250929` | Standard coding tasks, balanced performance |
| Small/Fast (background) | `claude-haiku-4-5@20251001` | Quick tasks, linting, simple searches |
| Think (complex reasoning) | `claude-opus-4-5@20251101` | Complex planning, architectural decisions |

### Customizing Models

You can override these defaults:

```bash
# Use Opus as your primary model (more capable, higher cost)
export ANTHROPIC_MODEL="claude-opus-4-5@20251101"

# Use Sonnet for background tasks (faster than Haiku, more accurate)
export ANTHROPIC_SMALL_FAST_MODEL="claude-sonnet-4-5@20250929"
```

### Model Naming Convention

Vertex AI uses a specific naming format:

```
claude-<model>-<version>@<date>
```

Examples:
- `claude-opus-4-5@20251101`
- `claude-sonnet-4-5@20250929`
- `claude-haiku-4-5@20251001`

## Step 6: Region Configuration

### Using Global Endpoint (Recommended)

```bash
export CLOUD_ML_REGION=global
```

The global endpoint provides better availability and automatic failover. However, not all models support global endpoints.

### Using Regional Endpoints

If a model doesn't support the global endpoint, specify a regional endpoint:

```bash
export CLOUD_ML_REGION=us-east5
```

### Per-Model Region Overrides

You can override the region for specific models when using the global endpoint:

```bash
# Use global endpoint
export CLOUD_ML_REGION=global

# Override specific models that don't support global
export VERTEX_REGION_CLAUDE_3_5_HAIKU=us-east5
export VERTEX_REGION_CLAUDE_3_5_SONNET=us-east5
export VERTEX_REGION_CLAUDE_4_0_OPUS=europe-west1
```

Check the [Vertex AI documentation](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/locations#genai-partner-models) for supported regions.

## Step 7: Start Claude Code

With everything configured, simply run:

```bash
claude
```

Claude Code will:
- Automatically detect the Vertex AI environment variables
- Authenticate using Application Default Credentials
- Route all requests through Google Cloud Vertex AI
- Disable `/login` and `/logout` commands (authentication is handled by Google Cloud)

### Verify It's Working

You should see output indicating Vertex AI is being used. You can also check the Claude Code logs or monitor your Google Cloud project's Vertex AI usage in the Console.

## IAM Configuration

Ensure your Google Cloud user or service account has the required IAM permissions.

### Required Permission

The `roles/aiplatform.user` role includes the required permission:
- `aiplatform.endpoints.predict` - Required for model invocation and token counting

### Assign the Role

```bash
# For your user account
gcloud projects add-iam-policy-binding YOUR-PROJECT-ID \
  --member="user:YOUR-EMAIL@example.com" \
  --role="roles/aiplatform.user"

# For a service account
gcloud projects add-iam-policy-binding YOUR-PROJECT-ID \
  --member="serviceAccount:SERVICE-ACCOUNT@YOUR-PROJECT-ID.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

For production environments, create a **custom role** with only the required permission for least-privilege access.

## Advanced Configuration

### Service Account Authentication (Production/CI)

For automated environments, use a service account instead of user credentials:

1. Create a service account:

```bash
gcloud iam service-accounts create claude-code-sa \
  --description="Service account for Claude Code" \
  --display-name="Claude Code SA"
```

2. Grant Vertex AI permissions:

```bash
gcloud projects add-iam-policy-binding YOUR-PROJECT-ID \
  --member="serviceAccount:claude-code-sa@YOUR-PROJECT-ID.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

3. Create and download a key:

```bash
gcloud iam service-accounts keys create ~/claude-code-key.json \
  --iam-account=claude-code-sa@YOUR-PROJECT-ID.iam.gserviceaccount.com
```

4. Set the credentials environment variable:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=~/claude-code-key.json
```

### Using LLM Gateway (Skip Vertex Auth)

If you're using an LLM gateway that handles Vertex AI authentication for you:

```bash
export CLAUDE_CODE_SKIP_VERTEX_AUTH=1
```

This tells Claude Code to skip Google Cloud authentication and rely on the gateway.

## Troubleshooting

### Error: "Could not load the default credentials"

**Solution:** Run Application Default Credentials setup:

```bash
gcloud auth application-default login
```

### Error: "Model not found" (404)

**Causes:**
1. Model not enabled in Model Garden
2. Model not supported in your selected region
3. Using global endpoint with a model that requires regional endpoint

**Solutions:**
1. Verify model is enabled in [Model Garden](https://console.cloud.google.com/vertex-ai/model-garden)
2. Check [supported regions](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/locations#genai-partner-models)
3. Switch to a regional endpoint or use per-model region overrides

### Error: Quota exceeded (429)

**Solution:** Request quota increase through the [Cloud Console](https://cloud.google.com/docs/quotas/view-manage):

1. Navigate to **IAM & Admin** → **Quotas**
2. Search for "Vertex AI"
3. Request quota increase for your region

### High latency or timeouts

1. **Try a different region** - Switch to a region closer to your location
2. **Use global endpoint** - Better routing and failover:
   ```bash
   export CLOUD_ML_REGION=global
   ```
3. **Increase timeout** (via environment variable):
   ```bash
   export BASH_DEFAULT_TIMEOUT_MS=300000  # 5 minutes
   ```

### Windows: Environment variables not persisting

**PowerShell Solution:**
Ensure variables are in your profile (`$PROFILE`), not just set in the session.

**Command Prompt Solution:**
Use System Properties to set user or system environment variables permanently.

## Security Best Practices

1. **Use Application Default Credentials** - Never commit service account keys to version control
2. **Least privilege IAM** - Use custom roles with only required permissions
3. **Separate projects** - Use dedicated GCP projects for Claude Code to simplify cost tracking and access control
4. **Rotate keys regularly** - If using service accounts, rotate keys every 90 days
5. **Use Cloud IAM audit logs** - Monitor Vertex AI API usage for security and compliance

## Cost Optimization

1. **Use Haiku for simple tasks** - Claude Code automatically uses Haiku for background tasks
2. **Enable prompt caching** - Default is enabled, reduces costs for repeated context
3. **Monitor usage in Cloud Console** - Navigate to **Vertex AI** → **Dashboard** to track costs
4. **Set budget alerts** - Configure budget alerts in **Billing** → **Budgets & alerts**
5. **Use regional endpoints** - May have lower pricing than global endpoint

## Comparison: Direct API vs Vertex AI

| Feature | Direct Anthropic API | Vertex AI |
|---------|---------------------|-----------|
| Authentication | API key | Google Cloud IAM |
| Billing | Anthropic billing | Google Cloud billing |
| Governance | Limited | Full GCP controls |
| Latency | Global | Regional options |
| Integration | Standalone | Unified with GCP services |
| Enterprise features | Basic | Advanced (VPC, audit logs, etc.) |

## Next Steps

- [Understanding Claude Code Settings](./claude-code-settings.md) (coming soon)
- [Cost Management for Claude Code](./claude-code-cost-management.md) (coming soon)
- [Optimizing Claude Code Performance](./optimizing-claude-code-performance.md) (coming soon)
- [Using MCP Servers with Claude Code](./using-mcp-servers.md) (coming soon)

## References

- [Official Claude Code Vertex AI Documentation](https://code.claude.com/docs/en/google-vertex-ai)
- [Claude Code Settings Reference](https://code.claude.com/docs/en/settings)
- [Vertex AI Documentation](https://cloud.google.com/vertex-ai/docs)
- [Google Cloud Authentication](https://cloud.google.com/docs/authentication)
- [Vertex AI Pricing](https://cloud.google.com/vertex-ai/pricing)

---

**Last Updated:** 2026-01-17
**Maintainer:** Travis Edgar
