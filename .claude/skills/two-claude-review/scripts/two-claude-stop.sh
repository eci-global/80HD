#!/bin/bash
# Stop two-Claude review session and optionally clean up worktrees
#
# Usage:
#   ./two-claude-stop.sh           # Stop tmux session only
#   ./two-claude-stop.sh --cleanup # Stop and remove worktrees

set -e

PROJECT_DIR="$HOME/Projects/80HD"

# Kill tmux session
echo "Stopping two-Claude session..."
tmux kill-session -t two-claude 2>/dev/null && echo "✓ Tmux session stopped" || echo "No active tmux session"

# Cleanup worktrees if requested
if [ "$1" == "--cleanup" ]; then
  echo ""
  echo "WARNING: This will remove all two-Claude worktrees."
  echo "Any uncommitted changes will be lost."
  read -p "Continue? (y/N) " -n 1 -r
  echo

  if [[ $REPLY =~ ^[Yy]$ ]]; then
    cd "$PROJECT_DIR"

    echo "Removing worktrees..."
    git worktree remove ../80HD-planning --force 2>/dev/null && echo "✓ Removed planning worktree" || echo "Planning worktree not found"
    git worktree remove ../80HD-review --force 2>/dev/null && echo "✓ Removed review worktree" || echo "Review worktree not found"
    git worktree remove ../80HD-analysis --force 2>/dev/null && echo "✓ Removed analysis worktree" || echo "Analysis worktree not found"

    echo "Pruning stale references..."
    git worktree prune

    echo ""
    echo "✓ Cleanup complete!"
    echo "To recreate worktrees, run the setup script again."
  else
    echo "Cleanup cancelled."
  fi
fi

echo "Done."
