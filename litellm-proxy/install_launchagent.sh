#!/bin/bash
# Install LiteLLM Proxy as a macOS LaunchAgent
# This will make the proxy start automatically on login and restart if it crashes

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST_NAME="com.tedgar.litellm-proxy.plist"
PLIST_FILE="$SCRIPT_DIR/$PLIST_NAME"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
INSTALLED_PLIST="$LAUNCH_AGENTS_DIR/$PLIST_NAME"

# Detect project root (could be main directory or worktree)
if [ -d "$SCRIPT_DIR/../.git" ]; then
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
else
    # Try to find the actual project root
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
fi

echo "🔧 Installing LiteLLM Proxy LaunchAgent..."
echo ""
echo "Project Root: $PROJECT_ROOT"
echo "Script Dir: $SCRIPT_DIR"
echo ""

# Check if plist file exists
if [ ! -f "$PLIST_FILE" ]; then
    echo "❌ Error: $PLIST_FILE not found!"
    exit 1
fi

# Update paths in plist file (create a temporary version with correct paths)
TEMP_PLIST=$(mktemp)
sed "s|/Users/tedgar/Projects/azure|$PROJECT_ROOT|g" "$PLIST_FILE" > "$TEMP_PLIST"

# Also update the run_proxy.sh path in the plist
sed -i '' "s|$PROJECT_ROOT/litellm-proxy/run_proxy.sh|$SCRIPT_DIR/run_proxy.sh|g" "$TEMP_PLIST" 2>/dev/null || \
sed -i "s|$PROJECT_ROOT/litellm-proxy/run_proxy.sh|$SCRIPT_DIR/run_proxy.sh|g" "$TEMP_PLIST"

# Create LaunchAgents directory if it doesn't exist
mkdir -p "$LAUNCH_AGENTS_DIR"

# Copy plist to LaunchAgents directory
echo "📋 Copying plist file to $LAUNCH_AGENTS_DIR..."
cp "$TEMP_PLIST" "$INSTALLED_PLIST"
rm "$TEMP_PLIST"

# Set correct permissions
chmod 644 "$INSTALLED_PLIST"

# Unload existing service if it's running
if launchctl list | grep -q "com.tedgar.litellm-proxy"; then
    echo "🛑 Stopping existing service..."
    launchctl unload "$INSTALLED_PLIST" 2>/dev/null || true
fi

# Load the service
echo "🚀 Loading LaunchAgent..."
launchctl load "$INSTALLED_PLIST"

# Wait a moment for it to start
sleep 2

# Check if it's running
if launchctl list | grep -q "com.tedgar.litellm-proxy"; then
    echo ""
    echo "✅ LiteLLM Proxy LaunchAgent installed and started!"
    echo ""
    echo "The proxy will now:"
    echo "  • Start automatically when you log in"
    echo "  • Restart automatically if it crashes"
    echo "  • Run in the background"
    echo ""
    echo "Useful commands:"
    echo "  • Check status: launchctl list | grep litellm"
    echo "  • View logs: tail -f $SCRIPT_DIR/litellm_proxy.log"
    echo "  • Stop: launchctl unload $INSTALLED_PLIST"
    echo "  • Start: launchctl load $INSTALLED_PLIST"
    echo "  • Restart: launchctl unload $INSTALLED_PLIST && launchctl load $INSTALLED_PLIST"
    echo ""
    echo "To uninstall, run: ./uninstall_launchagent.sh"
else
    echo "⚠️  Warning: Service may not have started. Check logs:"
    echo "   tail -f $SCRIPT_DIR/litellm_proxy.log"
    exit 1
fi

