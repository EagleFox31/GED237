#!/usr/bin/env bash
# Tests for scripts/check-git-safety.sh, on throwaway git repositories.
# Usage: bash scripts/test_check_git_safety.sh
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
check="$here/check-git-safety.sh"
T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT
export GIT_AUTHOR_NAME=test GIT_AUTHOR_EMAIL=test@example.invalid
export GIT_COMMITTER_NAME=test GIT_COMMITTER_EMAIL=test@example.invalid
# The user's own settings must not leak into the cases.
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
fails=0

# Remote with main and feat, and a clone of it (origin).
setup() {
  cd "$T" && rm -rf "$T/remote" "$T/repo" "$T/wt"
  git init -q -b main "$T/remote"
  git -C "$T/remote" commit -q --allow-empty -m base
  git -C "$T/remote" branch feat
  git clone -q "$T/remote" "$T/repo"
  cd "$T/repo"
}

# expect <exit code> <description> [text the output must contain]
expect() {
  local want="$1" what="$2" needle="${3:-}" out code=0
  out="$(bash "$check" 2>&1)" || code=$?
  if [ "$code" != "$want" ] || { [ -n "$needle" ] && ! grep -qF -- "$needle" <<<"$out"; }; then
    echo "FAIL: $what (exit $code, expected $want)"; echo "$out" | sed 's/^/    /'
    fails=$((fails + 1))
  else
    echo "ok: $what"
  fi
}

setup; expect 1 "push.default unset is refused" "expected 'nothing'"
setup; git config push.default upstream; expect 1 "push.default upstream is refused" "'upstream'"
setup; git config push.default nothing; expect 0 "nothing on main tracking origin/main passes"
setup; git config push.default nothing; git switch -q -c mine origin/main
expect 1 "a new branch tracking origin/main is refused" "tracks 'origin/main'"
setup; git config push.default nothing; git switch -q -c mine2 origin/feat
expect 1 "a new branch tracking another PR branch is refused" "tracks 'origin/feat'"
setup; git config push.default nothing; git switch -q --no-track -c mine3 origin/main
expect 0 "a --no-track branch passes"
setup; git config push.default nothing; git switch -q feat; expect 0 "feat tracking origin/feat passes"
setup; git config push.default nothing; git switch -q --detach HEAD; expect 0 "detached HEAD passes"
setup; git config push.default nothing
git worktree add -q -b wt "$T/wt" origin/main 2>/dev/null; cd "$T/wt"
expect 1 "a worktree branch created from origin/main is refused" "tracks 'origin/main'"
cd "$T"; out="$(bash "$check" 2>&1)" && code=0 || code=$?
if [ "$code" = 2 ]; then echo "ok: outside a git checkout exits 2"; else echo "FAIL: outside a checkout exit $code"; fails=$((fails + 1)); fi

[ "$fails" -eq 0 ] && echo "All git-safety checks passed" || { echo "$fails failure(s)"; exit 1; }
