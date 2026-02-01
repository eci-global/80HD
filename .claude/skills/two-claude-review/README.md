# Two-Claude Plan Review Skill

This skill implements the two-Claude pattern for plan review using **subagents** for fresh perspective on implementation plans.

## The Simple Approach

**No multiple terminals. No git worktrees. Just ask Claude to review your plan.**

```
User: Write a plan for adding user authentication.

Claude: [Writes plan]

User: Have a staff engineer review this plan.

Claude: [Spawns reviewer subagent, returns feedback]

User: Update the plan based on that feedback.

Claude: [Updates plan]
```

That's it!

## How It Works

1. **You (or Claude) write the plan** in plan mode
2. **You request a review**: "Review this plan as a skeptical staff engineer"
3. **Claude spawns a reviewer subagent** with fresh context
4. **Subagent provides feedback** from a critical perspective
5. **You iterate** until the plan is solid

The subagent has a **separate context window**, so it sees your plan with fresh eyes—catching edge cases, assumptions, and issues you missed.

## Quick Start

### Basic Usage

```
/plan
I need to implement rate limiting for our API.

Requirements:
- Per-user limits (100/min free, 1000/min paid)
- Graceful degradation if Redis fails
- Metrics for monitoring

Before planning, ask clarifying questions.

[Claude writes plan]

User: Review this plan as a staff engineer. Be skeptical and find issues.

[Claude spawns reviewer subagent, presents feedback]

User: Good points. Update the plan to address the Redis fallback and metrics.

[Claude refines plan]

User: Review again.

[Claude spawns new reviewer, confirms issues addressed]

User: Looks good, proceed with implementation.
```

### Automated Review

Let Claude handle the entire review cycle:

```
Write and review a plan for implementing JWT authentication. Iterate until solid.
```

Claude will:
1. Write the plan
2. Spawn reviewer subagent
3. Incorporate feedback
4. Review again if needed
5. Present final plan for approval

### Specialized Reviews

Request focused review perspectives:

```
Review this plan from three angles:
1. Security engineer (vulnerabilities, auth/authz)
2. Performance engineer (scalability, caching)
3. Database architect (schema, indexes, migrations)
```

Each spawns a separate subagent with specialized focus.

## When to Use

### Always Use For:
- New features with multiple approaches
- Architectural decisions
- Database schema changes
- API design
- Security-sensitive features
- Performance-critical paths

### Skip For:
- Simple bug fixes (1-2 lines)
- Documentation updates
- Obvious implementations

## What Makes a Good Review

The reviewer subagent catches:
1. **Edge cases** - What if Redis fails? What about concurrent requests?
2. **Assumptions** - "Graceful degradation" is ambiguous
3. **Simpler alternatives** - Is there an easier approach?
4. **Performance issues** - Will this scale? N+1 queries?
5. **Security gaps** - How are secrets managed?
6. **Missing tests** - What needs testing?
7. **Rollback plan** - What if this goes wrong?

## Real Benefits

From the Claude Code team article:
- **Fresh perspective** catches issues you missed
- **Separate context** means unbiased review
- **Skeptical stance** reveals hidden assumptions
- **No overhead** - uses built-in Claude Code features

## Documentation

- **[SKILL.md](SKILL.md)** - Complete workflow and best practices
- **[EXAMPLES.md](EXAMPLES.md)** - 3 detailed before/after scenarios
- **[PROMPTS.md](PROMPTS.md)** - 11 specialized reviewer templates
- **[WORKTREES.md](WORKTREES.md)** - Advanced: parallel work setup (optional)

## Advanced: Worktrees (Optional)

For **parallel work on multiple features**, git worktrees provide isolation:

```bash
# Only needed if working on multiple features simultaneously
bash .claude/skills/two-claude-review/scripts/setup-worktrees.sh
```

**For most users, subagents are simpler and sufficient.**

See [WORKTREES.md](WORKTREES.md) for the advanced setup.

## Comparison

| Approach | Complexity | When to Use |
|----------|------------|-------------|
| **Subagents** (Recommended) | Low - just ask for a review | 90% of use cases |
| **Worktrees** (Advanced) | High - requires setup | Parallel work on multiple features |

## Examples

### Example 1: Rate Limiting

**Initial Plan**:
```markdown
## Rate Limiting
1. Add Redis
2. Check request count
3. Return 429 if exceeded
```

**After Review**:
```markdown
## Rate Limiting with Fallback
1. Redis-based distributed limiting
2. In-memory fallback if Redis down
3. Per-endpoint configuration
4. Metrics and monitoring
5. Rate limit headers in response
6. Testing strategy for failures
```

The reviewer caught:
- Missing Redis fallback (critical)
- No per-endpoint limits
- No monitoring
- Missing rate limit headers

### Example 2: JWT Auth

**Initial Plan**:
```markdown
## JWT Auth
1. Generate JWT on login (24h expiry)
2. Verify on each request
```

**After Review**:
```markdown
## JWT Auth (Security Hardened)
1. Short access tokens (15min)
2. Long refresh tokens (7 days)
3. Token revocation via version numbers
4. Secrets in KMS (not env vars)
5. httpOnly cookies (not localStorage)
6. Rate limiting on auth endpoints
7. Migration strategy (dual auth during transition)
```

The reviewer caught:
- 10+ security issues
- No refresh token strategy
- Missing secrets management
- XSS vulnerability via localStorage
- No migration plan

See [EXAMPLES.md](EXAMPLES.md) for more detailed scenarios.

## Tips

### 1. Be Specific in Review Requests

**Good**:
```
Review this plan as a security engineer. Focus on auth, secrets, and OWASP Top 10.
```

**Bad**:
```
Review this.
```

### 2. Iterate Until Solid

Don't settle for one review. If significant issues found:
```
Update the plan based on that feedback, then review again.
```

### 3. Request Multiple Perspectives

For critical features:
```
Review this from security, performance, and database perspectives.
```

### 4. Use the Right Model

- **Haiku**: Simple plans, quick feedback
- **Sonnet**: Most use cases
- **Opus**: Complex architectural decisions

```
Review this using Haiku for quick feedback.
```

## Critical Rules (from Claude Code team)

1. **Treat plans as the most important artifact** - Good plan → good code
2. **When implementation fails, re-plan** - Don't patch forward
3. **Eliminate ambiguity** - Detailed specs prevent wasted generations
4. **Embrace skepticism** - Reviewer should find problems, not validate
5. **Iterate until both agree** - Don't rush to implementation

## Support

Questions? Check the docs:
- [SKILL.md](SKILL.md) - Full workflow
- [EXAMPLES.md](EXAMPLES.md) - Real scenarios
- [PROMPTS.md](PROMPTS.md) - Review templates
- [WORKTREES.md](WORKTREES.md) - Advanced setup

## References

Based on "The Claude Code team just revealed their setup" by JP Caparas (Feb 2026):
- Tip #2: Pour energy into the plan
- Tip #8: Use subagents strategically
