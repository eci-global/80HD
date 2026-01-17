# Agent Automation Framework

## Overview

This directory contains the automation framework for executing implementation plans using a multi-agent workflow built on top of Cursor SDK. The framework enforces AGENTS.md policies, manages git worktrees for isolation, and provides full observability into agent actions.

## Architecture

### Three-Agent Pipeline

1. **Planner Agent**: Selects tasks from plan specs, generates ordered substeps, packages context
2. **Implementer Agent**: Executes substeps using Cursor SDK, enforces policy guardrails, runs tests
3. **Verifier Agent**: Validates completion, updates documentation, generates structured reports

### Key Features

- **Policy Enforcement**: Machine-readable guardrails prevent violations (no mocks, MCP-first, etc.)
- **Worktree Isolation**: Each task runs in its own git worktree for parallel execution
- **Full Observability**: Structured JSONL logging captures every agent action
- **Deterministic Output**: Fixed prompt templates and context packaging ensure consistency
- **Model Selection**: Different models for different agent roles (planner vs implementer vs verifier)

## Directory Structure

```
agents/
├─ __init__.py                 # Python package initialization
├─ control.py                  # CLI orchestrator (main entry point)
├─ README.md                   # This file
├─ requirements.txt            # Python dependencies
├─ config/
│  ├─ __init__.py
│  ├─ models.yml               # Model assignments per agent role
│  └─ policies.json            # Codified AGENTS.md rules
├─ spec/
│  ├─ __init__.py
│  ├─ plan_loader.py           # Parses /80.plan.md into structured tasks
│  └─ task_schema.py           # Type definitions for task objects
├─ pipeline/
│  ├─ __init__.py
│  ├─ planner.py               # Planner agent implementation
│  ├─ implementer.py           # Implementer agent implementation
│  ├─ verifier.py              # Verifier agent implementation
│  ├─ policy_guard.py         # Pre/post-edit guardrail engine
│  └─ context_gatherer.py     # Packages context for agent prompts
├─ worktree/
│  ├─ __init__.py
│  ├─ manager.py              # Git worktree creation/removal
│  └─ metadata_store.py      # Persists task metadata
├─ observability/
│  ├─ __init__.py
│  ├─ logging.py              # Structured JSONL event logging
│  └─ reporting.py            # Generates agent summary reports
└─ utils/
   ├─ __init__.py
   ├─ cursor_client.py        # Wrapper around Cursor SDK primitives
   └─ mcp_helpers.py          # MCP-first connector wrappers
```

## Module Responsibilities

### control.py
- CLI entry point (`python agents/control.py --task Q2-escalation`)
- Task selection and routing
- Orchestrates planner → implementer → verifier pipeline
- Manages worktree lifecycle
- Prints status and logs

### config/
- **models.yml**: Defines which model each agent uses (e.g., planner: gpt-4o, implementer: cursor:code)
- **policies.json**: Machine-readable rules from AGENTS.md (no mocks, MCP-first, fail-fast, etc.)

### spec/
- **plan_loader.py**: Parses `/80.plan.md` markdown into structured task objects
- **task_schema.py**: Type definitions for task structure (id, files, success criteria, etc.)

### pipeline/
- **planner.py**: Generates ordered substeps from task spec, packages context bundle
- **implementer.py**: Executes substeps via Cursor SDK, applies guardrails, runs tests
- **verifier.py**: Validates completion, updates docs, generates reports
- **policy_guard.py**: Pre/post-edit validation against policies.json
- **context_gatherer.py**: Assembles spec excerpts, file snippets, MCP status, policies

### worktree/
- **manager.py**: Creates/removes git worktrees, manages branches
- **metadata_store.py**: Tracks task status, worktree paths, branch names

### observability/
- **logging.py**: Structured JSONL event logging (every agent action)
- **reporting.py**: Generates summary reports per agent (planner/implementer/verifier)

### utils/
- **cursor_client.py**: Thin wrapper around Cursor SDK (read_file, edit, run_command)
- **mcp_helpers.py**: MCP-first wrappers for Supabase/Slack/Microsoft 365 with fallback logging

## Usage

```bash
# List available tasks
python agents/control.py --list

# Run specific task
python agents/control.py --task Q2-escalation

# Resume existing worktree
python agents/control.py --resume feature/ITPLAT01-1234-escalation

# View logs for task
python agents/control.py --log Q2-escalation
```

## Requirements

- Python 3.11+
- Git 2.5+ (for worktree support)
- Cursor IDE (for SDK access)
- Access to MCP servers (Supabase, Slack, Microsoft 365)

## Development

See `docs/automation/agents.md` for detailed setup and development guide.

