#!/bin/bash
# Triggers knowledge-maintainer subagent after significant file changes

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Skip if file is in docs/ (avoid infinite loops)
if [[ "$FILE_PATH" == *"/docs/"* ]] || [[ "$FILE_PATH" == *"README"* ]] || [[ "$FILE_PATH" == *"AGENTS"* ]] || [[ "$FILE_PATH" == *"CLAUDE"* ]]; then
  exit 0
fi

# Skip non-code files
if [[ ! "$FILE_PATH" =~ \.(ts|tsx|js|jsx|py|sql|json)$ ]]; then
  exit 0
fi

# Output JSON to inject context for main Claude session
cat << EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "A code file was modified: $FILE_PATH. Consider using the knowledge-maintainer subagent to update relevant documentation if this change affects APIs, architecture, or workflows."
  }
}
EOF
