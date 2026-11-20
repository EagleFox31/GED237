#!/usr/bin/env bash
# Tests for scripts/check-lessons-frozen.sh, on a throwaway git repository.
# Usage: bash scripts/test_check_lessons_frozen.sh
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
check="$here/check-lessons-frozen.sh"
T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT
export GIT_AUTHOR_NAME=test GIT_AUTHOR_EMAIL=test@example.invalid
export GIT_COMMITTER_NAME=test GIT_COMMITTER_EMAIL=test@example.invalid

reg=DOCS/engineering/lessons-learned.md
fails=0

lesson() { printf '### LESSON-%s — titre\n\ncorps\n\n' "$1"; }

# Base: 001, 069, a pre-existing duplicate 050, and 072 (073 and 074 still free).
setup() {
  rm -rf "$T/repo"; mkdir -p "$T/repo/DOCS/engineering"; cd "$T/repo"
  git init -q
  { echo "# Registre"; for id in 2026-001 2026-050 2026-050 2026-069 2026-072; do lesson "$id"; done; } >"$reg"
  git add -A && git commit -qm base
}

# expect <exit code> <description> [text the output must contain]
expect() {
  local want="$1" what="$2" needle="${3:-}" out code=0
  out="$(bash "$check" HEAD 2>&1)" || code=$?
  if [ "$code" != "$want" ] || { [ -n "$needle" ] && ! grep -qF "$needle" <<<"$out"; }; then
    echo "FAIL: $what (exit $code, expected $want)"; echo "$out" | sed 's/^/    /'
    fails=$((fails + 1))
  else
    echo "ok: $what"
  fi
}

setup; expect 0 "unchanged register passes"
setup; echo "texte ajouté sous une leçon" >>"$reg"; expect 0 "editing text without a new heading passes"
setup; lesson 2026-073 >>"$reg"; lesson 2026-074 >>"$reg"; expect 0 "073 and 074 (open V1.1 pull requests) pass"
setup; lesson 2026-075 >>"$reg"; expect 1 "075 is refused" "DOCS/engineering/lessons/LESSON-AAAA-NNN.md"
setup; lesson 2027-001 >>"$reg"; expect 1 "a later year is refused" "LESSON-2027-001"
setup; lesson 2026-069 >>"$reg"; expect 1 "a second 069 is refused" "appears twice"
setup; lesson 2026-050 >>"$reg"; expect 1 "a third 050 is refused" "appears twice"
setup; sed -i 's/^### LESSON-2026-072/### LESSON-2026-073/' "$reg"; expect 0 "renumbering 072 to 073 passes"
setup; sed -i 's/^### LESSON-2026-072/### LESSON-2026-080/' "$reg"; expect 1 "renumbering 072 to 080 is refused" "LESSON-2026-080"
setup; git rm -q "$reg"; expect 0 "register removed: nothing to check"
setup; out="$(bash "$check" no-such-ref 2>&1)" && code=0 || code=$?
if [ "$code" = 2 ]; then echo "ok: unknown base exits 2"; else echo "FAIL: unknown base exit $code"; fails=$((fails + 1)); fi
setup; lesson 2026-075 >>"$reg"; out="$(LESSONS_FROZEN_MAX=2026-080 bash "$check" HEAD 2>&1)" && code=0 || code=$?
if [ "$code" = 0 ]; then echo "ok: LESSONS_FROZEN_MAX moves the limit"; else echo "FAIL: LESSONS_FROZEN_MAX ($code)"; fails=$((fails + 1)); fi

[ "$fails" -eq 0 ] && echo "All lessons-register checks passed" || { echo "$fails failure(s)"; exit 1; }
