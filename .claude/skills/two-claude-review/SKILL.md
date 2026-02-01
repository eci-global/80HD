---
name: two-claude-review
description: Two-Claude pattern for plan review. Uses one Claude to write plans and a subagent to review as a staff engineer. Use for complex features, architectural decisions, or when planning requires critical evaluation.
---

# Two-Claude Plan Review

## Contents

- [Overview](#overview) - The two-Claude pattern explained
- [Why This Works](#why-this-works) - Psychology and benefits
- [Workflow](#workflow) - Step-by-step process using subagents
- [Reviewer Prompts](#reviewer-prompts) - Staff engineer templates
- [When to Use](#when-to-use) - Decision criteria
- [Critical Rules](#critical-rules) - Must-follow principles
- [Advanced: Worktrees](#advanced-worktrees) - For parallel work (optional)
- [Examples](EXAMPLES.md) - Detailed scenarios
- [Prompts](PROMPTS.md) - Reusable prompt templates

## Overview

The two-Claude pattern uses a **reviewer subagent** to provide fresh perspective on implementation plans:

**Claude (Main)**: Writes the implementation plan
**Reviewer Subagent**: Reviews the plan as a skeptical staff engineer with fresh context

This mirrors Anthropic's official best practices for code review. The reviewer subagent catches things you missed—not because you're bad at planning, but because a fresh perspective finds different problems.

## Why This Works

### Fresh Perspective
- The reviewer subagent hasn't been influenced by your planning reasoning
- Separate context window leads to different pattern matching
- Skeptical stance reveals assumptions you took for granted

### Catches Different Issues
You (the planner) focus on:
- Making the plan comprehensive
- Covering requirements
- Designing the implementation

The reviewer focuses on:
- What's missing
- What could go wrong
- Simpler alternatives
- Edge cases

### Uses Claude Code's Native Features
- No need for multiple terminals
- No git worktree management
- Uses built-in Task tool for subagents
- Simple, clean workflow

## Workflow

### Step 1: Write the Plan

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

### Step 2: Request Review via Subagent

After writing the plan, simply say:

```
Review this plan as a skeptical staff engineer. Look for edge cases,
assumptions, simpler alternatives, and potential issues.
```

Claude will automatically spawn a reviewer subagent with your plan and return the feedback.

### Step 3: Iterate

Based on the review feedback:
- Refine the plan to address issues found
- Consider simpler alternatives suggested
- Add missing edge cases
- Request another review if changes are significant

### Step 4: Approve and Implement

Once the review looks good:
- Exit plan mode
- Begin implementation
- Reference the reviewed plan as needed

## Automated Workflow Example

You can ask Claude to handle the entire review cycle:

```
Write an implementation plan for [feature], then have a staff engineer
subagent review it. Iterate until the plan is solid.
```

Claude will:
1. Write the plan
2. Spawn reviewer subagent
3. Incorporate feedback
4. Repeat if needed
5. Present final plan for your approval

## Reviewer Prompts

### Standard Staff Engineer Review

When requesting a review, Claude will use prompts like:

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

Here's the plan:
[PLAN_CONTENT]

Provide specific, actionable feedback organized by:
1. Critical issues (must address before implementation)
2. Important improvements (should address)
3. Nice-to-haves (consider if time permits)
```

### Specialized Reviews

You can request focused reviews:

**Security review**:
```
Have a security engineer subagent review this plan. Focus on authentication,
authorization, data protection, and OWASP Top 10 vulnerabilities.
```

**Performance review**:
```
Have a performance engineer subagent review this plan. Focus on scalability,
caching, database queries, and bottlenecks.
```

**Database review**:
```
Have a database architect subagent review this schema and migration plan.
Focus on constraints, indexes, and migration safety.
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

**Critical rule from the Claude Code team**: When implementation starts failing, STOP and re-plan immediately.

Don't try to:
- Patch your way forward
- Add more context hoping Claude figures it out
- Incrementally fix the approach

Instead:
1. Stop implementation
2. Go back to Plan mode
3. Start fresh with knowledge of what went wrong
4. Request another subagent review

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

### 3. Use Subagents for Fresh Context

The reviewer subagent has a separate context window:
- It hasn't been influenced by your planning process
- It sees the plan with fresh eyes
- It catches things you missed

This is the key to the pattern working.

### 4. Embrace Skepticism

The reviewer should actively look for problems, not validate the plan.

Request skeptical review:
- "What could go wrong?"
- "What's the simpler alternative?"
- "What assumptions are we making?"
- "Be critical and find issues"

### 5. Iterate Until Solid

Don't stop at one review cycle. If the reviewer finds significant issues:
- Update the plan
- Request another review
- Repeat until confident

### 6. Document the Final Plan

Once approved:
- Save the plan to docs or `.claude/plans/`
- Reference it during implementation
- Update it if you discover new constraints

## Advanced: Worktrees

For **parallel work** on multiple features simultaneously, git worktrees provide isolation. This is optional and only needed for advanced workflows.

**When to use worktrees**:
- Working on multiple features at the same time
- Need complete isolation between work streams
- Running multiple Claude sessions in parallel

**For most users, subagents are sufficient and simpler.**

See [WORKTREES.md](WORKTREES.md) for the advanced worktree setup if you need parallel work.

## Integration with Existing Workflow

This skill complements your existing Claude Code workflow:

**During planning**:
1. Use `/plan` to enter planning mode
2. Write the plan (or ask Claude to write it)
3. Request subagent review: "Review this plan as a staff engineer"
4. Iterate based on feedback
5. Exit plan mode when approved

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

### Use Haiku for Quick Reviews

For simpler plans, request Haiku model for the reviewer:

```
Have a staff engineer review this plan using the Haiku model for faster feedback.
```

Use Opus/Sonnet for complex architectural reviews.

### Batch Multiple Reviews

For comprehensive review, request multiple specialized reviews:

```
Review this plan from three perspectives:
1. Staff engineer (architecture and design)
2. Security engineer (vulnerabilities and risks)
3. Performance engineer (scalability and bottlenecks)
```

Each spawns a separate subagent with specialized focus.

## Comparison: Subagents vs Worktrees

| Approach | Best For | Complexity |
|----------|----------|------------|
| **Subagents** (Recommended) | Most use cases, plan review, single feature at a time | Low - built into Claude Code |
| **Worktrees** (Advanced) | Parallel work on multiple features, team collaboration | High - requires git setup |

**For 90% of users, subagents are the right choice.**

## Example Usage

### Simple Review

```
User: Write a plan for adding user authentication with JWT tokens.

Claude: [Writes plan]

User: Have a staff engineer review this plan.

Claude: [Spawns reviewer subagent, gets feedback, presents it]

User: Good feedback. Update the plan to address the security concerns.

Claude: [Updates plan]

User: Review again.

Claude: [Spawns new reviewer subagent, confirms issues addressed]

User: Looks good, let's implement.
```

### Automated Review

```
User: Write and review a plan for implementing rate limiting on our API.
Iterate until it's solid.

Claude: [Writes plan → Reviews → Refines → Reviews again → Presents final plan]

User: Approved, proceed with implementation.
```

## Further Reading

- [EXAMPLES.md](EXAMPLES.md) - Detailed scenarios with before/after
- [PROMPTS.md](PROMPTS.md) - Specialized reviewer templates
- [WORKTREES.md](WORKTREES.md) - Advanced parallel work setup

## References

Based on practices from the Claude Code team as documented in:
- "The Claude Code team just revealed their setup, pay attention" by JP Caparas
- Anthropic's official best practices for Claude Code workflows
- The article's Tip #2: "Start complex tasks in Plan mode, then pour energy into the plan"
- The article's Tip #8: "Use subagents strategically"
