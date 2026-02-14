# LiteLLM Proxy — Claude Code Observability Gateway

Routes all Claude Code requests through a local LiteLLM proxy to Vertex AI, with Langfuse tracing for full observability (cost, latency, token counts, input/output).

## Architecture

```
Claude Code CLI (Anthropic API format)
  │
  │  ANTHROPIC_BASE_URL=http://localhost:4000
  │  ANTHROPIC_AUTH_TOKEN=<litellm-master-key>
  │
  ▼
LiteLLM Proxy (localhost:4000)
  │
  ├──► Vertex AI (eci-global-it / us-east5)
  │    Translates Anthropic API format → Vertex AI format
  │    Handles Google ADC authentication
  │
  └──► Langfuse (localhost:3100)
       Traces: model, tokens, cost, latency, input/output
```

## Quick Start

```bash
# 1. Start Langfuse (if not already running)
cd /Users/tedgar/Projects/80HD/langfuse
docker compose up -d

# 2. Start proxy
cd /Users/tedgar/Projects/80HD/litellm-proxy
./litellm.sh start

# 3. Open a new terminal and start Claude Code — traffic routes automatically
claude
```

## Proxy Management

```bash
./litellm.sh start     # Start proxy (port 4000)
./litellm.sh stop      # Stop proxy
./litellm.sh restart   # Restart proxy
./litellm.sh status    # Check if running + responsive
```

Logs: `tail -f /Users/tedgar/Projects/80HD/litellm-proxy/litellm_proxy.log`

## How Claude Code Connects

Three environment variables control the routing. All set in `~/.zshrc`:

| Variable | Value | Purpose |
|----------|-------|---------|
| `ANTHROPIC_BASE_URL` | `http://localhost:4000` | Redirects Claude Code to the proxy |
| `ANTHROPIC_AUTH_TOKEN` | `<litellm-master-key>` | Sent as `Authorization: Bearer` header |
| `unset CLAUDE_CODE_USE_VERTEX` | (unset) | Ensures Vertex SDK is NOT used directly |

### Critical: Why CLAUDE_CODE_USE_VERTEX Must Be Unset

`CLAUDE_CODE_USE_VERTEX=1` tells Claude Code to use the **Google Vertex AI SDK directly**. This causes Claude Code to:

1. Authenticate with Google Application Default Credentials (ADC)
2. Call Vertex AI endpoints directly (e.g., `us-east5-aiplatform.googleapis.com`)
3. **Completely bypass `ANTHROPIC_BASE_URL`** — traffic never hits the proxy

When `CLAUDE_CODE_USE_VERTEX` is unset (or absent), Claude Code:

1. Uses the standard **Anthropic Messages API format**
2. Sends requests to `ANTHROPIC_BASE_URL` (the proxy)
3. LiteLLM translates to Vertex AI format and handles Google auth on the backend

**The proxy handles Vertex routing.** Claude Code doesn't need to know about Vertex at all.

If Vertex mode was previously set in `~/.claude/settings.json`, remove these env vars:
- `CLAUDE_CODE_USE_VERTEX`
- `ANTHROPIC_VERTEX_PROJECT_ID`
- `CLOUD_ML_REGION`
- `GOOGLE_CLOUD_PROJECT`

These belong in `litellm_config.yaml` (where each model's `vertex_project` and `vertex_location` are configured), not in Claude Code settings.

## Model Routing

LiteLLM maps Claude Code model names to Vertex AI models:

| Claude Code requests | LiteLLM routes to | Endpoint | Status |
|---------------------|-------------------|----------|--------|
| `claude-sonnet-4-5-20250929` / `claude-sonnet-4-5` / `claude-sonnet-4-5@20250929` | `vertex_ai/claude-sonnet-4-5@20250929` | Global | ✅ Verified |
| `claude-haiku-4-5-20251001` / `claude-haiku-4-5` | `vertex_ai/claude-haiku-4-5@20251001` | Global | ✅ Verified |
| `claude-opus-4-5` | `vertex_ai/claude-opus-4-5@20251101` | Global | ✅ Verified |
| `claude-opus-4-6` | `vertex_ai/claude-opus-4-6` | Global | ✅ Verified |
| `claude-opus-4-6-regional` | `vertex_ai/claude-opus-4-6` | Regional (us-east5, +10% cost) | ✅ Available |

All models route to project `eci-global-it`.

### Global vs Regional Endpoints

For **Sonnet 4.5, Haiku 4.5, Opus 4.5, and Opus 4.6**, Vertex AI offers two endpoint types:

- **Global** (default) — Dynamic routing for maximum availability, no pricing premium
- **Regional** — Guaranteed data routing through specific region (us-east5), +10% cost

**Vertex AI Model IDs:**
- Opus 4.6: `claude-opus-4-6` (no version suffix)
- Opus 4.5: `claude-opus-4-5@20251101`
- Sonnet 4.5: `claude-sonnet-4-5@20250929`
- Haiku 4.5: `claude-haiku-4-5@20251001`

See [Anthropic's Vertex AI documentation](https://docs.anthropic.com/en/api/claude-on-vertex-ai) for the latest model IDs.

## Configuration Files

| File | Purpose |
|------|---------|
| `litellm_config.yaml` | Model list, router settings, Langfuse callback, Vertex AI credentials |
| `litellm.sh` | Start/stop/restart/status script |
| `requirements.txt` | Python dependencies (`litellm[proxy]`, `langfuse<3.0`) |
| `~/.zshrc` | `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN` |
| `~/.claude/settings.json` | `ANTHROPIC_MODEL` and `ANTHROPIC_SMALL_FAST_MODEL` (model defaults only) |
| `~/Projects/80HD/.env` | `LANGFUSE_*` vars and `LITELLM_MASTER_KEY` |

## Langfuse Integration

The proxy sends traces to self-hosted Langfuse at `localhost:3100` via the `langfuse` callback in `litellm_config.yaml`. Each trace includes:

- Model requested vs model used
- Input/output messages
- Token counts (input, output, total)
- Cost (based on model pricing in config)
- Latency
- Tags: `claude-code` source identifier

View traces: `http://localhost:3100` (login: `tedgar@ecisolutions.com` / `langfuse-local`)

See `../langfuse/README.md` for Langfuse setup details.

## Troubleshooting

### No traces in Langfuse

1. **Is the proxy running?** `./litellm.sh status`
2. **Is Langfuse running?** `docker compose -f ../langfuse/docker-compose.yml ps`
3. **Is `CLAUDE_CODE_USE_VERTEX` set?** Run `echo $CLAUDE_CODE_USE_VERTEX` in a new terminal. Must be empty/unset. If set, Claude Code bypasses the proxy entirely.
4. **Check proxy logs:** `tail -50 litellm_proxy.log` — look for incoming requests and Langfuse callback errors
5. **Langfuse v3 SDK conflict?** LiteLLM requires `langfuse<3.0`. Check: `pip show langfuse | grep Version`. If v3.x, downgrade: `pip install 'langfuse>=2.60,<3.0'`

### Claude Code says "connection refused" or hangs

1. **Proxy not started.** Run `./litellm.sh start`
2. **Port 4000 conflict.** Check: `lsof -i :4000`
3. **Stale PID file.** Delete `litellm_proxy.pid` and retry

### 401 Unauthorized from proxy

The `ANTHROPIC_AUTH_TOKEN` in `~/.zshrc` must match the `LITELLM_MASTER_KEY` in `~/Projects/80HD/.env`.

### Google auth errors in proxy logs

The proxy uses Google ADC for Vertex AI. Ensure:
```bash
gcloud auth application-default login
# Verify:
gcloud auth application-default print-access-token
```

### Model not found / 404 errors from Vertex AI

If you see `404: Publisher Model ... was not found` in the logs:

1. **Check the model ID** — Vertex AI model IDs don't always match Anthropic's naming. Use the [Anthropic Vertex AI docs](https://docs.anthropic.com/en/api/claude-on-vertex-ai) to verify the correct model ID.
2. **Verify model availability** — Search for "Claude" in the [Vertex AI Model Garden](https://cloud.google.com/model-garden) to check regional availability.
3. **Check for version suffixes** — Newer models (Opus 4.6) may not have `@YYYYMMDD` suffixes. Older models (Opus 4.1, Sonnet 4.5, Haiku 4.5) require them.

**Example:** Opus 4.6 uses `claude-opus-4-6` (no suffix), not `claude-opus-4-6@20250514`.

## LaunchAgent (Auto-Start on Boot)

```bash
# Install (starts proxy automatically on login)
./install_launchagent.sh

# Uninstall
./uninstall_launchagent.sh
```

## Known Issues

- **Langfuse SDK v3.x incompatible** with LiteLLM 1.81.11. Must use v2.x. See `../langfuse/README.md` for details.
- **LiteLLM patches** — Two one-line patches applied to `.venv/.../litellm/integrations/langfuse/` for `sdk_integration` parameter. Lost on LiteLLM upgrade. See CLAUDE.local.md for details.
- **Token counting disabled** — Vertex AI doesn't support `/v1/messages/count_tokens`. Endpoint is blocked in config to avoid 500 errors.
