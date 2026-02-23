#!/bin/bash
# ==============================================================================
# RALPH WIGGUM - Long-running AI agent loop
# ==============================================================================
# CRITICAL: This file is INFRASTRUCTURE, not code.
# DO NOT DELETE OR MODIFY this file when implementing user stories.
# This script orchestrates the Ralph agent loop and manages execution.
# If you delete this file, Ralph will not be able to run.
# ==============================================================================
# Usage: ./ralph.sh [--tool cline] [max_iterations]
# ==============================================================================

set -e

# Parse arguments
TOOL="cline"  # Default to cline for WSL environment
MAX_ITERATIONS=10
TIMEOUT_MINUTES=15  # Maximum time per iteration to prevent hanging

while [[ $# -gt 0 ]]; do
  case $1 in
    --tool)
      TOOL="$2"
      shift 2
      ;;
    --tool=*)
      TOOL="${1#*=}"
      shift
      ;;
    --timeout)
      TIMEOUT_MINUTES="$2"
      shift 2
      ;;
    --timeout=*)
      TIMEOUT_MINUTES="${1#*=}"
      shift
      ;;
    *)
      # Assume it's max_iterations if it's a number
      if [[ "$1" =~ ^[0-9]+$ ]]; then
        MAX_ITERATIONS="$1"
      fi
      shift
      ;;
  esac
done

# Validate tool choice
if [[ "$TOOL" != "cline" ]]; then
  echo "Error: Invalid tool '$TOOL'. Must be 'cline'."
  exit 1
fi
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRD_FILE="$SCRIPT_DIR/prd.json"
PROGRESS_FILE="$SCRIPT_DIR/progress.txt"
ARCHIVE_DIR="$SCRIPT_DIR/archive"
LAST_BRANCH_FILE="$SCRIPT_DIR/.last-branch"

# Archive previous run if branch changed
if [ -f "$PRD_FILE" ] && [ -f "$LAST_BRANCH_FILE" ]; then
  CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
  LAST_BRANCH=$(cat "$LAST_BRANCH_FILE" 2>/dev/null || echo "")
  
  if [ -n "$CURRENT_BRANCH" ] && [ -n "$LAST_BRANCH" ] && [ "$CURRENT_BRANCH" != "$LAST_BRANCH" ]; then
    # Archive the previous run
    DATE=$(date +%Y-%m-%d)
    # Strip "ralph/" prefix from branch name for folder
    FOLDER_NAME=$(echo "$LAST_BRANCH" | sed 's|^ralph/||')
    ARCHIVE_FOLDER="$ARCHIVE_DIR/$DATE-$FOLDER_NAME"
    
    echo "Archiving previous run: $LAST_BRANCH"
    mkdir -p "$ARCHIVE_FOLDER"
    [ -f "$PRD_FILE" ] && cp "$PRD_FILE" "$ARCHIVE_FOLDER/"
    [ -f "$PROGRESS_FILE" ] && cp "$PROGRESS_FILE" "$ARCHIVE_FOLDER/"
    echo "   Archived to: $ARCHIVE_FOLDER"
    
    # Reset progress file for new run
    echo "# Ralph Progress Log" > "$PROGRESS_FILE"
    echo "Started: $(date)" >> "$PROGRESS_FILE"
    echo "---" >> "$PROGRESS_FILE"
  fi
fi

# Track current branch
if [ -f "$PRD_FILE" ]; then
  CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
  if [ -n "$CURRENT_BRANCH" ]; then
    echo "$CURRENT_BRANCH" > "$LAST_BRANCH_FILE"
  fi
fi

# Initialize progress file if it doesn't exist
if [ ! -f "$PROGRESS_FILE" ]; then
  echo "# Ralph Progress Log" > "$PROGRESS_FILE"
  echo "Started: $(date)" >> "$PROGRESS_FILE"
  echo "---" >> "$PROGRESS_FILE"
fi

echo "Starting Ralph - Tool: $TOOL - Max iterations: $MAX_ITERATIONS"

# Load the prompt from CLINE.md once
PROMPT=$(cat "$SCRIPT_DIR/CLINE.md")

for i in $(seq 1 $MAX_ITERATIONS); do
  echo ""
  echo "==============================================================="
  echo "  Ralph Iteration $i of $MAX_ITERATIONS ($TOOL)"
  echo "==============================================================="

  # Run the selected tool with the ralph prompt with timeout
  if [[ "$TOOL" == "cline" ]]; then
    echo "⏱ Timeout set to ${TIMEOUT_MINUTES} minutes for this iteration"
    START_TIME=$(date +%s)
    
    # Updated for Cline 2.0+: Use --yolo for autonomous one-shot mode, --act for act mode (default, but explicit)
    # Prompt is now passed as argument instead of stdin redirection
    OUTPUT=$(timeout ${TIMEOUT_MINUTES}m cline --yolo --act "$PROMPT" 2>&1 | tee /dev/stderr) || {
      EXIT_CODE=$?
      ELAPSED=$(($(date +%s) - START_TIME))
      
      if [ $EXIT_CODE -eq 124 ]; then
        echo ""
        echo "⚠ TIMEOUT: Cline iteration exceeded ${TIMEOUT_MINUTES} minutes"
        echo "   This typically indicates Cline is stuck in analysis or decision-making"
        echo "   Will continue to next iteration..."
        OUTPUT="TIMEOUT"
      else
        echo ""
        echo "⚠ Cline exited with code: $EXIT_CODE"
        echo "   Elapsed time: ${ELAPSED}s"
        echo "   Will continue to next iteration..."
        OUTPUT="ERROR"
      fi
    }
  fi

  # Check for completion signal OR verify PRD directly
  if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>" || [ -f "$PRD_FILE" ]; then
    echo ""
    echo "Checking completion status in prd.json..."
    
    # Verify ALL stories have passes: true using jq
    if [ -f "$PRD_FILE" ]; then
      ALL_COMPLETE=$(jq -r '.userStories | map(.passes) | all' "$PRD_FILE" 2>/dev/null || echo "false")
      
      if [ "$ALL_COMPLETE" == "true" ]; then
        echo "✓ All user stories confirmed complete in prd.json"
        echo ""
        echo "Ralph completed all tasks!"
        echo "Completed at iteration $i of $MAX_ITERATIONS"
        exit 0
      else
        REMAINING=$(jq -r '.userStories | map(select(.passes == false)) | length' "$PRD_FILE" 2>/dev/null || echo "unknown")
        echo "✗ prd.json shows $REMAINING stories still incomplete"
        echo "   Continuing to next iteration..."
      fi
    else
      echo "Warning: prd.json not found, continuing..."
    fi
  fi

  echo "Iteration $i complete. Continuing..."
  sleep 2
done

echo ""
echo "Ralph reached max iterations ($MAX_ITERATIONS) without completing all tasks."
echo "Check $PROGRESS_FILE for status."
exit 1