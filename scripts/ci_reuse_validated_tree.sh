#!/usr/bin/env bash
# Decides whether a push to main can reuse the validation of the merged pull request.
#
# skip=true only when ALL of these hold, otherwise skip=false and the full pipeline runs:
#   - the event is a push to main (never a pull request, a manual run or another branch);
#   - the pushed commit is the merge commit of exactly one merged pull request;
#   - that commit has the same git tree as the head commit that was merged
#     (same content: nothing was added by the merge itself);
#   - the latest run of the CI workflow (pull_request event) on that head concluded success and its
#     "CI Gate" job succeeded.
# Any API error, missing value or doubt ends in skip=false (fail closed).
#
# Env: GITHUB_REPOSITORY, GITHUB_SHA, GITHUB_EVENT_NAME, GITHUB_REF, GH_TOKEN (read-only),
#      GITHUB_OUTPUT (optional), REUSE_GATE_NAME (default "CI Gate"), REUSE_WORKFLOW_PATH (default .github/workflows/ci.yml).
# Needs: git, gh, jq.
set -u

GATE_NAME="${REUSE_GATE_NAME:-CI Gate}"
WORKFLOW_PATH="${REUSE_WORKFLOW_PATH:-.github/workflows/ci.yml}"
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

# The check must come from the CI workflow itself (another workflow could name a job "CI Gate"),
# and only its LATEST run on that head counts (a green run followed by a red re-run is red).
runs=$(gh api "repos/${GITHUB_REPOSITORY}/actions/runs?head_sha=${head}&event=pull_request&per_page=100" 2>/dev/null) \
  || full "workflow runs lookup failed"
run_id=$(echo "$runs" | jq -r --arg p "$WORKFLOW_PATH" --arg h "$head" \
  '[.workflow_runs[] | select(.path == $p and .head_sha == $h)] | sort_by(.run_number) | last | select(. != null and .conclusion == "success") | .id' 2>/dev/null) \
  || full "unreadable workflow runs"
[ -n "$run_id" ] || full "latest ${WORKFLOW_PATH} run on the merged head is missing or not green"

green=$(gh api "repos/${GITHUB_REPOSITORY}/actions/runs/${run_id}/jobs?per_page=100" 2>/dev/null \
  | jq --arg name "$GATE_NAME" '[.jobs[] | select(.name == $name and .conclusion == "success")] | length' 2>/dev/null) \
  || full "jobs lookup failed"
[ "${green:-0}" -ge 1 ] 2>/dev/null || full "\"${GATE_NAME}\" not green in the latest run on the merged head"

emit true "same tree ${tree:0:12} as merged head ${head:0:12}, ${GATE_NAME} green"
