#!/bin/bash
# Eventmodelers agent loop — processes tasks.json indefinitely
# Usage: ./ralph.sh [project_dir]
#   project_dir defaults to the directory containing this script (the project root)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${1:-"$SCRIPT_DIR"}"
PROGRESS_FILE="$PROJECT_DIR/progress.txt"
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

if [[ ! -f "$PROGRESS_FILE" ]]; then
  echo "# Agent Progress Log" > "$PROGRESS_FILE"
  echo "Started: $(date)" >> "$PROGRESS_FILE"
  echo "---" >> "$PROGRESS_FILE"
fi

echo "Starting agent loop — project: $PROJECT_DIR"
echo "Using command: $CLAUDE_CMD"

# ------------------------------------------------------------
# Main loop — runs indefinitely
# ------------------------------------------------------------
while true; do
  clear
  echo "═══════════════════════════════════════════════════════"
  echo "  Agent tick — $(date)"
  echo "═══════════════════════════════════════════════════════"

  TMP_OUTPUT=$(mktemp)

  # ---- Run Claude in the project root --------------------
  while true; do
    if (cd "$PROJECT_DIR" && cat "$PROMPT_FILE" \
        | $CLAUDE_CMD) 2>&1 \
       | tee "$TMP_OUTPUT" | tee -a "$PROGRESS_FILE"; then
      break
    else
      echo
      echo "Claude exited with an error. Waiting 1 minutes before retry..."
      sleep 60
    fi
  done

  OUTPUT=$(cat "$TMP_OUTPUT")
  rm "$TMP_OUTPUT"

  # ---- Idle check ----------------------------------------
  if echo "$OUTPUT" | grep -q "<promise>IDLE</promise>"; then
    echo "No pending tasks — waiting..."
    sleep 2
    continue
  fi

  echo "Task processed. Continuing in 2 seconds..."
  sleep 2
done
