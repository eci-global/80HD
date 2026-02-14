#!/bin/bash
# Manage LiteLLM Proxy service (start, stop, restart, status)

PLIST_NAME="com.tedgar.litellm-proxy.plist"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
INSTALLED_PLIST="$LAUNCH_AGENTS_DIR/$PLIST_NAME"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

case "$1" in
    start)
        if [ -f "$INSTALLED_PLIST" ]; then
            echo "🚀 Starting LiteLLM Proxy..."
            launchctl load "$INSTALLED_PLIST" 2>/dev/null || launchctl start com.tedgar.litellm-proxy
            sleep 1
            if launchctl list | grep -q "com.tedgar.litellm-proxy"; then
                echo "✅ Proxy started!"
            else
                echo "❌ Failed to start proxy. Check logs: tail -f $SCRIPT_DIR/litellm_proxy.log"
            fi
        else
            echo "❌ LaunchAgent not installed. Run: ./install_launchagent.sh"
            exit 1
        fi
        ;;
    stop)
        if [ -f "$INSTALLED_PLIST" ]; then
            echo "🛑 Stopping LiteLLM Proxy..."
            launchctl unload "$INSTALLED_PLIST" 2>/dev/null || launchctl stop com.tedgar.litellm-proxy
            sleep 1
            echo "✅ Proxy stopped!"
        else
            echo "❌ LaunchAgent not installed."
            exit 1
        fi
        ;;
    restart)
        if [ -f "$INSTALLED_PLIST" ]; then
            echo "🔄 Restarting LiteLLM Proxy..."
            launchctl unload "$INSTALLED_PLIST" 2>/dev/null || true
            sleep 1
            launchctl load "$INSTALLED_PLIST"
            sleep 1
            if launchctl list | grep -q "com.tedgar.litellm-proxy"; then
                echo "✅ Proxy restarted!"
            else
                echo "❌ Failed to restart proxy. Check logs: tail -f $SCRIPT_DIR/litellm_proxy.log"
            fi
        else
            echo "❌ LaunchAgent not installed. Run: ./install_launchagent.sh"
            exit 1
        fi
        ;;
    status)
        if [ -f "$INSTALLED_PLIST" ]; then
            if launchctl list | grep -q "com.tedgar.litellm-proxy"; then
                echo "✅ LiteLLM Proxy is running"
                echo ""
                echo "Service details:"
                launchctl list | grep "com.tedgar.litellm-proxy" || true
                echo ""
                echo "Check if proxy is responding:"
                if curl -s http://localhost:4000/health > /dev/null 2>&1; then
                    echo "✅ Proxy is responding at http://localhost:4000"
                else
                    echo "⚠️  Proxy is not responding (may still be starting)"
                fi
            else
                echo "❌ LiteLLM Proxy is not running"
                echo ""
                echo "To start it, run: ./manage_proxy.sh start"
            fi
        else
            echo "❌ LaunchAgent not installed"
            echo ""
            echo "To install, run: ./install_launchagent.sh"
        fi
        ;;
    logs)
        echo "Showing proxy logs (Ctrl+C to exit)..."
        echo ""
        tail -f "$SCRIPT_DIR/litellm_proxy.log"
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        echo ""
        echo "Commands:"
        echo "  start    - Start the proxy service"
        echo "  stop     - Stop the proxy service"
        echo "  restart  - Restart the proxy service"
        echo "  status   - Check if the proxy is running"
        echo "  logs     - Tail the proxy logs"
        exit 1
        ;;
esac


