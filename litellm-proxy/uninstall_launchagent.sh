#!/bin/bash
# Uninstall LiteLLM Proxy LaunchAgent

set -e

PLIST_NAME="com.tedgar.litellm-proxy.plist"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
INSTALLED_PLIST="$LAUNCH_AGENTS_DIR/$PLIST_NAME"

echo "🗑️  Uninstalling LiteLLM Proxy LaunchAgent..."
echo ""

# Check if service is loaded
if launchctl list | grep -q "com.tedgar.litellm-proxy"; then
    echo "🛑 Stopping service..."
    launchctl unload "$INSTALLED_PLIST" 2>/dev/null || true
    sleep 1
fi

# Remove plist file
if [ -f "$INSTALLED_PLIST" ]; then
    echo "📋 Removing plist file..."
    rm "$INSTALLED_PLIST"
    echo "✅ LaunchAgent uninstalled!"
else
    echo "ℹ️  LaunchAgent was not installed."
fi

echo ""
echo "The proxy is no longer managed by launchd."
echo "You can still run it manually with: ./start_litellm.sh"


