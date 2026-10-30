#!/usr/bin/env bash
# Tracked files must behave the same on Linux, macOS and Windows
# (LESSON-2026-003, LESSON-2026-013, LESSON-2026-014).
# Reads the index, so pre-commit checks exactly what is about to be committed.
# Fails on:
#   - paths that differ only by case (one folder on Windows/macOS, two on Linux);
#   - a file git detects as binary but that .gitattributes does not declare binary
#     (UTF-16 or NUL bytes: the file is no longer diffable nor normalized);
#   - control characters other than tab/newline, or U+FFFD (an encoding already lost).
set -euo pipefail

status=0

collisions=$(git -c core.quotepath=false ls-files \
  | awk -F/ '{ p = $1; print p; for (i = 2; i <= NF; i++) { p = p "/" $i; print p } }' \
  | sort -u \
  | awk '{ k = tolower($0); if (k in seen) print seen[k] "  <->  " $0; else seen[k] = $0 }')
if [ -n "$collisions" ]; then
  echo "Paths that differ only by case:"
  printf '%s\n' "$collisions" | sed 's/^/  /'
  echo "Fix: move everything under one spelling (git mv, or update-index on a case-insensitive disk)."
  status=1
fi

undeclared=$(git -c core.quotepath=false ls-files --eol \
  | awk -F'\t' '$1 ~ /^i\/-text/ && $1 !~ /attr\/-text/ { print $2 }')
if [ -n "$undeclared" ]; then
  echo "Files detected as binary (UTF-16? NUL bytes?) without a 'binary' rule in .gitattributes:"
  printf '%s\n' "$undeclared" | sed 's/^/  /'
  echo "Fix: re-save as UTF-8, or add a 'binary' pattern to .gitattributes if it is a real binary."
  status=1
fi

control=$(printf '[\001-\010\013-\037\177]')
replacement=$(printf '\357\277\275')
if git grep --cached -I -q -e "$control" -e "$replacement" -- .; then
  echo "Control characters or U+FFFD in text files:"
  git -c core.quotepath=false grep --cached -I -n -e "$control" -e "$replacement" -- . \
    | cut -d: -f1,2 | sed 's/^/  /'
  echo "Fix: restore the intended characters (often eaten by PowerShell backtick escapes or a wrong encoding)."
  status=1
fi

exit "$status"
