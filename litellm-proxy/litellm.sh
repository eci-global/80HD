#!/bin/bash
# LiteLLM Proxy Server — observability passthrough to Vertex AI
# Usage: ./litellm.sh [start|stop|restart|status]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

PID_FILE="$SCRIPT_DIR/litellm_proxy.pid"
PROJECT_ROOT="$(cd .. && pwd)"
PROXY_LOG="$SCRIPT_DIR/litellm_proxy.log"

# Activate virtual environment
if [ -f "$PROJECT_ROOT/.venv/bin/activate" ]; then
    source "$PROJECT_ROOT/.venv/bin/activate"
else
    echo "ERROR: Virtual environment not found at $PROJECT_ROOT/.venv"
    echo "Run: cd $PROJECT_ROOT && python3 -m venv .venv && source .venv/bin/activate && pip install -r litellm-proxy/requirements.txt"
    exit 1
fi

# Load environment variables from .env
if [ -f "$PROJECT_ROOT/.env" ]; then
    set -a
    source "$PROJECT_ROOT/.env"
    set +a
else
    echo "WARNING: .env file not found at $PROJECT_ROOT/.env"
    echo "Langfuse callbacks may not work without LANGFUSE_* variables"
fi

# Check config
if [ ! -f "litellm_config.yaml" ]; then
    echo "ERROR: litellm_config.yaml not found in $SCRIPT_DIR!"
    exit 1
fi

export LITELLM_LOG="ERROR"

COMMAND="${1:-start}"

is_running() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0
        else
            rm -f "$PID_FILE"
            return 1
        fi
    fi
    return 1
}

stop_proxy() {
    if is_running; then
        local pid=$(cat "$PID_FILE")
        echo "Stopping LiteLLM Proxy (PID: $pid)..."
        kill "$pid" 2>/dev/null
        local count=0
        while ps -p "$pid" > /dev/null 2>&1 && [ $count -lt 10 ]; do
            sleep 1
            count=$((count + 1))
        done
        if ps -p "$pid" > /dev/null 2>&1; then
            echo "Process didn't stop gracefully, forcing kill..."
            kill -9 "$pid" 2>/dev/null
        fi
        rm -f "$PID_FILE"
        echo "Proxy stopped."
    else
        echo "Proxy is not running."
    fi
}

ensure_port_free() {
    local listening
    listening=$(lsof -t -iTCP:4000 -sTCP:LISTEN 2>/dev/null | tr '\n' ' ')
    if [ -n "$listening" ]; then
        echo "ERROR: Another process is already listening on port 4000 (PID(s): $listening)"
        echo "Stop that process or use ./litellm.sh stop before starting."
        return 1
    fi
    return 0
}

start_proxy() {
    if is_running; then
        local pid=$(cat "$PID_FILE")
        echo "Proxy is already running (PID: $pid). Use './litellm.sh restart' to restart."
        return 1
    fi

    if ! ensure_port_free; then
        return 1
    fi

    echo "Starting LiteLLM Proxy..."
    echo "Config: $SCRIPT_DIR/litellm_config.yaml"
    echo "Access at: http://localhost:4000"
    echo "Logs: $PROXY_LOG"
    echo ""

    nohup litellm --config litellm_config.yaml --port 4000 >> "$PROXY_LOG" 2>&1 &
    local pid=$!
    echo $pid > "$PID_FILE"

    sleep 2
    if ps -p "$pid" > /dev/null 2>&1; then
        echo "Proxy started (PID: $pid)"
        echo "Monitor: tail -f $PROXY_LOG"
        echo "Stop:    ./litellm.sh stop"
        return 0
    else
        echo "Failed to start proxy. Check logs: tail -f $PROXY_LOG"
        rm -f "$PID_FILE"
        return 1
    fi
}

show_status() {
    if is_running; then
        local pid=$(cat "$PID_FILE")
        echo "LiteLLM Proxy is running (PID: $pid)"
        if curl -s http://localhost:4000/health > /dev/null 2>&1; then
            echo "Proxy is responding at http://localhost:4000"
        else
            echo "Proxy process is running but not responding"
        fi
    else
        echo "LiteLLM Proxy is not running"
    fi
}

case "$COMMAND" in
    start)   start_proxy ;;
    stop)    stop_proxy ;;
    restart) stop_proxy; sleep 1; start_proxy ;;
    status)  show_status ;;
    *)
        echo "Usage: $0 [start|stop|restart|status]"
        exit 1
        ;;
esac
