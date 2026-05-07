#!/bin/bash
# Eventmodelers agent loop — processes tasks.json indefinitely
# Usage: ./ralph.sh [project_dir]
#   project_dir defaults to the parent of realtime-agent/ (the project root)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${1:-"$(cd "$SCRIPT_DIR/.." && pwd)"}"
PROGRESS_FILE="$PROJECT_DIR/progress.txt"
TASKS_FILE="$PROJECT_DIR/tasks.json"

if [[ ! -f "$PROJECT_DIR/.eventmodelers/config.json" ]]; then
  echo "ERROR: No .eventmodelers/config.json found in $PROJECT_DIR"
  exit 1
fi

if [[ ! -f "$PROGRESS_FILE" ]]; then
  echo "# Agent Progress Log" > "$PROGRESS_FILE"
  echo "Started: $(date)" >> "$PROGRESS_FILE"
  echo "---" >> "$PROGRESS_FILE"
fi

echo "Starting agent loop — project: $PROJECT_DIR"

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
    if (cd "$PROJECT_DIR" && cat "$SCRIPT_DIR/prompt.md" \
        | claude --dangerously-skip-permissions) 2>&1 \
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