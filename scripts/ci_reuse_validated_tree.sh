#!/usr/bin/env bash
# Decides whether a push to main can reuse the validation of the merged pull request.
#
# skip=true only when ALL of these hold, otherwise skip=false and the full pipeline runs:
#   - the event is a push to main (never a pull request, a manual run or another branch);
#   - the pushed commit is the merge commit of exactly one merged pull request;
#   - that commit has the same git tree as the head commit that was merged
#     (same content: nothing was added by the merge itself);
#   - "CI Gate" concluded success on that head commit, reported by GitHub Actions.
# Any API error, missing value or doubt ends in skip=false (fail closed).
#
# Env: GITHUB_REPOSITORY, GITHUB_SHA, GITHUB_EVENT_NAME, GITHUB_REF, GH_TOKEN (read-only),
#      GITHUB_OUTPUT (optional), REUSE_GATE_NAME (default "CI Gate").
# Needs: git, gh, jq.
set -u

GATE_NAME="${REUSE_GATE_NAME:-CI Gate}"
OUT="${GITHUB_OUTPUT:-/dev/stdout}"

emit() { # $1 = true|false, $2 = reason
  echo "reuse decision: skip=$1 ($2)" >&2
  { echo "skip=$1"; echo "reason=$2"; } >> "$OUT"
  exit 0
}
full() { emit false "$1"; }

[ "${GITHUB_EVENT_NAME:-}" = "push" ] || full "not a push event"
[ "${GITHUB_REF:-}" = "refs/heads/main" ] || full "not main"
[ -n "${GITHUB_SHA:-}" ] && [ -n "${GITHUB_REPOSITORY:-}" ] || full "missing context"

tree=$(git rev-parse "${GITHUB_SHA}^{tree}" 2>/dev/null) || full "cannot read the commit tree"

pulls=$(gh api "repos/${GITHUB_REPOSITORY}/commits/${GITHUB_SHA}/pulls" 2>/dev/null) || full "pull request lookup failed"
count=$(echo "$pulls" | jq --arg sha "$GITHUB_SHA" \
  '[.[] | select(.merged_at != null and .merge_commit_sha == $sha)] | length' 2>/dev/null) || full "unreadable pull request answer"
[ "$count" = "1" ] || full "no single merged pull request for this commit ($count)"

head=$(echo "$pulls" | jq -r --arg sha "$GITHUB_SHA" \
  '[.[] | select(.merged_at != null and .merge_commit_sha == $sha)][0].head.sha // empty')
[ -n "$head" ] || full "no head commit"
[ "$head" != "$GITHUB_SHA" ] || full "pull request head is the pushed commit itself"

head_tree=$(gh api "repos/${GITHUB_REPOSITORY}/git/commits/${head}" --jq '.tree.sha' 2>/dev/null) || full "head commit lookup failed"
[ -n "$head_tree" ] || full "no head tree"
[ "$head_tree" = "$tree" ] || full "tree differs from the merged head"

green=$(gh api "repos/${GITHUB_REPOSITORY}/commits/${head}/check-runs?per_page=100" 2>/dev/null \
  | jq --arg name "$GATE_NAME" \
    '[.check_runs[] | select(.name == $name and .conclusion == "success" and .app.slug == "github-actions")] | length' 2>/dev/null) \
  || full "check runs lookup failed"
[ "${green:-0}" -ge 1 ] 2>/dev/null || full "\"${GATE_NAME}\" not green on the merged head"

emit true "same tree ${tree:0:12} as merged head ${head:0:12}, ${GATE_NAME} green"
