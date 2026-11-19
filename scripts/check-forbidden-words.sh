#!/usr/bin/env bash
# Refuse staged ADDED lines that match a forbidden pattern.
#
# Manual step before each commit (run from the worktree, after `git add`):
#   scripts/check-forbidden-words.sh            # checks every staged file
# Also usable as a pre-commit hook (filenames passed as arguments).
#
# The pattern list is NOT stored in the repository. It is read from
# $FORBIDDEN_WORDS_FILE (default: ~/.config/forbidden-words). Without a list:
# manual mode fails (exit 2, nothing was checked); hook mode is a no-op, so CI
# and other machines are unaffected.
# One rule per line, "#" for comments, LF or CRLF:
#   EXTENDED_REGEX [!GLOB]...
# A "!GLOB" exempts matching paths for that rule (bash glob, "*" crosses "/").
# Matching is case-insensitive. Only lines added in the index are checked, so
# existing content never blocks a commit. Matched line content is never
# printed (it may hold a credential): only the file and the rule's line number.
set -euo pipefail

rules_file=${FORBIDDEN_WORDS_FILE:-$HOME/.config/forbidden-words}
files=("$@")
manual=0
if [ $# -eq 0 ]; then
  manual=1
  while IFS= read -r -d '' f; do files+=("$f"); done < <(git diff --cached --name-only -z --diff-filter=ACMR)
fi

if [ ! -r "$rules_file" ]; then
  [ "$manual" -eq 1 ] && { echo "no pattern list at $rules_file: nothing was checked" >&2; exit 2; }
  exit 0
fi

# Rules are read once; line numbers refer to the list file.
patterns=(); exempts=(); numbers=(); n=0
while IFS= read -r rule || [ -n "$rule" ]; do
  n=$((n + 1)); rule=${rule%$'\r'}
  [[ -z ${rule//[[:space:]]/} || $rule == \#* ]] && continue
  patterns+=("${rule%% !*}"); numbers+=("$n")
  if [[ $rule == *" !"* ]]; then exempts+=("${rule#* !}"); else exempts+=(""); fi
done < "$rules_file"

status=0
for f in ${files[@]+"${files[@]}"}; do
  # One diff per file, whatever the number of rules.
  added=$(git diff --cached -U0 --no-color -- "$f" | awk '/^\+\+\+ /{next} /^\+/{print substr($0,2)}')
  [ -n "$added" ] || continue
  for i in "${!patterns[@]}"; do
    read -ra globs <<< "${exempts[$i]}"
    skip=0
    for g in ${globs[@]+"${globs[@]}"}; do [[ $f == ${g#!} ]] && skip=1; done
    [ "$skip" -eq 1 ] && continue
    if grep -qiE -- "${patterns[$i]}" <<< "$added"; then
      echo "forbidden pattern (list line ${numbers[$i]}) in added lines of $f"
      status=1
    fi
  done
done

[ "$status" -eq 0 ] && [ "$manual" -eq 1 ] && echo "OK: ${#files[@]} staged file(s), ${#patterns[@]} rule(s), nothing forbidden."
exit $status
