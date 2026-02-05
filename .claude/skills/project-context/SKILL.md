---
name: project-context
description: Core project context for documentation agents. Use when documentation agents need project structure, key standards, or Claude Code session data paths (plans, tasks, transcripts).
---

# 80HD Project Context

## Project Overview
80HD is an interruption shield for knowledge workers with ADHD, consolidating Microsoft 365 and Slack activity into a focused stream.

## Project Structure
- `apps/api/` - Supabase Edge Functions
- `apps/web/` - Next.js frontend
- `packages/shared/` - Shared TypeScript libraries
- `infra/` - Infrastructure definitions
- `docs/` - Documentation

## Key Standards (from AGENTS.md)
- TypeScript only, strict type safety
- Max 500 lines per file
- Use Vercel AI SDK for all LLM operations
- Zod for runtime validation
- No mocking in production code
- Idempotent database migrations

## Claude Code Session Data

Claude Code stores session data that provides context for documentation updates:

### Plans
**Path**: `~/.claude/plans/`
- Markdown files containing implementation plans from plan mode sessions
- Named with random readable words (e.g., `fizzy-prancing-treehouse.md`)
- Recent plans show what features/architecture were designed
- Use `ls -lt ~/.claude/plans/ | head -5` to find recent plans

### Tasks
**Path**: `~/.claude/tasks/<session-uuid>/`
- JSON files tracking work items within sessions
- Format: `{"id": "1", "subject": "...", "description": "...", "status": "completed|in_progress|pending", "blocks": [], "blockedBy": []}`
- Use `ls -lt ~/.claude/tasks/` to find recent task sessions

### Session Transcripts
**Path**: `~/.claude/projects/-Users-tedgar-Projects-80HD/`
- JSONL files with full conversation transcripts
- Named by session UUID (e.g., `2e8a0715-fa79-4396-ac3d-c5358d34b983.jsonl`)
- Contains all messages, tool calls, and results from sessions
