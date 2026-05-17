#!/bin/bash
# Eventmodelers agent loop — processes tasks.json when entries are present
#
# Triggered by: tasks.json has entries (written by the realtime-agent)
#
# Usage: ./ralph.sh [iterations] [project_dir]
#   iterations  — number of loop cycles to run; 0 or omitted means run forever
#   project_dir — defaults to current working directory

set -euo pipefail

ITERATIONS="${1:-0}"
PROJECT_DIR="${2:-.}"
TASKS_FILE="$PROJECT_DIR/tasks.json"
PROMPT_FILE="$PROJECT_DIR/prompt.md"
AGENT_SCRIPT="$PROJECT_DIR/agent.sh"

if [[ ! -f "$PROJECT_DIR/.eventmodelers/config.json" ]]; then
  echo "ERROR: No .eventmodelers/config.json found in $PROJECT_DIR"
  exit 1
fi

echo "Eventmodelers agent — project: $PROJECT_DIR"

# Returns 0 if tasks.json has at least one task
has_pending_tasks() {
  [[ -f "$TASKS_FILE" ]] || return 1
  local content
  content=$(cat "$TASKS_FILE")
  [[ "$content" != "[]" && -n "$content" ]]
}

# Runs agent.sh with the given prompt; retries on non-zero exit
run_agent() {
  local label="$1"
  local prompt="$2"
  while true; do
    echo "[$(date -u +%H:%M:%S)] $label"
    (cd "$PROJECT_DIR" && bash "$AGENT_SCRIPT" "$prompt") 2>&1 && return 0
    echo "[$(date -u +%H:%M:%S)] Agent error — retrying in 60s..."
    sleep 60
  done
}

cycle=0
while [[ "$ITERATIONS" -eq 0 || "$cycle" -lt "$ITERATIONS" ]]; do
  if has_pending_tasks; then
    run_agent "Processing tasks..." "$(cat "$PROMPT_FILE")"
  else
    sleep 3
  fi

  (( cycle++ )) || true
done