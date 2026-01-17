# LiteLLM Complexity Router Proxy

A LiteLLM proxy with intelligent complexity-based routing that automatically selects the appropriate Claude model based on task complexity.

## Overview

This proxy intercepts LLM requests and routes them to the optimal Claude model:

| Complexity | Model | Use Case |
|------------|-------|----------|
| **SIMPLE** | Claude Haiku | Quick questions, confirmations, tool output processing |
| **MODERATE** | Claude Sonnet | Code writing, debugging, refactoring, API integrations |
| **COMPLEX** | Claude Opus | Architecture design, multi-step planning, complex migrations |

## Features

### Complexity-Based Routing
- Uses Haiku to quickly classify incoming prompts
- Routes code writing tasks to Sonnet (better for code)
- Routes architectural tasks to Opus (better for planning)
- Falls back to Haiku for simple tasks (cost-effective)

### Session-Bound Overrides
Users can temporarily override routing for their session:
```
"use opus for 5 minutes"     → Forces Opus for 5 minutes
"use sonnet for 10 min"      → Forces Sonnet for 10 minutes
"switch to haiku"            → Forces Haiku (default 5 min)
"cancel the override"        → Clears override
```

### Observability
- **Langfuse** integration for tracing and analytics
- **Coralogix** OTEL span export for distributed tracing
- Structured logging with request/response capture

### Policy Enforcement
- Repository-scoped policy contracts (README.md + AGENTS.md)
- Context exhaustion protection with automatic trimming
- Ledger reminder injection for session recovery

## Directory Structure

```
litellm-proxy/
├── complexity_router.py       # Main router with classification logic
├── litellm_config.yaml        # LiteLLM proxy configuration
├── requirements.txt           # Python dependencies
├── README.md                  # This file
├── litellm.sh                 # Main management script
├── run_proxy.sh               # LaunchAgent wrapper
├── manage_proxy.sh            # LaunchAgent service management
├── install_launchagent.sh     # macOS service installation
├── uninstall_launchagent.sh   # macOS service removal
├── monitor_logs.sh            # Log monitoring helper
├── generate_virtual_key.sh    # API key generation
├── check_coralogix_health.py  # OTEL health check script
└── run_otelcol_debug.sh       # Local OTEL collector for debugging
```

## Quick Start

### 1. Install Dependencies

```bash
cd litellm-proxy
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure Environment

Create a `.env` file in the project root with:

```bash
# LiteLLM Proxy
LITELLM_MASTER_KEY=sk-your-master-key

# Google Cloud / Vertex AI (for Claude models)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
VERTEX_PROJECT=your-gcp-project
VERTEX_LOCATION=us-east5

# Langfuse (optional)
LANGFUSE_PUBLIC_KEY=pk_xxx
LANGFUSE_SECRET_KEY=sk_xxx
LANGFUSE_HOST=https://cloud.langfuse.com

# Coralogix (optional)
OBS_BACKEND=both  # "langfuse", "coralogix", or "both"
CX_SEND_DATA_TOKEN=your-coralogix-token
CX_ENDPOINT=ingress.us2.coralogix.com:443
CX_APPLICATION_NAME=claude-code
CX_SUBSYSTEM_NAME=80hd
```

### 3. Start the Proxy

```bash
./litellm.sh start
```

The proxy runs at `http://localhost:4000`.

### 4. Configure Your LLM Client

Point your Claude Code or other LLM client to:
- **Base URL**: `http://localhost:4000`
- **API Key**: Your `LITELLM_MASTER_KEY`

## Management Commands

```bash
# Start/Stop/Restart
./litellm.sh start
./litellm.sh stop
./litellm.sh restart
./litellm.sh status

# View logs
./litellm.sh logs           # Both logs
tail -f complexity_router.log  # Router-specific

# Install as macOS service
./install_launchagent.sh    # Starts on login
./uninstall_launchagent.sh  # Remove service
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LITELLM_OVERRIDE_DEFAULT_TTL` | `5` | Default override duration (minutes) |
| `LITELLM_OVERRIDE_MAX_TTL` | `60` | Maximum override duration (minutes) |
| `COMPLEXITY_ROUTER_LOG_LEVEL` | `INFO` | Log level (DEBUG, INFO, WARNING, ERROR) |
| `LITELLM_CONTEXT_SOFT_LIMIT` | `180000` | Soft token limit for context trimming |
| `LITELLM_CONTEXT_HARD_LIMIT` | `200000` | Hard token limit |
| `OBS_BACKEND` | `langfuse` | Observability backend(s): langfuse, coralogix, both |

### Model Configuration

Edit `litellm_config.yaml` to configure model mappings:

```yaml
model_list:
  - model_name: claude-haiku-4-5
    litellm_params:
      model: vertex_ai/claude-haiku-4-5@20251001
      vertex_project: your-project
      vertex_location: us-east5

  - model_name: claude-sonnet-4-5
    litellm_params:
      model: vertex_ai/claude-sonnet-4-5@20250514
      # ...
```

## Observability

### Langfuse

Traces are sent to Langfuse with:
- Environment tag (repo name or "unscoped")
- Complexity classification
- Original vs routed model
- Token usage and latency

### Coralogix

OTEL spans are exported with:
- `litellm.request` span name
- GenAI semantic conventions
- Custom attributes for routing metadata

### Local OTEL Collector (Debugging)

```bash
# Start local collector
./run_otelcol_debug.sh

# Check health
python check_coralogix_health.py --emit-test-span
```

## Development

### Running Tests

```bash
# Syntax check
python -m py_compile complexity_router.py

# Health check
python check_coralogix_health.py --minutes 60
```

### Debugging

```bash
# Enable debug logging
export COMPLEXITY_ROUTER_LOG_LEVEL=DEBUG
./litellm.sh restart

# Monitor logs in real-time
./monitor_logs.sh
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         LLM Client                               │
│                    (Claude Code, Cursor)                         │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LiteLLM Proxy (:4000)                         │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              ComplexityRouter (async_pre_call_hook)         ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  ││
│  │  │  Override   │  │  Classify   │  │   Policy/Context    │  ││
│  │  │   Check     │──│  with Haiku │──│    Enforcement      │  ││
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  ││
│  └─────────────────────────────────────────────────────────────┘│
│                          │                                       │
│  ┌───────────────────────┴───────────────────────────────────┐  │
│  │                    Model Router                            │  │
│  │   SIMPLE → Haiku  │  MODERATE → Sonnet  │  COMPLEX → Opus  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Vertex AI (Claude Models)                     │
└─────────────────────────────────────────────────────────────────┘
```

## License

Internal use only.


