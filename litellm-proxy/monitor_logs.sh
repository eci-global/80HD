#!/bin/bash
# Monitor LiteLLM Proxy logs
# Usage: ./monitor_logs.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROXY_LOG="$SCRIPT_DIR/litellm_proxy.log"

echo "Monitoring proxy logs: $PROXY_LOG"
echo "Press Ctrl+C to stop"
echo ""
tail -f "$PROXY_LOG"
