#!/bin/bash
# Ensures knowledge-maintainer only writes to documentation files

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Allow writes to docs/, README.md, AGENTS.md, and markdown files
if [[ "$FILE_PATH" == *"/docs/"* ]] || \
   [[ "$FILE_PATH" == *"README"* ]] || \
   [[ "$FILE_PATH" == *"AGENTS"* ]] || \
   [[ "$FILE_PATH" =~ \.md$ ]]; then
  exit 0
fi

# Block writes to non-documentation files
echo "knowledge-maintainer can only write to documentation files (docs/, README.md, AGENTS.md, *.md)" >&2
exit 2
