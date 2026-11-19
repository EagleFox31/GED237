#!/usr/bin/env bash
# Test of scripts/ci_reuse_validated_tree.sh with a fake "gh" and a real throwaway git repo:
# no network. Covers the one case that skips, and each doubt that must run the full pipeline.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$ROOT/scripts/ci_reuse_validated_tree.sh"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
fail() { echo "TEST FAILED: $1" >&2; [ -f "$T/out" ] && sed 's/^/  | /' "$T/out" >&2; exit 1; }

# A repo whose last commit has the same tree as an earlier "pr head" commit.
R="$T/repo"; mkdir -p "$R"
git -C "$R" init -q
git -C "$R" config user.email t@example.invalid; git -C "$R" config user.name t
echo base >"$R/f"; git -C "$R" add f; git -C "$R" commit -qm base
echo pr >"$R/f"; git -C "$R" commit -qam head
HEAD_SHA=$(git -C "$R" rev-parse HEAD)
git -C "$R" commit -q --allow-empty -m merge          # same tree as head
MERGE_SHA=$(git -C "$R" rev-parse HEAD)
TREE=$(git -C "$R" rev-parse "HEAD^{tree}")

mkdir -p "$T/bin" "$T/fix"
cat >"$T/bin/gh" <<'FAKE'
#!/usr/bin/env bash
url=""; for a in "$@"; do case "$a" in repos/*) url="$a" ;; esac; done
[ -f "$FIX/fail" ] && [ "$(cat "$FIX/fail")" = "${url##*/}" ] && exit 1
case "$url" in
  */pulls) cat "$FIX/pulls" ;;
  */git/commits/*) cat "$FIX/head_tree" ;;
  */actions/runs/*/jobs*) cat "$FIX/jobs" ;;
  */actions/runs?*) cat "$FIX/runs" ;;
  *) exit 1 ;;
esac
FAKE
chmod +x "$T/bin/gh"

run_json() { # id run_number conclusion [path] [head]
  echo "{\"id\":$1,\"run_number\":$2,\"conclusion\":\"$3\",\"path\":\"${4:-.github/workflows/ci.yml}\",\"head_sha\":\"${5:-$HEAD_SHA}\"}"
}
runs() { echo "{\"workflow_runs\":[$(run_json "$@")]}" >"$T/fix/runs"; }
jobs() { echo "{\"jobs\":[{\"name\":\"$1\",\"conclusion\":\"$2\"}]}" >"$T/fix/jobs"; }

setup() { # green case
  rm -f "$T/fix/fail"
  echo "[{\"merged_at\":\"2026-11-19T10:00:00Z\",\"merge_commit_sha\":\"$MERGE_SHA\",\"head\":{\"sha\":\"$HEAD_SHA\"}}]" >"$T/fix/pulls"
  echo "$TREE" >"$T/fix/head_tree"
  runs 7 5 success; jobs "CI Gate" success
  EVENT=push; REF=refs/heads/main
}
run() { # prints the skip value
  : >"$T/gh_out"
  ( cd "$R"; export FIX="$T/fix" PATH="$T/bin:$PATH" GITHUB_REPOSITORY=o/r GITHUB_SHA="$MERGE_SHA" \
      GITHUB_EVENT_NAME="$EVENT" GITHUB_REF="$REF" GH_TOKEN=x GITHUB_OUTPUT="$T/gh_out"
    bash "$SCRIPT" ) >"$T/out" 2>&1 || fail "script exited non-zero"
  grep '^skip=' "$T/gh_out" | cut -d= -f2
}
expect() { [ "$(run)" = "$1" ] || fail "$2 (expected skip=$1)"; }

setup; EVENT=push; expect true  "green case"
setup; EVENT=pull_request; expect false "pull request event"
setup; EVENT=workflow_dispatch; expect false "manual run"
setup; REF=refs/heads/develop; expect false "other branch"
setup; echo '[]' >"$T/fix/pulls"; expect false "direct push (no pull request)"
setup; sed -i 's/"merged_at":"[^"]*"/"merged_at":null/' "$T/fix/pulls"; expect false "pull request not merged"
setup; echo "0000000000000000000000000000000000000000" >"$T/fix/head_tree"; expect false "tree differs"
setup; echo "[{\"merged_at\":\"x\",\"merge_commit_sha\":\"$MERGE_SHA\",\"head\":{\"sha\":\"$MERGE_SHA\"}}]" >"$T/fix/pulls"; expect false "head is the pushed commit"
setup; jobs "CI Gate" failure; expect false "gate job red"
setup; jobs "Other" success; expect false "no CI Gate job in the run"
setup; runs 7 5 failure; expect false "latest run red"
setup; runs 7 5 success .github/workflows/other.yml; expect false "green run from another workflow"
setup; runs 7 5 success .github/workflows/ci.yml 0000000000000000000000000000000000000000; expect false "run of another commit"
setup; echo "{\"workflow_runs\":[$(run_json 7 5 success),$(run_json 8 6 failure)]}" >"$T/fix/runs"; expect false "green then red re-run: latest wins"
setup; echo "{\"workflow_runs\":[$(run_json 8 6 failure),$(run_json 7 5 success)]}" >"$T/fix/runs"; expect false "order in the answer does not matter"
setup; echo "{\"workflow_runs\":[$(run_json 7 5 failure),$(run_json 8 6 success)]}" >"$T/fix/runs"; expect true "red then green re-run: latest wins"
setup; echo '{"workflow_runs":[]}' >"$T/fix/runs"; expect false "no run at all"
setup; echo "not json" >"$T/fix/runs"; expect false "unreadable runs"
setup; echo "not json" >"$T/fix/jobs"; expect false "unreadable jobs"
setup; echo pulls >"$T/fix/fail"; expect false "pull lookup API error"
setup; echo "not json" >"$T/fix/pulls"; expect false "unreadable pull answer"

echo "OK: ci_reuse_validated_tree (2 skip cases, 22 full-pipeline cases)"
