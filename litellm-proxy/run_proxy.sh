#!/bin/bash
# Wrapper script for launchd to run the LiteLLM proxy
# This script handles venv activation and environment setup

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Go up one level to project root to find .venv and .env
PROJECT_ROOT="$(cd .. && pwd)"

# Activate virtual environment
if [ -f "$PROJECT_ROOT/.venv/bin/activate" ]; then
    source "$PROJECT_ROOT/.venv/bin/activate"
else
    echo "ERROR: Virtual environment not found at $PROJECT_ROOT/.venv" >&2
    exit 1
fi

# Load environment variables from .env if it exists
if [ -f "$PROJECT_ROOT/.env" ]; then
    set -a
    source "$PROJECT_ROOT/.env"
    set +a
fi

# Set log level
export LITELLM_LOG="ERROR"

# Check if config file exists
if [ ! -f "$SCRIPT_DIR/litellm_config.yaml" ]; then
    echo "ERROR: litellm_config.yaml not found in $SCRIPT_DIR!" >&2
    exit 1
fi

# Run the proxy (launchd will capture stdout/stderr)
exec litellm --config "$SCRIPT_DIR/litellm_config.yaml" --port 4000


