#!/bin/bash
# Start LiteLLM Proxy Server
# Usage: ./start_litellm.sh [start|stop|restart|status]

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# PID file for tracking the background process
PID_FILE="$SCRIPT_DIR/litellm_proxy.pid"

# Go up one level to project root to find .venv and .env
PROJECT_ROOT="$(cd .. && pwd)"

# Activate virtual environment from project root
if [ -f "$PROJECT_ROOT/.venv/bin/activate" ]; then
    source "$PROJECT_ROOT/.venv/bin/activate"
else
    echo "ERROR: Virtual environment not found at $PROJECT_ROOT/.venv"
    echo "Run: cd $PROJECT_ROOT && python3 -m venv .venv && source .venv/bin/activate && pip install 'litellm[proxy]' google-cloud-aiplatform"
    exit 1
fi

# Load environment variables from project root .env (using set -a to export all)
if [ -f "$PROJECT_ROOT/.env" ]; then
    echo "Loading environment variables from $PROJECT_ROOT/.env"
    set -a
    source "$PROJECT_ROOT/.env"
    set +a
else
    echo "⚠️  WARNING: .env file not found at $PROJECT_ROOT/.env"
    echo "   Langfuse callbacks may not work without LANGFUSE_* variables"
fi

# Set LANGFUSE_TRACING_ENVIRONMENT if not already set
# This will be used as the default environment for all traces
# Can be overridden by setting LITELLM_PROJECT_NAME or LANGFUSE_TRACING_ENVIRONMENT in .env
if [ -z "$LANGFUSE_TRACING_ENVIRONMENT" ]; then
    # Try to detect project name from git or directory
    if [ -n "$LITELLM_PROJECT_NAME" ]; then
        export LANGFUSE_TRACING_ENVIRONMENT="$LITELLM_PROJECT_NAME"
        echo "📁 Using LITELLM_PROJECT_NAME as environment: $LITELLM_PROJECT_NAME"
    else
        # Try git repo name
        GIT_REPO=$(cd "$PROJECT_ROOT" && git remote get-url origin 2>/dev/null | sed 's/.*\///;s/\.git$//')
        if [ -n "$GIT_REPO" ]; then
            export LANGFUSE_TRACING_ENVIRONMENT="$GIT_REPO"
            echo "📁 Detected git repo as environment: $GIT_REPO"
        else
            # Fallback to directory name
            DIR_NAME=$(basename "$PROJECT_ROOT")
            export LANGFUSE_TRACING_ENVIRONMENT="$DIR_NAME"
            echo "📁 Using directory name as environment: $DIR_NAME"
        fi
    fi
fi

# Check if config file exists
if [ ! -f "litellm_config.yaml" ]; then
    echo "ERROR: litellm_config.yaml not found in $SCRIPT_DIR!"
    exit 1
fi

# Set up log file paths
PROXY_LOG="$SCRIPT_DIR/litellm_proxy.log"
ROUTER_LOG="$SCRIPT_DIR/complexity_router.log"

# Set log level to ERROR to suppress INFO/DEBUG logs (including 404s)
export LITELLM_LOG="ERROR"

# ----------------------------------------------------------
# Request capture configuration (opt-in)
# ----------------------------------------------------------
CAPTURE_REQUESTS=${LITELLM_CAPTURE_REQUESTS:-false}
CAPTURE_DIR_DEFAULT="${LITELLM_CAPTURE_DIR:-/tmp/litellm_requests}"
CAPTURE_DIR="$CAPTURE_DIR_DEFAULT"

# Parse optional flags after the main command (e.g., ./litellm.sh start --capture)
COMMAND="${1:-start}"
shift || true
while [[ $# -gt 0 ]]; do
    case "$1" in
        --capture)
            CAPTURE_REQUESTS=true
            ;;
        --no-capture)
            CAPTURE_REQUESTS=false
            ;;
        --capture-dir=*)
            CAPTURE_DIR="${1#*=}"
            ;;
        *)
            echo "⚠️  Unknown option '$1' (supported: --capture, --no-capture, --capture-dir=PATH)"
            ;;
    esac
    shift
done

export LITELLM_CAPTURE_REQUESTS="$CAPTURE_REQUESTS"
export LITELLM_CAPTURE_DIR="$CAPTURE_DIR"

# Function to check if proxy is running
is_running() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0  # Running
        else
            # PID file exists but process is dead, clean it up
            rm -f "$PID_FILE"
            return 1  # Not running
        fi
    fi
    return 1  # Not running
}

# Function to stop the proxy
stop_proxy() {
    if is_running; then
        local pid=$(cat "$PID_FILE")
        echo "🛑 Stopping LiteLLM Proxy (PID: $pid)..."
        kill "$pid" 2>/dev/null
        # Wait for process to stop
        local count=0
        while ps -p "$pid" > /dev/null 2>&1 && [ $count -lt 10 ]; do
            sleep 1
            count=$((count + 1))
        done
        # Force kill if still running
        if ps -p "$pid" > /dev/null 2>&1; then
            echo "⚠️  Process didn't stop gracefully, forcing kill..."
            kill -9 "$pid" 2>/dev/null
        fi
        rm -f "$PID_FILE"
        echo "✅ Proxy stopped!"
    else
        echo "ℹ️  Proxy is not running"
    fi
}

# Function to ensure no other process is already bound to port 4000
ensure_port_free() {
    local listening
    listening=$(lsof -t -iTCP:4000 -sTCP:LISTEN 2>/dev/null | tr '\n' ' ')
    if [ -n "$listening" ]; then
        echo "❌ Another process is already listening on port 4000 (PID(s): $listening)"
        echo "   Stop that process (kill <pid>) or use ./litellm.sh stop before starting a new proxy."
        return 1
    fi
    return 0
}

# Function to start the proxy
start_proxy() {
    if is_running; then
        local pid=$(cat "$PID_FILE")
        echo "⚠️  Proxy is already running (PID: $pid)"
        echo "   Use './start_litellm.sh restart' to restart it"
        return 1
    fi

    if ! ensure_port_free; then
        return 1
    fi

    echo "🚀 Starting LiteLLM Proxy..."
    echo "Config: $SCRIPT_DIR/litellm_config.yaml"
    echo "Project Root: $PROJECT_ROOT"
    echo "Access at: http://localhost:4000"
    echo ""
    echo "📝 Proxy logs: $PROXY_LOG"
    echo "📝 Router logs: $ROUTER_LOG"
    echo ""
    echo "📸 Request capture: $LITELLM_CAPTURE_REQUESTS"
    echo "📁 Capture dir: $LITELLM_CAPTURE_DIR"
    echo ""

    # Start proxy in background, redirect output to log file
    nohup litellm --config litellm_config.yaml --port 4000 >> "$PROXY_LOG" 2>&1 &
    local pid=$!
    
    # Save PID
    echo $pid > "$PID_FILE"
    
    # Wait a moment to check if it started successfully
    sleep 2
    if ps -p "$pid" > /dev/null 2>&1; then
        echo "✅ Proxy started! (PID: $pid)"
        echo ""
        echo "Monitor logs with:"
        echo "  tail -f $PROXY_LOG"
        echo "  tail -f $ROUTER_LOG"
        echo "  tail -f $PROXY_LOG $ROUTER_LOG  # Both at once"
        echo ""
        echo "Stop with: ./start_litellm.sh stop"
        return 0
    else
        echo "❌ Failed to start proxy. Check logs: tail -f $PROXY_LOG"
        rm -f "$PID_FILE"
        return 1
    fi
}

# Function to show status
show_status() {
    if is_running; then
        local pid=$(cat "$PID_FILE")
        echo "✅ LiteLLM Proxy is running (PID: $pid)"
        # Check if it's responding
        if curl -s http://localhost:4000/health > /dev/null 2>&1 || curl -s http://localhost:4000 > /dev/null 2>&1; then
            echo "✅ Proxy is responding at http://localhost:4000"
        else
            echo "⚠️  Proxy process is running but not responding"
        fi
    else
        echo "❌ LiteLLM Proxy is not running"
    fi
}

# Main command handling
case "$COMMAND" in
    start)
        start_proxy
        ;;
    stop)
        stop_proxy
        ;;
    restart)
        stop_proxy
        sleep 1
        start_proxy
        ;;
    status)
        show_status
        ;;
    *)
        echo "Usage: $0 [start|stop|restart|status] [--capture|--no-capture] [--capture-dir=PATH]"
        echo ""
        echo "Commands:"
        echo "  start         - Start the proxy in the background (default)"
        echo "  stop          - Stop the running proxy"
        echo "  restart       - Restart the proxy"
        echo "  status        - Check if proxy is running"
        echo ""
        echo "Options:"
        echo "  --capture          Enable per-request snapshot capture for this run"
        echo "  --no-capture       Disable capture even if enabled in the environment"
        echo "  --capture-dir=PATH Override directory used to store request snapshots"
        exit 1
        ;;
esac
