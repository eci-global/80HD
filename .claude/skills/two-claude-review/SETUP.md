# Two-Claude Review Setup Guide

This guide walks through setting up the two-Claude review pattern on your local machine.

## Quick Start

```bash
# 1. Create worktrees for parallel Claude sessions
cd ~/Projects/80HD
git worktree add ../80HD-planning planning
git worktree add ../80HD-review review
git worktree add ../80HD-analysis analysis

# 2. Add shell aliases
cat >> ~/.zshrc << 'EOF'
# Two-Claude pattern aliases
alias plan='cd ~/Projects/80HD-planning && claude'
alias review='cd ~/Projects/80HD-review && claude'
alias analyze='cd ~/Projects/80HD-analysis && claude'
alias main='cd ~/Projects/80HD && claude'
EOF

# 3. Reload shell
source ~/.zshrc

# 4. Test it
plan   # Opens Claude in planning worktree
```

You're ready to use the two-Claude pattern!

## Detailed Setup

### Prerequisites

- Git 2.5+ (for worktree support)
- Claude Code CLI installed
- Shell: zsh or bash

Verify:
```bash
git --version        # Should be 2.5+
which claude         # Should show path to Claude CLI
echo $SHELL          # Should show bash or zsh
```

### Step 1: Create Git Worktrees

Worktrees give each Claude instance its own complete copy of your repository.

**Create worktrees:**
```bash
cd ~/Projects/80HD

# Create worktrees in parent directory
git worktree add ../80HD-planning planning
git worktree add ../80HD-review review
git worktree add ../80HD-analysis analysis
```

**Verify:**
```bash
git worktree list
# Should show:
# /Users/you/Projects/80HD              [main]
# /Users/you/Projects/80HD-planning     [planning]
# /Users/you/Projects/80HD-review       [review]
# /Users/you/Projects/80HD-analysis     [analysis]
```

**Directory structure:**
```
~/Projects/
├── 80HD/           # Main worktree (main branch)
├── 80HD-planning/  # Planning worktree (planning branch)
├── 80HD-review/    # Review worktree (review branch)
└── 80HD-analysis/  # Analysis worktree (analysis branch)
```

### Step 2: Configure Shell Aliases

Add aliases to quickly jump between worktrees.

**For zsh** (`.zshrc`):
```bash
# Two-Claude pattern aliases
alias plan='cd ~/Projects/80HD-planning && claude'
alias review='cd ~/Projects/80HD-review && claude'
alias analyze='cd ~/Projects/80HD-analysis && claude'
alias main='cd ~/Projects/80HD && claude'

# Worktree navigation (without launching Claude)
alias cdplan='cd ~/Projects/80HD-planning'
alias cdreview='cd ~/Projects/80HD-review'
alias cdanalyze='cd ~/Projects/80HD-analysis'
alias cdmain='cd ~/Projects/80HD'
```

**For bash** (`.bashrc`):
```bash
# Two-Claude pattern aliases
alias plan='cd ~/Projects/80HD-planning && claude'
alias review='cd ~/Projects/80HD-review && claude'
alias analyze='cd ~/Projects/80HD-analysis && claude'
alias main='cd ~/Projects/80HD && claude'

# Worktree navigation (without launching Claude)
alias cdplan='cd ~/Projects/80HD-planning'
alias cdreview='cd ~/Projects/80HD-review'
alias cdanalyze='cd ~/Projects/80HD-analysis'
alias cdmain='cd ~/Projects/80HD'
```

**Apply changes:**
```bash
# zsh
source ~/.zshrc

# bash
source ~/.bashrc
```

### Step 3: Terminal Setup (Optional)

Configure your terminal for better multi-session workflows.

#### Option A: Terminal Tabs with Color Coding

Most terminals support colored tabs/windows.

**iTerm2** (macOS):
1. Open Preferences → Profiles
2. Create profiles for each worktree:
   - "Planning" - Set tab color to green
   - "Review" - Set tab color to blue
   - "Analysis" - Set tab color to orange
   - "Main" - Set tab color to default

**Windows Terminal**:
```json
{
  "profiles": {
    "list": [
      {
        "name": "Planning",
        "commandline": "zsh -c 'cd ~/Projects/80HD-planning && claude'",
        "tabColor": "#00FF00"
      },
      {
        "name": "Review",
        "commandline": "zsh -c 'cd ~/Projects/80HD-review && claude'",
        "tabColor": "#0000FF"
      }
    ]
  }
}
```

#### Option B: tmux Setup

Use tmux for split-pane workflows.

**tmux configuration** (`~/.tmux.conf`):
```bash
# Two-Claude layout
bind-key C-p split-window -h -c "~/Projects/80HD-planning"
bind-key C-r split-window -h -c "~/Projects/80HD-review"

# Set pane borders
set -g pane-border-style fg=colour240
set -g pane-active-border-style fg=colour33
```

**Launch two-Claude layout:**
```bash
tmux new-session \; \
  send-keys 'cd ~/Projects/80HD-planning && claude' C-m \; \
  split-window -h \; \
  send-keys 'cd ~/Projects/80HD-review && claude' C-m
```

### Step 4: Create Helper Scripts

Create scripts for common workflows.

**`~/bin/two-claude-start.sh`**:
```bash
#!/bin/bash
# Start two-Claude review session with split terminal

tmux new-session -d -s two-claude \; \
  send-keys 'cd ~/Projects/80HD-planning && claude' C-m \; \
  split-window -h \; \
  send-keys 'cd ~/Projects/80HD-review' C-m \; \
  select-pane -t 0 \; \
  attach-session -t two-claude
```

Make it executable:
```bash
chmod +x ~/bin/two-claude-start.sh
```

Usage:
```bash
two-claude-start.sh  # Launches split-pane with planning and review
```

**`~/bin/two-claude-stop.sh`**:
```bash
#!/bin/bash
# Clean up worktrees

cd ~/Projects/80HD
git worktree remove ../80HD-planning --force
git worktree remove ../80HD-review --force
git worktree remove ../80HD-analysis --force

echo "Worktrees removed. Run setup again to recreate."
```

### Step 5: Claude Code Configuration

Configure Claude to work well with worktrees.

**Create `.claude/worktree-config.json`** (per worktree):

```bash
# In planning worktree
cd ~/Projects/80HD-planning
mkdir -p .claude
cat > .claude/worktree-config.json << 'EOF'
{
  "worktree": "planning",
  "role": "planner",
  "focus": "Writing comprehensive implementation plans"
}
EOF

# In review worktree
cd ~/Projects/80HD-review
mkdir -p .claude
cat > .claude/worktree-config.json << 'EOF'
{
  "worktree": "review",
  "role": "reviewer",
  "focus": "Critical evaluation of plans as staff engineer"
}
EOF

# In analysis worktree
cd ~/Projects/80HD-analysis
mkdir -p .claude
cat > .claude/worktree-config.json << 'EOF'
{
  "worktree": "analysis",
  "role": "investigator",
  "focus": "Read-only investigation and exploration"
}
EOF
```

### Step 6: Statusline Configuration

Add worktree info to your terminal prompt.

**For zsh with oh-my-zsh**:

Add to `~/.zshrc`:
```bash
# Show git worktree in prompt
function git_worktree() {
  local worktree=$(git rev-parse --show-toplevel 2>/dev/null | xargs basename)
  if [[ $worktree != "80HD" ]]; then
    echo " [$worktree]"
  fi
}

# Add to prompt
PROMPT='%{$fg[cyan]%}%~%{$reset_color%}$(git_worktree)$(git_prompt_info) $ '
```

**Result:**
```
~/Projects/80HD-planning [planning] (planning ✗) $
```

### Step 7: Test the Setup

**Test worktrees:**
```bash
plan     # Should open Claude in 80HD-planning/
review   # Should open Claude in 80HD-review/
analyze  # Should open Claude in 80HD-analysis/
main     # Should open Claude in 80HD/
```

**Test git isolation:**
```bash
# In planning worktree
cdplan
touch test-planning.txt
git status  # Should show test-planning.txt

# In review worktree
cdreview
git status  # Should NOT show test-planning.txt (isolated!)
```

**Test Claude instances:**
```bash
# Terminal 1
plan
# Ask Claude: "What worktree am I in?"

# Terminal 2
review
# Ask Claude: "What worktree am I in?"

# They should report different worktrees
```

## Usage Patterns

### Pattern 1: Sequential Review

1. **Terminal 1**: Run `plan` to start planning
2. Ask Claude A to write implementation plan
3. Copy the plan text
4. **Terminal 2**: Run `review` to start reviewing
5. Paste plan into Claude B with reviewer prompt
6. Copy feedback
7. **Terminal 1**: Refine plan based on feedback
8. Repeat until approved

### Pattern 2: Parallel Review

1. **Terminal 1**: Run `plan`
2. **Terminal 2**: Run `review`
3. **Terminal 1**: Ask Claude A to write plan
4. **While Claude A is writing**, prepare reviewer prompt in Terminal 2
5. When plan is ready, copy to Terminal 2
6. Both Claudes work in parallel

### Pattern 3: Three-Way Review

1. **Terminal 1**: `plan` - Claude A writes plan
2. **Terminal 2**: `review` - Claude B reviews for architecture
3. **Terminal 3**: `review` (new session) - Claude C reviews for security
4. Consolidate feedback and iterate

## Troubleshooting

### Worktree conflicts

**Problem**: Can't create worktree, "already exists" error

**Solution**:
```bash
# Remove stale worktree
git worktree remove ../80HD-planning --force

# Recreate
git worktree add ../80HD-planning planning
```

### Aliases not working

**Problem**: `plan` command not found

**Solution**:
```bash
# Check if alias is defined
alias plan

# If not, source your shell config
source ~/.zshrc  # or ~/.bashrc

# If still not working, check you added to correct file
echo $SHELL  # Verify your shell
```

### Git branches diverging

**Problem**: Branches in different worktrees conflict

**Solution**:
Worktrees use different branches intentionally. This is correct behavior.

```bash
# Planning worktree is on 'planning' branch
# Review worktree is on 'review' branch
# They should NOT be in sync

# To sync changes to main:
cdplan
git add .
git commit -m "Plan approved"
git checkout main
git merge planning
git push
```

### Claude using wrong context

**Problem**: Claude in review worktree sees files from planning

**Solution**:
Each worktree is isolated. If you see this, you might be in the wrong directory.

```bash
# Verify which worktree you're in
pwd
git worktree list
```

## Advanced Configuration

### Custom Reviewer Personas

Create multiple reviewer aliases for different review types.

**Add to shell config**:
```bash
# Security review
alias review-security='cd ~/Projects/80HD-review && claude --persona security'

# Performance review
alias review-perf='cd ~/Projects/80HD-review && claude --persona performance'

# Database review
alias review-db='cd ~/Projects/80HD-review && claude --persona database'
```

### Automation Scripts

**Auto-copy plan to review** (`~/bin/plan-to-review.sh`):
```bash
#!/bin/bash
# Copy plan from planning worktree to review worktree

PLAN_FILE="$HOME/Projects/80HD-planning/current-plan.md"
REVIEW_FILE="$HOME/Projects/80HD-review/plan-under-review.md"

if [ ! -f "$PLAN_FILE" ]; then
  echo "No plan found at $PLAN_FILE"
  exit 1
fi

cp "$PLAN_FILE" "$REVIEW_FILE"
echo "Plan copied to review worktree"
echo "Run 'review' and paste PROMPTS.md template"
```

### Git Hooks

**Pre-commit hook for planning worktree**:

```bash
# ~/Projects/80HD-planning/.git/hooks/pre-commit
#!/bin/bash
# Prevent accidental commits to planning branch

echo "⚠️  You're about to commit to the planning branch."
echo "Plans should be reviewed before merging to main."
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  exit 1
fi
```

## Next Steps

Now that you have the two-Claude pattern set up:

1. Read [SKILL.md](SKILL.md) for workflow details
2. Review [EXAMPLES.md](EXAMPLES.md) for real-world scenarios
3. Try [PROMPTS.md](PROMPTS.md) templates for specialized reviews
4. Learn more about worktrees in [WORKTREES.md](WORKTREES.md)

## Cleanup

To remove the two-Claude setup:

```bash
cd ~/Projects/80HD

# Remove worktrees
git worktree remove ../80HD-planning --force
git worktree remove ../80HD-review --force
git worktree remove ../80HD-analysis --force

# Remove aliases from shell config
# (manually edit ~/.zshrc or ~/.bashrc)

# Delete branches (optional)
git branch -D planning review analysis
```
