# Two-Claude Plan Review Skill

This skill implements the two-Claude pattern for plan review, as described in "The Claude Code team just revealed their setup" by JP Caparas.

## Quick Start

**1. Setup is already complete!** Git worktrees have been created:
```bash
git worktree list
# Should show: main, planning, review, analysis
```

**2. Add shell aliases** to your `.zshrc` or `.bashrc`:
```bash
cat .claude/skills/two-claude-review/scripts/shell-aliases.sh >> ~/.zshrc
source ~/.zshrc
```

**3. Start using the pattern**:
```bash
# Terminal 1: Planner
plan
# Ask Claude A to write an implementation plan

# Terminal 2: Reviewer
review
# Use a reviewer prompt from PROMPTS.md
# Paste the plan from Claude A
```

## Documentation

- **[SKILL.md](SKILL.md)** - Main skill documentation and workflow
- **[SETUP.md](SETUP.md)** - Detailed setup instructions
- **[EXAMPLES.md](EXAMPLES.md)** - Real-world examples with before/after
- **[PROMPTS.md](PROMPTS.md)** - Reviewer prompt templates for different scenarios
- **[WORKTREES.md](WORKTREES.md)** - Deep dive into git worktrees

## What You Get

### Git Worktrees Created
- `~/Projects/80HD-planning/` - For Claude A (planner)
- `~/Projects/80HD-review/` - For Claude B (reviewer)
- `~/Projects/80HD-analysis/` - For read-only investigation

### Helper Scripts
- `scripts/two-claude-start.sh` - Launch tmux session with split panes
- `scripts/two-claude-stop.sh` - Stop session and optionally cleanup
- `scripts/plan-to-review.sh` - Copy plan between worktrees
- `scripts/setup-worktrees.sh` - Re-create worktrees if needed
- `scripts/shell-aliases.sh` - Shell aliases to add to your config

### Reviewer Prompts
Ready-to-use prompts in `PROMPTS.md` for:
- Staff engineer review (general)
- Security-focused review
- Performance-focused review
- Database design review
- API design review
- Frontend architecture review
- Infrastructure/DevOps review
- Mobile app review
- Data pipeline review
- AI/ML feature review
- Third-party integration review

## Usage Pattern

### Method 1: Manual (Two Terminals)

**Terminal 1 - Planner**:
```bash
plan  # Opens Claude in planning worktree

# Ask Claude:
/plan
I need to implement rate limiting for the API.

Requirements:
- Per-user limits (100/min free, 1000/min paid)
- Per-endpoint limits
- Graceful degradation when Redis unavailable

Before planning, ask clarifying questions.
```

**Terminal 2 - Reviewer**:
```bash
review  # Opens Claude in review worktree

# Copy plan from Terminal 1, then ask Claude:
You are a staff engineer reviewing an implementation plan.

Be skeptical. Look for:
- Edge cases the plan doesn't address
- Assumptions that might not hold
- Simpler alternatives
- Potential performance issues

Here's the plan:
[PASTE PLAN]

Provide specific, actionable feedback.
```

### Method 2: tmux (Split Screen)

```bash
two-claude-start  # Launches split-pane tmux session
# Left pane: Planning worktree
# Right pane: Review worktree
```

### Method 3: File-Based

```bash
# 1. Save plan in planning worktree
cd ~/Projects/80HD-planning
cat > current-plan.md
[Paste plan from Claude A]
^D

# 2. Copy to review worktree
plan2review current-plan.md

# 3. Review in review worktree
cd ~/Projects/80HD-review
cat plan-under-review.md
```

## When to Use

### Always Use For:
- New features with multiple approaches
- Architectural decisions
- Database schema changes
- API design
- Security-sensitive features
- Performance-critical paths

### Consider For:
- Refactorings touching >5 files
- Complex bug fixes
- Integration points
- Configuration changes

### Skip For:
- Simple bug fixes (1-2 lines)
- Documentation updates
- Cosmetic changes

## What Makes a Good Review

The reviewer (Claude B) should catch:
1. **Edge cases** - What happens when Redis fails? What about concurrent requests?
2. **Assumptions** - "Graceful degradation" is ambiguous. What does it mean exactly?
3. **Simpler alternatives** - Is there a simpler approach?
4. **Performance issues** - Will this scale? Are there N+1 queries?
5. **Security gaps** - How are secrets managed? What about rate limiting?
6. **Missing tests** - What needs to be tested?
7. **Rollback plan** - What if this goes wrong?

## Real Results from the Article

From incident.io case study:
- **$8 in Claude credits** → 18% performance improvement
- **10 minutes** to build UI feature (would have taken 2 hours manually)
- **4-5 parallel agents** running across worktrees
- **Zero conflicts** thanks to worktree isolation

## Troubleshooting

### Worktrees not showing up
```bash
git worktree list
# If empty, run:
bash .claude/skills/two-claude-review/scripts/setup-worktrees.sh
```

### Aliases not working
```bash
# Check if aliases are loaded
alias plan

# If not found:
source ~/.zshrc  # or ~/.bashrc
```

### Claude confused about worktree
```bash
# Verify you're in correct directory
pwd
# Should be in ~/Projects/80HD-planning or ~/Projects/80HD-review
```

## Advanced Usage

### Three-Way Review
Use multiple reviewers for different perspectives:

```bash
# Terminal 1: Claude A writes plan
plan

# Terminal 2: Claude B reviews for architecture
review

# Terminal 3: Claude C reviews for security
review  # New session
```

### Specialized Reviewers
Use different prompts for different review types:

```bash
review
# Then use prompts from PROMPTS.md:
# - Security-focused review (for auth/PII)
# - Performance-focused review (for high-traffic)
# - Database design review (for schema changes)
```

## Cleanup

To remove worktrees:
```bash
two-claude-stop --cleanup
# Or manually:
cd ~/Projects/80HD
git worktree remove ../80HD-planning --force
git worktree remove ../80HD-review --force
git worktree remove ../80HD-analysis --force
```

## References

Based on:
- "The Claude Code team just revealed their setup, pay attention" by JP Caparas (Feb 2026)
- Anthropic's official best practices for Claude Code
- incident.io case study on parallel Claude agents

## Support

Questions? Issues? Improvements?
- Read the detailed docs: `SKILL.md`, `SETUP.md`, `EXAMPLES.md`
- Check the examples in `EXAMPLES.md` for real-world scenarios
- Review `WORKTREES.md` for git worktree deep-dive
