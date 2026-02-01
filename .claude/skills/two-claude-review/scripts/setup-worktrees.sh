#!/bin/bash
# Set up git worktrees for two-Claude pattern
#
# This script creates the three worktrees needed for the two-Claude pattern:
# - planning: For Claude A to write implementation plans
# - review: For Claude B to review plans as staff engineer
# - analysis: For read-only investigation
#
# Usage: ./setup-worktrees.sh

set -e

# Detect project directory (should be run from repo root)
if [ ! -d ".git" ]; then
  echo "Error: Must be run from repository root (where .git directory is)"
  echo "Current directory: $(pwd)"
  exit 1
fi

PROJECT_DIR=$(pwd)
PROJECT_NAME=$(basename "$PROJECT_DIR")
PARENT_DIR=$(dirname "$PROJECT_DIR")

echo "Setting up worktrees for: $PROJECT_NAME"
echo "Project directory: $PROJECT_DIR"
echo ""

# Create worktrees if they don't exist
create_worktree() {
  local branch=$1
  local worktree_path="$PARENT_DIR/${PROJECT_NAME}-${branch}"

  if [ -d "$worktree_path" ]; then
    echo "⚠️  Worktree already exists: $worktree_path"
  else
    echo "Creating $branch worktree..."
    git worktree add -b "$branch" "$worktree_path" main

    # Create .claude directory and config
    mkdir -p "$worktree_path/.claude"

    case $branch in
      planning)
        cat > "$worktree_path/.claude/worktree-config.json" << 'EOF'
{
  "worktree": "planning",
  "role": "planner",
  "focus": "Writing comprehensive implementation plans"
}
EOF
        ;;
      review)
        cat > "$worktree_path/.claude/worktree-config.json" << 'EOF'
{
  "worktree": "review",
  "role": "reviewer",
  "focus": "Critical evaluation of plans as staff engineer"
}
EOF
        ;;
      analysis)
        cat > "$worktree_path/.claude/worktree-config.json" << 'EOF'
{
  "worktree": "analysis",
  "role": "investigator",
  "focus": "Read-only investigation and exploration"
}
EOF
        ;;
    esac

    echo "✓ Created $branch worktree at $worktree_path"
  fi
}

# Create all three worktrees
create_worktree "planning"
create_worktree "review"
create_worktree "analysis"

echo ""
echo "✓ Worktree setup complete!"
echo ""
echo "Worktrees created:"
git worktree list

echo ""
echo "Next steps:"
echo "1. Add shell aliases (see .claude/skills/two-claude-review/SETUP.md)"
echo "2. Test with: cd $PARENT_DIR/${PROJECT_NAME}-planning && claude"
echo ""
echo "Recommended aliases for your .zshrc or .bashrc:"
echo ""
echo "  alias plan='cd $PARENT_DIR/${PROJECT_NAME}-planning && claude'"
echo "  alias review='cd $PARENT_DIR/${PROJECT_NAME}-review && claude'"
echo "  alias analyze='cd $PARENT_DIR/${PROJECT_NAME}-analysis && claude'"
echo "  alias main='cd $PROJECT_DIR && claude'"
echo ""
