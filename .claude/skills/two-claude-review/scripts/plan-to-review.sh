#!/bin/bash
# Copy plan from planning worktree to review worktree
#
# This script helps transfer the plan written by Claude A to Claude B for review.
#
# Usage: ./plan-to-review.sh [plan-file]
#   plan-file: Optional path to plan file (default: current-plan.md)

set -e

PLANNING_DIR="$HOME/Projects/80HD-planning"
REVIEW_DIR="$HOME/Projects/80HD-review"

# Default plan file
PLAN_FILE="${1:-current-plan.md}"
PLAN_PATH="$PLANNING_DIR/$PLAN_FILE"
REVIEW_PATH="$REVIEW_DIR/plan-under-review.md"

# Check if planning worktree exists
if [ ! -d "$PLANNING_DIR" ]; then
  echo "Error: Planning worktree not found at $PLANNING_DIR"
  exit 1
fi

# Check if review worktree exists
if [ ! -d "$REVIEW_DIR" ]; then
  echo "Error: Review worktree not found at $REVIEW_DIR"
  exit 1
fi

# Check if plan file exists
if [ ! -f "$PLAN_PATH" ]; then
  echo "Error: Plan file not found at $PLAN_PATH"
  echo ""
  echo "Available files in planning worktree:"
  ls -1 "$PLANNING_DIR"/*.md 2>/dev/null || echo "  (no .md files found)"
  exit 1
fi

# Copy plan to review worktree
echo "Copying plan from planning to review worktree..."
cp "$PLAN_PATH" "$REVIEW_PATH"

echo "✓ Plan copied to review worktree"
echo ""
echo "Next steps:"
echo "1. Open review worktree: cd $REVIEW_DIR"
echo "2. Read the plan: cat plan-under-review.md"
echo "3. Use a reviewer prompt from .claude/skills/two-claude-review/PROMPTS.md"
echo "4. Paste the plan into Claude B with the reviewer prompt"
echo ""
echo "Or use this command to view the plan:"
echo "  cat $REVIEW_PATH"
