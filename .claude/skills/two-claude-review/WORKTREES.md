# Git Worktrees In-Depth

This guide covers git worktrees in detail, explaining how they work and why they're perfect for the two-Claude pattern.

## What Are Git Worktrees?

Git worktrees allow you to have multiple working directories (checkouts) from a single repository. Each worktree can be on a different branch.

**Traditional git**:
```
~/Projects/80HD/     # One working directory
  .git/              # Repository data
  src/               # Files from current branch
```

**With worktrees**:
```
~/Projects/80HD/           # Main worktree (main branch)
  .git/                    # Repository data (shared)
  src/

~/Projects/80HD-planning/  # Planning worktree (planning branch)
  .git -> ../80HD/.git/    # Points to shared repo
  src/

~/Projects/80HD-review/    # Review worktree (review branch)
  .git -> ../80HD/.git/    # Points to shared repo
  src/
```

**Key insight**: All worktrees share the same `.git` directory, but each has its own:
- Working directory (files)
- Checked-out branch
- Staged changes
- Current HEAD

## Why Worktrees for Two-Claude?

### Problem: Terminal Sessions Share State

With traditional terminal sessions, all terminals see the same files:

```
# Terminal 1
cd ~/Projects/80HD
echo "Planning..." > plan.md
git add plan.md

# Terminal 2 (same directory)
cd ~/Projects/80HD
git status  # Sees plan.md from Terminal 1! 🔴
```

This creates coordination problems:
- Claude A modifies a file
- Claude B sees the change immediately
- They interfere with each other
- You must manually track which Claude did what

### Solution: Worktrees Isolate State

With worktrees, each terminal has its own view:

```
# Terminal 1 (planning worktree)
cd ~/Projects/80HD-planning
echo "Planning..." > plan.md
git add plan.md

# Terminal 2 (review worktree)
cd ~/Projects/80HD-review
git status  # Does NOT see plan.md! ✅
```

Each Claude instance works in isolation:
- Claude A in `80HD-planning/` on `planning` branch
- Claude B in `80HD-review/` on `review` branch
- They never interfere
- Clear separation of concerns

## Creating Worktrees

### Basic Creation

```bash
cd ~/Projects/80HD
git worktree add <path> <branch>
```

**Examples**:
```bash
# Create planning worktree on 'planning' branch
git worktree add ../80HD-planning planning

# Create review worktree on 'review' branch
git worktree add ../80HD-review review

# Create analysis worktree on 'analysis' branch
git worktree add ../80HD-analysis analysis
```

### Creating with New Branch

If the branch doesn't exist, add `-b`:

```bash
# Create new 'planning' branch and worktree
git worktree add -b planning ../80HD-planning main

# This:
# 1. Creates new branch 'planning' from 'main'
# 2. Creates worktree at ../80HD-planning
# 3. Checks out 'planning' branch in that worktree
```

### Creating from Existing Branch

If the branch already exists:

```bash
# Checkout existing 'feature-x' branch in new worktree
git worktree add ../80HD-feature feature-x
```

## Managing Worktrees

### List All Worktrees

```bash
git worktree list

# Output:
# /Users/you/Projects/80HD              abc123 [main]
# /Users/you/Projects/80HD-planning     def456 [planning]
# /Users/you/Projects/80HD-review       ghi789 [review]
```

Shows:
- Path to worktree
- Current commit hash
- Checked-out branch

### Remove a Worktree

**Clean removal** (when no uncommitted changes):
```bash
git worktree remove ../80HD-planning
```

**Force removal** (discards uncommitted changes):
```bash
git worktree remove ../80HD-planning --force
```

**Manual cleanup** (if directory already deleted):
```bash
git worktree prune
```

### Move a Worktree

Git doesn't have a "move" command, but you can:

```bash
# Option 1: Remove and recreate
git worktree remove ../80HD-planning
git worktree add ~/Desktop/80HD-planning planning

# Option 2: Move directory and update
mv ../80HD-planning ~/Desktop/80HD-planning
git worktree repair ~/Desktop/80HD-planning
```

### Lock a Worktree

Prevent accidental removal:

```bash
git worktree lock ../80HD-planning --reason "Active planning session"

# Try to remove (will fail)
git worktree remove ../80HD-planning
# Error: worktree is locked

# Unlock
git worktree unlock ../80HD-planning
```

## Worktree Workflows

### Workflow 1: Plan → Review → Merge

```bash
# 1. Create plan in planning worktree
cd ~/Projects/80HD-planning
# ... work with Claude A ...
git add .
git commit -m "Draft plan for feature X"

# 2. Review in review worktree
cd ~/Projects/80HD-review
git fetch
git checkout planning  # Review the planning branch
# ... work with Claude B ...
# Feedback provided

# 3. Iterate in planning worktree
cd ~/Projects/80HD-planning
# ... refine plan based on feedback ...
git add .
git commit -m "Refine plan based on review"

# 4. Merge approved plan to main
git checkout main
git merge planning
git push

# 5. Clean up
cd ~/Projects/80HD
git worktree remove ../80HD-planning
git branch -d planning
```

### Workflow 2: Parallel Feature Development

```bash
# Work on two features simultaneously
git worktree add ../80HD-auth feature/auth-refactor
git worktree add ../80HD-api feature/api-redesign

# Terminal 1: Claude works on auth
cd ~/Projects/80HD-auth
claude  # Work on authentication

# Terminal 2: Claude works on API
cd ~/Projects/80HD-api
claude  # Work on API

# No conflicts - completely isolated!
```

### Workflow 3: Read-Only Analysis

```bash
# Create analysis worktree for investigation
git worktree add ../80HD-analysis analysis

cd ~/Projects/80HD-analysis
# Ask Claude to explore codebase, answer questions
# Never commit anything
# Just use for investigation
```

## Worktree Best Practices

### 1. Use Consistent Naming

**Good**:
```
80HD/              # Main worktree
80HD-planning/     # Planning worktree
80HD-review/       # Review worktree
80HD-analysis/     # Analysis worktree
```

**Bad**:
```
80HD/
planning/          # Unclear which repo
review-123/        # Hard to identify
temp/              # What is this?
```

### 2. Create Worktrees in Parent Directory

**Good**:
```bash
cd ~/Projects/80HD
git worktree add ../80HD-planning planning
# Creates: ~/Projects/80HD-planning/
```

**Bad**:
```bash
git worktree add ~/Desktop/planning planning
# Creates: ~/Desktop/planning/
# Hard to find, not near main repo
```

### 3. Use Dedicated Branches for Worktrees

**Good**:
```
main          # Main worktree
planning      # Planning worktree
review        # Review worktree
analysis      # Analysis worktree
```

**Bad**:
```
main          # Main worktree
main          # ERROR: Can't checkout same branch in multiple worktrees
```

### 4. Don't Checkout Same Branch Twice

Git prevents this:
```bash
git worktree add ../80HD-review main
# Error: 'main' is already checked out at '/Users/you/Projects/80HD'
```

**Solution**: Use different branches per worktree.

### 5. Clean Up Regularly

Remove worktrees you're not actively using:

```bash
# List worktrees
git worktree list

# Remove unused
git worktree remove ../80HD-planning

# Prune stale references
git worktree prune
```

## Common Patterns

### Pattern: Temporary Review Worktree

Create worktree just for review, then delete:

```bash
# Create
git worktree add -b review-temp ../80HD-review main

# Review
cd ~/Projects/80HD-review
# ... review with Claude ...

# Delete
cd ~/Projects/80HD
git worktree remove ../80HD-review --force
git branch -D review-temp
```

### Pattern: Long-Lived Analysis Worktree

Keep analysis worktree around for quick investigations:

```bash
# Create once
git worktree add ../80HD-analysis analysis

# Use whenever needed
alias analyze='cd ~/Projects/80HD-analysis && claude'

# Never commit, just for exploration
```

### Pattern: Feature Branch per Worktree

Each feature gets its own worktree:

```bash
git worktree add ../80HD-feat-auth feature/auth
git worktree add ../80HD-feat-api feature/api
git worktree add ../80HD-feat-ui feature/ui

# Work on features in parallel
# Merge when ready
# Remove worktrees after merge
```

## Worktree Limitations

### Cannot Checkout Same Branch Twice

```bash
# main branch is already checked out in main worktree
git worktree add ../80HD-copy main
# ERROR ❌
```

**Solution**: Use different branches or create a new branch from main.

### Sparse Checkout Not Fully Supported

Sparse checkout (partial repository checkout) has limited worktree support.

**Workaround**: Use full checkouts for worktrees.

### Submodules Are Shared

If your repo has submodules, they are NOT isolated per worktree.

```
80HD/
  .git/
  .gitmodules
  submodule/     # Shared across all worktrees ⚠️
```

**Workaround**: Don't use worktrees if you need isolated submodule states.

## Troubleshooting

### Stale Worktree References

**Problem**: Deleted worktree directory manually, git still thinks it exists.

```bash
git worktree list
# Shows deleted path
```

**Solution**:
```bash
git worktree prune
```

### Locked Worktree

**Problem**: Can't remove worktree, it's locked.

```bash
git worktree remove ../80HD-planning
# ERROR: Worktree is locked
```

**Solution**:
```bash
git worktree unlock ../80HD-planning
git worktree remove ../80HD-planning
```

### Branch Checked Out in Another Worktree

**Problem**: Can't checkout branch, it's used in another worktree.

```bash
cd ~/Projects/80HD
git checkout planning
# ERROR: 'planning' is checked out at '../80HD-planning'
```

**Solution**:
Remove the worktree or checkout a different branch in it:

```bash
# Option 1: Remove worktree
git worktree remove ../80HD-planning

# Option 2: Checkout different branch in worktree
cd ~/Projects/80HD-planning
git checkout another-branch
```

### Corrupted Worktree

**Problem**: Worktree is in bad state.

**Solution**: Remove and recreate:

```bash
git worktree remove ../80HD-planning --force
git worktree add ../80HD-planning planning
```

## Advanced Usage

### Bare Repository with All Worktrees

For advanced setups, create a bare repository with all worktrees:

```bash
# Clone as bare
git clone --bare git@github.com:user/repo.git ~/Projects/80HD.git

# Create worktrees from bare repo
cd ~/Projects/80HD.git
git worktree add ../80HD-main main
git worktree add ../80HD-planning planning
git worktree add ../80HD-review review
```

**Result**:
```
80HD.git/         # Bare repository (no working files)
80HD-main/        # Main worktree
80HD-planning/    # Planning worktree
80HD-review/      # Review worktree
```

**Benefit**: Clean separation between repository data and working directories.

### Scripted Worktree Creation

**`~/bin/create-two-claude-worktrees.sh`**:
```bash
#!/bin/bash
# Create standard two-Claude worktrees for any repo

REPO_NAME=$(basename $(git rev-parse --show-toplevel))

# Create worktrees
git worktree add -b planning ../${REPO_NAME}-planning main
git worktree add -b review ../${REPO_NAME}-review main
git worktree add -b analysis ../${REPO_NAME}-analysis main

echo "Worktrees created:"
git worktree list

echo ""
echo "Add these aliases to your shell config:"
echo "alias plan='cd ~/Projects/${REPO_NAME}-planning && claude'"
echo "alias review='cd ~/Projects/${REPO_NAME}-review && claude'"
echo "alias analyze='cd ~/Projects/${REPO_NAME}-analysis && claude'"
```

### Automatic Cleanup on Exit

**`~/.zlogout` (zsh) or `~/.bash_logout` (bash)**:
```bash
# Remove temporary worktrees on logout
if [ -d ~/Projects/80HD-review ]; then
  cd ~/Projects/80HD
  git worktree remove ../80HD-review --force 2>/dev/null
fi
```

## Comparison: Worktrees vs Alternatives

| Approach | Pros | Cons |
|----------|------|------|
| **Git Worktrees** | ✅ Perfect isolation<br>✅ No coordination overhead<br>✅ Shared git history | ⚠️ Requires git 2.5+<br>⚠️ More disk space |
| **Terminal Sessions** | ✅ Simple<br>✅ Familiar | ❌ Shared state<br>❌ Coordination needed<br>❌ Conflicts |
| **Separate Clones** | ✅ Complete isolation | ❌ Duplicate git history<br>❌ More disk space<br>❌ Push/pull needed to sync |
| **Branches in Same Directory** | ✅ No extra setup | ❌ Switching branches<br>❌ Uncommitted changes<br>❌ Context switching |

**Verdict**: Worktrees are the best solution for the two-Claude pattern.

## Resources

- [Git Worktree Documentation](https://git-scm.com/docs/git-worktree)
- [Pro Git: Git Tools - Git Worktree](https://git-scm.com/book/en/v2/Git-Tools-Advanced-Merging)
- [Claude Code Worktree Support](https://docs.anthropic.com/claude/docs/claude-code)

## Summary

**Git worktrees** enable the two-Claude pattern by providing:
1. **Isolation**: Each Claude instance has its own working directory
2. **Efficiency**: Shared git history (no duplicate clones)
3. **Clarity**: Clear separation (planning, review, analysis)
4. **Simplicity**: Easy to create, manage, and remove

Use worktrees for any workflow requiring parallel Claude sessions.
