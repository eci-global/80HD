#!/bin/bash
# Utility to append a Q&A entry to a project's log
# Usage: ./log-qa.sh <project> <person> <question> <answer_summary> <topics>
# Topics should be comma-separated

PROJECT=$1
PERSON=$2
QUESTION=$3
ANSWER_SUMMARY=$4
TOPICS=$5

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="$SCRIPT_DIR/../references/projects/$PROJECT/qa-log.jsonl"

if [ ! -f "$LOG_FILE" ]; then
  echo "Error: No Q&A log found at $LOG_FILE"
  echo "Create the project directory first: references/projects/$PROJECT/"
  exit 1
fi

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TOPICS_JSON=$(echo "$TOPICS" | sed 's/,/","/g' | sed 's/^/["/' | sed 's/$/"]/')

echo "{\"timestamp\": \"$TIMESTAMP\", \"person\": \"$PERSON\", \"question\": \"$QUESTION\", \"answer_summary\": \"$ANSWER_SUMMARY\", \"topics\": $TOPICS_JSON}" >> "$LOG_FILE"

echo "Logged Q&A entry for $PERSON on $PROJECT"
