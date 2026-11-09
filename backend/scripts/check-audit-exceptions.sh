#!/usr/bin/env bash
# Fail when a dated exception in pip-audit-ignore.txt has expired or has no date.
#
# Format of the ignore file: comment blocks carry "Expires: YYYY-MM-DD"; every
# advisory id that follows (until the next "Expires:") belongs to that block.
#
# Usage: check-audit-exceptions.sh [ignore-file]
#   AUDIT_TODAY=YYYY-MM-DD overrides today's date (for testing).
set -euo pipefail

FILE="${1:-$(dirname "$0")/../pip-audit-ignore.txt}"
TODAY="${AUDIT_TODAY:-$(date -u +%F)}"
expires=""
status=0

while IFS= read -r line || [[ -n "$line" ]]; do
  if [[ "$line" =~ Expires:\ ([0-9]{4}-[0-9]{2}-[0-9]{2}) ]]; then
    expires="${BASH_REMATCH[1]}"
    continue
  fi
  [[ "$line" =~ ^[[:space:]]*(#|$) ]] && continue
  id="${line%%[[:space:]]*}"
  if [[ -z "$expires" ]]; then
    echo "::error file=$FILE::$id has no 'Expires:' date in its justification block"
    status=1
  elif [[ "$TODAY" > "$expires" ]]; then
    echo "::error file=$FILE::pip-audit exception for $id expired on $expires (today: $TODAY): fix the advisory or re-justify it"
    status=1
  fi
done < "$FILE"

[[ "$status" -eq 0 ]] && echo "pip-audit exceptions: all dated and valid as of $TODAY"
exit "$status"
