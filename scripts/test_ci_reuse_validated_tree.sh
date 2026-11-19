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
  */check-runs*) cat "$FIX/checks" ;;
  *) exit 1 ;;
esac
FAKE
chmod +x "$T/bin/gh"

setup() { # green case
  rm -f "$T/fix/fail"
  echo "[{\"merged_at\":\"2026-11-19T10:00:00Z\",\"merge_commit_sha\":\"$MERGE_SHA\",\"head\":{\"sha\":\"$HEAD_SHA\"}}]" >"$T/fix/pulls"
  echo "$TREE" >"$T/fix/head_tree"
  echo '{"check_runs":[{"name":"CI Gate","conclusion":"success","app":{"slug":"github-actions"}}]}' >"$T/fix/checks"
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
setup; echo '{"check_runs":[{"name":"CI Gate","conclusion":"failure","app":{"slug":"github-actions"}}]}' >"$T/fix/checks"; expect false "gate red"
setup; echo '{"check_runs":[{"name":"CI Gate","conclusion":"success","app":{"slug":"someone-else"}}]}' >"$T/fix/checks"; expect false "gate from another app"
setup; echo '{"check_runs":[]}' >"$T/fix/checks"; expect false "no gate at all"
setup; echo "[{\"merged_at\":\"x\",\"merge_commit_sha\":\"$MERGE_SHA\",\"head\":{\"sha\":\"$MERGE_SHA\"}}]" >"$T/fix/pulls"; expect false "head is the pushed commit"
setup; echo pulls >"$T/fix/fail"; expect false "pull lookup API error"
setup; echo "not json" >"$T/fix/checks"; expect false "unreadable check runs"
setup; echo "not json" >"$T/fix/pulls"; expect false "unreadable pull answer"

echo "OK: ci_reuse_validated_tree (1 skip case, 13 full-pipeline cases)"
