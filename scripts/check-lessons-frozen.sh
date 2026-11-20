#!/usr/bin/env bash
# The shared lessons register is frozen (DEC-2026-009): every lesson added to it
# put all open pull requests in conflict on the same file. New lessons go in
# DOCS/engineering/lessons/LESSON-AAAA-NNN.md, one file each.
#
# Compares the register between BASE and the working tree and fails when a
# "### LESSON-AAAA-NNN" heading is added:
#   - with a number above the frozen range (LESSONS_FROZEN_MAX, default 2026-074);
#   - or with a number the register already holds (a renumbering collision).
# Headings already present in BASE are never judged: past duplicates stay as they are.
#
# Usage: scripts/check-lessons-frozen.sh [BASE]   (BASE defaults to HEAD^1)
set -euo pipefail

base="${1:-HEAD^1}"
register="${LESSONS_REGISTER:-DOCS/engineering/lessons-learned.md}"
frozen_max="${LESSONS_FROZEN_MAX:-2026-074}"

ids() { grep -oE '^### LESSON-[0-9]{4}-[0-9]{3}' | sed 's/^### LESSON-//' || true; }
key() { echo "$((10#${1%-*} * 1000 + 10#${1#*-}))"; }

if ! git rev-parse -q --verify "$base^{commit}" >/dev/null; then
  echo "check-lessons-frozen: base '$base' not found (fetch it first)" >&2
  exit 2
fi
if [ ! -f "$register" ]; then
  echo "check-lessons-frozen: $register absent, nothing to check"
  exit 0
fi

before="$(git show "$base:$register" 2>/dev/null | ids | sort)"
after="$(ids <"$register" | sort)"

# Lines present in the tree but not in BASE, multiplicity included (comm on sorted lists).
added="$(comm -13 <(printf '%s\n' "$before" | sed '/^$/d') <(printf '%s\n' "$after" | sed '/^$/d'))"
[ -z "$added" ] && { echo "check-lessons-frozen: no lesson added to $register"; exit 0; }

limit="$(key "$frozen_max")"
errors=0
while IFS= read -r id; do
  if [ "$(key "$id")" -gt "$limit" ]; then
    echo "::error file=$register::LESSON-$id added to the frozen register (001 to ${frozen_max#*-})."
    errors=$((errors + 1))
  elif [ "$(printf '%s\n' "$after" | grep -cx "$id")" -gt 1 ]; then
    echo "::error file=$register::LESSON-$id appears twice in the register: renumber it."
    errors=$((errors + 1))
  fi
done <<<"$added"

if [ "$errors" -gt 0 ]; then
  echo "New lessons go in DOCS/engineering/lessons/LESSON-AAAA-NNN.md (one file per lesson), not in $register."
  exit 1
fi
echo "check-lessons-frozen: added lessons stay within the frozen range ($(echo "$added" | tr '\n' ' '))"
