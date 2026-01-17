# Agent Automation Framework Documentation

## Overview

The Agent Automation Framework provides a multi-agent workflow system built on top of Cursor SDK for executing implementation plans. The framework enforces AGENTS.md policies, manages git worktrees for isolation, and provides full observability into agent actions.

## Architecture

### Three-Agent Pipeline

1. **Planner Agent**: Selects tasks from plan specs, generates ordered substeps, packages context bundles
2. **Implementer Agent**: Executes substeps using Cursor SDK, enforces policy guardrails, runs tests
3. **Verifier Agent**: Validates completion, updates documentation, generates structured reports

### Key Features

- **Policy Enforcement**: Machine-readable guardrails prevent violations (no mocks, MCP-first, etc.)
- **Worktree Isolation**: Each task runs in its own git worktree for parallel execution
- **Full Observability**: Structured JSONL logging captures every agent action
- **Deterministic Output**: Fixed prompt templates and context packaging ensure consistency
- **Model Selection**: Different models for different agent roles (planner vs implementer vs verifier)

## Installation

### Prerequisites

- Python 3.11+
- Git 2.5+ (for worktree support)
- Cursor IDE (for SDK access)
- Access to MCP servers (Supabase, Slack, Microsoft 365)

### Setup

1. Install Python dependencies:
```bash
cd agents
pip install -r requirements.txt
```

2. Verify Cursor SDK is available (runs automatically in Cursor IDE)

3. Configure MCP servers (optional but recommended):
   - Set `SLACK_MCP_ENABLED=true` if Slack MCP server is available
   - Set `MS365_MCP_ENABLED=true` if Microsoft 365 MCP server is available

## Usage

### Basic Commands

```bash
# List all available tasks
python agents/control.py --list

# Run specific task
python agents/control.py --task Q2

# Resume existing worktree
python agents/control.py --resume feature/ITPLAT01-1234-escalation

# View logs for task
python agents/control.py --log Q2-escalation
```

### Workflow

1. **Task Selection**: Framework loads `/80.plan.md` and identifies pending tasks
2. **Worktree Creation**: Creates isolated git worktree for the task
3. **Planning**: Planner agent generates ordered substeps and context bundle
4. **Implementation**: Implementer agent executes substeps with policy guardrails
5. **Verification**: Verifier agent validates completion and generates reports

## Configuration

### Model Configuration (`agents/config/models.yml`)

Defines which AI model each agent role uses:

```yaml
planner:
  model: "openai:gpt-4o"
implementer:
  model: "cursor:code"
verifier:
  model: "openai:gpt-4.1-mini"
```

### Policy Configuration (`agents/config/policies.json`)

Machine-readable rules from AGENTS.md:

- `noMockData`: Blocks mock data in production code
- `failFastErrors`: Requires actionable error messages
- `vercelAISDKOnly`: Blocks direct provider SDKs
- `mcpFirst`: Enforces MCP-first for external services
- `fileSizeLimit`: Warns on files exceeding 500 lines
- `idempotentMigrations`: Blocks non-idempotent migrations
- `gitJiraID`: Requires Jira IDs in git operations
- And more...

## Observability

### Log Files

All agent actions are logged to structured JSONL files:

- `worktrees/<task-id>/.agent/log.jsonl` - Main event log
- `worktrees/<task-id>/.agent/commands/` - Command output files
- `worktrees/<task-id>/.agent/reports/` - Agent summary reports

### Event Types

- `planner.plan_start` / `planner.plan_end`
- `implementer.substep_begin` / `implementer.substep_end`
- `policy_guard.check_result`
- `mcp_call.try` / `mcp_call.fallback`
- `verifier.checks_run` / `verifier.doc_update`

### Viewing Logs

```bash
# Tail log file
tail -f worktrees/Q2-escalation/.agent/log.jsonl | jq

# Search for specific events
grep "policy_guard" worktrees/Q2-escalation/.agent/log.jsonl | jq

# View command outputs
cat worktrees/Q2-escalation/.agent/commands/2025-01-29T18-21-05Z-pnpm-lint.log
```

## Policy Guardrails

### Pre-Edit Checks

Before applying any code change, the policy guard checks:
- Block patterns (e.g., mock data, direct provider SDKs)
- Required patterns (e.g., fail-fast errors, MCP-first)

### Post-Edit Validation

After applying changes, validates:
- File size limits
- Error message format
- Environment variable documentation
- Migration idempotency

### Policy Violations

When a policy is violated:
1. Change is rejected (if severity is "block")
2. Warning is logged (if severity is "warn")
3. Violation is recorded in log with policy ID and reason

## Worktree Management

### Creating Worktrees

Worktrees are automatically created for each task:
- Location: `worktrees/<task-id>/`
- Branch: `{type}/{JIRA-ID}-{description}` (if Jira ID provided)
- Environment: `.env.local` copied from `.env.example`

### Worktree Lifecycle

1. **Create**: `git worktree add worktrees/<task-id> main`
2. **Checkout Branch**: `git checkout -b feature/ITPLAT01-1234-description`
3. **Execute**: Agents work in isolated worktree
4. **Cleanup**: `git worktree remove worktrees/<task-id>` (after merge or abandonment)

### Metadata Storage

Task metadata is stored in `agents/.state/tasks.json`:
- Worktree paths
- Branch names
- Status (pending, in_progress, completed, blocked, failed)
- Timestamps

## MCP Integration

### MCP-First Policy

The framework enforces MCP-first for external services:
1. Check MCP server availability
2. Use MCP if available
3. Fallback to direct API only if MCP unavailable
4. Log fallback reason and create TODO

### Supported MCP Servers

- **Supabase**: Always available via Cursor SDK
- **Slack**: Check `SLACK_MCP_ENABLED` environment variable
- **Microsoft 365**: Check `MS365_MCP_ENABLED` environment variable

## Troubleshooting

### Common Issues

1. **Plan file not found**
   - Ensure `80.plan.md` exists in repository root
   - Check file path in `PlanLoader.__init__()`

2. **Worktree creation fails**
   - Verify Git 2.5+ is installed
   - Check `worktrees/` directory permissions
   - Ensure base branch exists (`main`)

3. **Policy violations**
   - Check `agents/config/policies.json` for policy rules
   - Review log file for specific violation details
   - Adjust code to comply with policies

4. **MCP server unavailable**
   - Set environment variables (`SLACK_MCP_ENABLED`, `MS365_MCP_ENABLED`)
   - Verify MCP servers are configured in Cursor
   - Check fallback logs for direct API usage

### Debug Mode

Enable verbose logging by setting environment variable:
```bash
export AGENT_DEBUG=1
python agents/control.py --task Q2
```

## Development

### Adding New Policies

1. Add policy to `agents/config/policies.json`
2. Define block patterns and require patterns
3. Set severity level (block, warn, info)
4. Test policy enforcement

### Extending Agents

1. Create new agent class in `agents/pipeline/`
2. Implement required methods
3. Add to orchestrator in `agents/control.py`
4. Update logging in `agents/observability/logging.py`

### Testing

Run tests (when implemented):
```bash
cd agents
python -m pytest tests/
```

## Best Practices

1. **Always use worktrees**: Never work directly in main branch
2. **Check logs regularly**: Monitor `.agent/log.jsonl` for issues
3. **Review policy violations**: Address blocking violations immediately
4. **Use MCP servers**: Prefer MCP over direct APIs when available
5. **Document fallbacks**: Add TODO comments when using direct APIs

## Future Enhancements

- [ ] Full Cursor SDK integration for file operations
- [ ] Automated test execution
- [ ] Web dashboard for log viewing
- [ ] Human-in-the-loop approval hooks
- [ ] Parallel task execution
- [ ] CI/CD integration

## References

- [AGENTS.md](../../AGENTS.md) - Project guidelines and policies
- [80.plan.md](../../80.plan.md) - Implementation plan specification
- [Cursor SDK Documentation](https://cursor.sh/docs) - Cursor IDE SDK reference

