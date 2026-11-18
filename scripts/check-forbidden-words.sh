#!/usr/bin/env bash
# Pre-commit hook: refuse staged ADDED lines that match a forbidden pattern.
#
# The pattern list is NOT stored in the repository. It is read from
# $FORBIDDEN_WORDS_FILE (default: ~/.config/forbidden-words); no file = no-op.
# One rule per line, "#" for comments:
#   EXTENDED_REGEX [!GLOB]...
# A "!GLOB" exempts matching paths for that rule (bash glob, "*" crosses "/").
# Matching is case-insensitive. Only lines added in the index are checked, so
# existing content never blocks a commit. Matched line content is never
# printed (it may hold a credential): only the file and the rule.
set -euo pipefail

rules=${FORBIDDEN_WORDS_FILE:-$HOME/.config/forbidden-words}
[ -r "$rules" ] || exit 0

status=0
while IFS= read -r rule || [ -n "$rule" ]; do
  rule=${rule%$'\r'}
  [[ -z ${rule//[[:space:]]/} || $rule == \#* ]] && continue
  pattern=${rule%% !*}
  exempt=()
  [[ $rule == *" !"* ]] && read -ra exempt <<< "${rule#* !}"
  for f in "$@"; do
    skip=0
    for g in "${exempt[@]}"; do g=${g#!}; [[ $f == $g ]] && skip=1; done
    [ "$skip" -eq 1 ] && continue
    if git diff --cached -U0 --no-color -- "$f" | awk '/^\+\+\+ /{next} /^\+/{print substr($0,2)}' | grep -qiE -- "$pattern"; then
      echo "forbidden pattern #$(grep -nxF -- "$rule" "$rules" | head -1 | cut -d: -f1) in added lines of $f"
      status=1
    fi
  done
done < "$rules"
exit $status
