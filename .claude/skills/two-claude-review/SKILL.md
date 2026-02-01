---
name: two-claude-review
description: Two-Claude pattern for plan review. Uses one Claude to write plans and another to review as a staff engineer. Use for complex features, architectural decisions, or when planning requires critical evaluation.
---

# Two-Claude Plan Review

## Contents

- [Overview](#overview) - The two-Claude pattern explained
- [Why This Works](#why-this-works) - Psychology and benefits
- [Workflow](#workflow) - Step-by-step process
- [Worktree Setup](#worktree-setup) - Git worktree configuration
- [Reviewer Prompts](#reviewer-prompts) - Staff engineer templates
- [When to Use](#when-to-use) - Decision criteria
- [Critical Rules](#critical-rules) - Must-follow principles
- [Examples](EXAMPLES.md) - Detailed scenarios
- [Prompts](PROMPTS.md) - Reusable prompt templates
- [Setup Guide](SETUP.md) - Installation and configuration

## Overview

The two-Claude pattern splits planning into two independent sessions:

**Claude A (Planner)**: Writes the implementation plan
**Claude B (Reviewer)**: Reviews the plan as a skeptical staff engineer

This mirrors Anthropic's official best practices for code review. The second Claude catches things the first missed—not because the first Claude is bad, but because a fresh perspective finds different problems.

## Why This Works

### Fresh Perspective
- The reviewer hasn't been influenced by the planner's reasoning
- Different token context leads to different pattern matching
- Skeptical stance reveals assumptions the planner took for granted

### Catches Different Issues
The planner focuses on:
- Making the plan comprehensive
- Covering requirements
- Designing the implementation

The reviewer focuses on:
- What's missing
- What could go wrong
- Simpler alternatives
- Edge cases

### Mirrors Real Teams
This replicates how effective engineering teams work:
- RFC author writes the proposal
- Staff engineer reviews with critical eye
- Iteration improves the design before implementation

## Workflow

### Step 1: Write the Plan (Claude A)

Start in planning mode with detailed requirements:

```
/plan
I need to implement [feature].

Requirements:
- [requirement 1]
- [requirement 2]
- [constraint 1]

Before you plan, ask me clarifying questions about anything ambiguous.
```

**Key principle**: Ask Claude to identify ambiguity BEFORE planning. This catches problems that would otherwise surface during implementation.

### Step 2: Review the Plan (Claude B)

Copy the plan from Claude A and open a fresh Claude session (different terminal or worktree):

```
You are a staff engineer reviewing an implementation plan.

Be skeptical. Look for:
- Edge cases the plan doesn't address
- Assumptions that might not hold
- Simpler alternatives
- Potential performance issues
- Missing error handling
- Scalability concerns
- Testing gaps

Here's the plan:

[paste plan from Claude A]

Provide specific, actionable feedback.
```

### Step 3: Iterate

Take the review feedback back to Claude A:
- Refine the plan based on issues found
- Address edge cases identified
- Consider simpler alternatives suggested
- Re-review if changes are significant

### Step 4: Approve and Implement

Once both Claudes agree the plan is solid:
- Exit plan mode
- Begin implementation
- Reference the reviewed plan as needed

## Worktree Setup

Git worktrees provide better isolation than terminal sessions. Each Claude instance gets its own complete copy of the repository.

### Create Worktrees

```bash
# Create dedicated worktrees for the two-Claude pattern
git worktree add ../80HD-planning planning
git worktree add ../80HD-review review
git worktree add ../80HD-analysis analysis  # Read-only investigation
```

### Shell Aliases

Add to your `.zshrc` or `.bashrc`:

```bash
# Two-Claude pattern aliases
alias plan='cd ~/Projects/80HD-planning && claude'
alias review='cd ~/Projects/80HD-review && claude'
alias analyze='cd ~/Projects/80HD-analysis && claude'

# Return to main
alias main='cd ~/Projects/80HD && claude'
```

Type `plan` to enter planning mode, `review` to review, `analyze` for investigation.

### Benefits of Worktrees

**Isolation**: Changes in one worktree don't affect others
**Parallel work**: Run multiple Claude sessions without conflicts
**Clean context**: Each session has its own git state
**Easy cleanup**: Remove worktrees when done

## Reviewer Prompts

### Standard Staff Engineer Review

```
You are a staff engineer reviewing an implementation plan.

Be skeptical. Look for:
- Edge cases the plan doesn't address
- Assumptions that might not hold
- Simpler alternatives
- Potential performance issues
- Missing error handling
- Scalability concerns
- Testing gaps
- Security vulnerabilities
- Backwards compatibility issues

Here's the plan:
[PLAN_CONTENT]

Provide specific, actionable feedback organized by:
1. Critical issues (must address before implementation)
2. Important improvements (should address)
3. Nice-to-haves (consider if time permits)
```

### Security-Focused Review

```
You are a security engineer reviewing an implementation plan.

Focus on:
- Authentication and authorization gaps
- Input validation and sanitization
- Data exposure risks
- OWASP Top 10 vulnerabilities
- Secrets management
- Rate limiting and DoS protection
- Logging sensitive data
- Compliance requirements (GDPR, SOC2, etc.)

Here's the plan:
[PLAN_CONTENT]

Rate each security concern: Critical / High / Medium / Low
```

### Performance-Focused Review

```
You are a performance engineer reviewing an implementation plan.

Focus on:
- Database query efficiency
- N+1 query problems
- Caching opportunities
- Memory usage patterns
- API call optimization
- Time complexity of algorithms
- Scalability bottlenecks
- Load testing requirements

Here's the plan:
[PLAN_CONTENT]

Estimate performance impact: High / Medium / Low
```

See [PROMPTS.md](PROMPTS.md) for more specialized reviewer templates.

## When to Use

### Always Use for:
- **New features** with multiple valid approaches
- **Architectural decisions** affecting multiple files
- **Database schema changes** with migration complexity
- **API design** with backwards compatibility concerns
- **Security-sensitive** features (auth, payments, PII)
- **Performance-critical** paths (hot loops, API endpoints)

### Consider Using for:
- **Refactorings** touching >5 files
- **Complex bug fixes** with unclear root cause
- **Integration points** with external systems
- **Configuration changes** affecting production

### Skip for:
- Simple bug fixes (1-2 line changes)
- Documentation updates
- Cosmetic changes (formatting, naming)
- Obvious implementations with no ambiguity

## When Things Go Sideways

**Critical rule from the article**: When implementation starts failing, STOP and re-plan immediately.

Don't try to:
- Patch your way forward
- Add more context hoping Claude figures it out
- Incrementally fix the approach

Instead:
1. Stop implementation
2. Go back to Plan mode
3. Start fresh with knowledge of what went wrong
4. Run through two-Claude review again

**Why this works**: Re-planning with accumulated wisdom produces better results than incremental fixes. You've learned the constraints, hit dead ends, and discovered edge cases. Use that knowledge to design something better.

## Critical Rules

### 1. Treat Plans as the Most Important Artifact

A mediocre plan produces mediocre code, regardless of model capability.

**Don't rush through planning to get to implementation.**

Pour energy into the plan:
- Write detailed requirements
- Specify error handling explicitly
- Name edge cases you're aware of
- Include examples of expected input/output

### 2. Eliminate Ambiguity

When a prompt could be interpreted multiple ways, Claude picks one and runs with it. If that interpretation was wrong, you've wasted a generation.

**Make specs detailed enough that there's only one reasonable interpretation.**

### 3. Use Fresh Claude Sessions

The reviewer must be a separate Claude instance with no context from the planner.

Don't:
- Copy/paste the plan in the same conversation
- Use the same terminal session

Do:
- Open a new terminal or worktree
- Start completely fresh
- Give the reviewer only the plan text

### 4. Embrace Skepticism

The reviewer should actively look for problems, not validate the plan.

Prompt the reviewer to be skeptical:
- "What could go wrong?"
- "What's the simpler alternative?"
- "What assumptions are we making?"

### 5. Iterate Until Both Agree

Don't stop at one review cycle. If the reviewer finds significant issues:
- Update the plan
- Re-review the updated version
- Repeat until both Claudes are confident

### 6. Document the Final Plan

Once approved:
- Save the plan to `.claude/plans/` or project docs
- Reference it during implementation
- Update it if you discover new constraints

## Integration with Existing Workflow

This skill complements your existing Claude Code workflow:

**Before implementation**:
1. Use `/plan` to enter planning mode
2. Have Claude A write the plan
3. Use `two-claude-review` skill to review
4. Iterate until approved
5. Exit plan mode and implement

**During implementation**:
- Reference the reviewed plan
- Use CLAUDE.md rules as usual
- Use subagents for parallel work
- Create skills for repeated tasks

**After implementation**:
- Have Claude update CLAUDE.md with lessons learned
- Archive the plan for future reference
- Note any deviations from the plan and why

## Performance Tips

### Use Worktrees for Parallel Work

Run planner and reviewer simultaneously:
- Terminal 1: Claude A writes plan
- Terminal 2: Claude B ready to review
- Switch between terminals as needed

### Use Haiku for Quick Reviews

For simpler plans, use Haiku model for the reviewer:
- Faster review cycle
- Lower cost
- Still catches most issues

Use Opus/Sonnet for complex architectural reviews.

### Create Review Checklists

For recurring patterns (API design, database changes), create checklists:

```
Review checklist for API changes:
- [ ] Backwards compatible?
- [ ] Rate limited?
- [ ] Error responses documented?
- [ ] Input validation comprehensive?
- [ ] Response pagination considered?
- [ ] Auth/authz correct?
```

## Further Reading

- [EXAMPLES.md](EXAMPLES.md) - Detailed scenarios with before/after
- [PROMPTS.md](PROMPTS.md) - Specialized reviewer templates
- [SETUP.md](SETUP.md) - Installation and configuration guide
- [WORKTREES.md](WORKTREES.md) - Git worktree management in depth

## References

Based on practices from the Claude Code team as documented in:
- "The Claude Code team just revealed their setup, pay attention" by JP Caparas
- Anthropic's official best practices for Claude Code workflows
- incident.io case study on parallel Claude agents
