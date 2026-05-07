#!/bin/bash
# Eventmodelers agent loop — processes tasks.json indefinitely
# Usage: ./ralph.sh [project_dir]
#   project_dir defaults to the directory containing this script (the project root)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${1:-"$SCRIPT_DIR"}"
TASKS_FILE="$PROJECT_DIR/tasks.json"
PROMPT_FILE="$PROJECT_DIR/prompt.md"
MODEL_FILE="$PROJECT_DIR/model.md"

if [[ ! -f "$PROJECT_DIR/.eventmodelers/config.json" ]]; then
  echo "ERROR: No .eventmodelers/config.json found in $PROJECT_DIR"
  exit 1
fi

if [[ ! -f "$MODEL_FILE" ]]; then
  echo "ERROR: No model.md found in $PROJECT_DIR"
  exit 1
fi

CLAUDE_CMD=$(head -1 "$MODEL_FILE" | tr -d '\r\n')

echo "Starting agent loop — project: $PROJECT_DIR"
echo "Using command: $CLAUDE_CMD"

# ------------------------------------------------------------
# Main loop — runs indefinitely
# ------------------------------------------------------------
while true; do
  # ---- Run Claude in the project root --------------------
  while true; do
    (cd "$PROJECT_DIR" && $CLAUDE_CMD "$(cat "$PROMPT_FILE")") 2>&1
    EXIT_CODE=$?
    if [[ $EXIT_CODE -eq 0 ]]; then
      break
    else
      echo
      echo "Claude exited with an error. Waiting 1 minute before retry..."
      sleep 60
    fi
  done

  sleep 2
done
