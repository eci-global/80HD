---
name: load-context
description: "Load full 80HD project context at the start of a Cowork or Claude Code session. Read CLAUDE.md, CLAUDE.local.md, AGENTS.md, and any .claude/context/ files to pick up where the last session left off. Use at the start of every session, or when asked to 'load context', 'pick up where we left off', 'what were we working on', or 'catch me up'."
---

# Load Session Context

You are loading the full 80HD project context so this session can pick up where the last one left off. This is critical — without this step, valuable context from previous sessions is lost.

## Steps

1. **Read the core project files** (in this order):
   - `CLAUDE.local.md` (project root) — This is the most important file. It contains the last session summary, active threads, key insights, and next steps. This is the handoff from the previous session.
   - `CLAUDE.md` (project root) — Project overview, structure, conventions, workflows, and the session context system.
   - `AGENTS.md` (project root) — Full coding standards and technical conventions.

2. **Check for topic-specific context files**:
   - List the contents of `.claude/context/` directory.
   - If any files exist, read them — they contain deep context on specific topics that span multiple sessions.

3. **Present a brief orientation** to Travis:
   - What the last session covered (from CLAUDE.local.md "Last Session" section)
   - Any active threads (ongoing multi-session topics)
   - Suggested next steps
   - Keep it concise — a few sentences, not a wall of text.

4. **Remind about the handoff convention**:
   - When this session ends or is hitting its limit, prioritize updating `CLAUDE.local.md` with:
     - Date and source (Cowork or Claude Code)
     - What was discussed / decided
     - Next steps
   - Don't let good context die. Writing the handoff is more important than finishing the last task.

## Constraints

- This is a **read-only** operation. Do not modify any files during context loading.
- Keep the summary **concise**. Travis has ADHD — a wall of text is the opposite of helpful.
- If CLAUDE.local.md doesn't exist yet, say so and offer to create it.
- If there's no "Last Session" content, just load the project context and say this is a fresh start.

## Success Criteria

After running this skill, Claude should:
- Know what 80HD is and how the codebase is structured
- Know what happened in the last session
- Know what the active threads and next steps are
- Be ready to work as if it has been on this project continuously
