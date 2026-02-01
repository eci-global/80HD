#!/bin/bash
# Start two-Claude review session with tmux split terminal
#
# This script launches a tmux session with:
# - Left pane: Planning worktree (Claude A - the planner)
# - Right pane: Review worktree (Claude B - the reviewer)
#
# Usage: ./two-claude-start.sh

set -e

PROJECT_DIR="$HOME/Projects/80HD"
PLANNING_DIR="$HOME/Projects/80HD-planning"
REVIEW_DIR="$HOME/Projects/80HD-review"

# Check if worktrees exist
if [ ! -d "$PLANNING_DIR" ]; then
  echo "Error: Planning worktree not found at $PLANNING_DIR"
  echo "Run setup first: see .claude/skills/two-claude-review/SETUP.md"
  exit 1
fi

if [ ! -d "$REVIEW_DIR" ]; then
  echo "Error: Review worktree not found at $REVIEW_DIR"
  echo "Run setup first: see .claude/skills/two-claude-review/SETUP.md"
  exit 1
fi

# Kill existing session if it exists
tmux kill-session -t two-claude 2>/dev/null || true

# Create new tmux session
echo "Starting two-Claude review session..."

tmux new-session -d -s two-claude -n "Two-Claude" \; \
  send-keys "cd $PLANNING_DIR && clear && echo '🟢 PLANNER (Claude A)' && echo 'Role: Write implementation plans' && echo 'Worktree: planning' && echo '' && claude" C-m \; \
  split-window -h \; \
  send-keys "cd $REVIEW_DIR && clear && echo '🔵 REVIEWER (Claude B)' && echo 'Role: Critical review as staff engineer' && echo 'Worktree: review' && echo '' && echo 'Waiting for plan from Claude A...'" C-m \; \
  select-pane -t 0 \; \
  attach-session -t two-claude

echo "Two-Claude session started!"
