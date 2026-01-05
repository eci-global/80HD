#!/bin/bash
# Monitor LiteLLM Proxy and Router logs
# Usage: ./monitor_logs.sh [proxy|router|both]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROXY_LOG="$SCRIPT_DIR/litellm_proxy.log"
ROUTER_LOG="$SCRIPT_DIR/complexity_router.log"

MODE="${1:-both}"

case "$MODE" in
    proxy)
        echo "📝 Monitoring proxy logs: $PROXY_LOG"
        echo "Press Ctrl+C to stop"
        echo ""
        tail -f "$PROXY_LOG"
        ;;
    router)
        echo "📝 Monitoring router logs: $ROUTER_LOG"
        echo "Press Ctrl+C to stop"
        echo ""
        tail -f "$ROUTER_LOG"
        ;;
    both|*)
        echo "📝 Monitoring both logs:"
        echo "  Proxy:  $PROXY_LOG"
        echo "  Router: $ROUTER_LOG"
        echo "Press Ctrl+C to stop"
        echo ""
        # Use multitail if available, otherwise tail both files
        if command -v multitail &> /dev/null; then
            multitail -s 2 "$PROXY_LOG" "$ROUTER_LOG"
        else
            tail -f "$PROXY_LOG" "$ROUTER_LOG"
        fi
        ;;
esac


