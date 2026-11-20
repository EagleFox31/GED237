#!/usr/bin/env bash
# Push safety of the current checkout (LESSON-2026-075).
# 1. push.default is "nothing": a push without a destination fails instead of guessing one.
# 2. The current branch does not track a branch of another name (worktree created from a base
#    branch without --no-track): a push to its upstream would write on someone else's branch.
# Usage: bash scripts/check-git-safety.sh   (exit 0 safe, 1 unsafe, 2 not a git checkout)
set -uo pipefail

git rev-parse --git-dir >/dev/null 2>&1 || { echo "check-git-safety: not a git checkout" >&2; exit 2; }
fails=0

mode="$(git config --get push.default || true)"
if [ "$mode" != "nothing" ]; then
  echo "UNSAFE: push.default is '${mode:-unset (simple)}', expected 'nothing'."
  echo "        Fix once for every worktree: git config push.default nothing"
  fails=$((fails + 1))
fi

branch="$(git symbolic-ref --quiet --short HEAD || true)"
if [ -n "$branch" ]; then
  upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"
  # An upstream is fine only when it is the branch of the same name (origin/<branch>).
  if [ -n "$upstream" ] && [ "${upstream#*/}" != "$branch" ]; then
    echo "UNSAFE: branch '$branch' tracks '$upstream'."
    echo "        Fix: git branch --unset-upstream $branch, then push with origin HEAD:refs/heads/$branch"
    fails=$((fails + 1))
  fi
fi

[ "$fails" -eq 0 ] && echo "git push safety: OK" || exit 1
