#!/usr/bin/env bash
# Run the .pre-commit-config.yaml hooks in a container: no Python or hook tooling on the host.
# Works from the main checkout and from a worktree.
# Usage: bash scripts/pre-commit-docker.sh [pre-commit run arguments]
#   default: the staged files, as the git hook would. Example: bash scripts/pre-commit-docker.sh --all-files
# actionlint-docker is skipped (no Docker inside the container); CI runs it on every workflow change.
set -euo pipefail

# Absolute path as Docker expects it (C:/... under Git Bash on Windows).
abs() { (cd "$1" && { pwd -W 2>/dev/null || pwd; }); }
top="$(git rev-parse --show-toplevel)"
gitdir="$(abs "$(git rev-parse --git-dir)")"
common="$(abs "$(git rev-parse --git-common-dir)")"

# A worktree's .git file holds a host path the container cannot read: point git at the
# mounted directories instead. Main checkout: gitdir == common.
case "$gitdir" in
  "$common") container_gitdir=/git ;;
  "$common"/*) container_gitdir="/git/${gitdir#"$common"/}" ;;
  *) echo "pre-commit-docker: git dir $gitdir is outside $common" >&2; exit 2 ;;
esac

image="${PRE_COMMIT_IMAGE:-python:3.12-alpine}"
version="${PRE_COMMIT_VERSION:-4.0.1}"

MSYS_NO_PATHCONV=1 docker run --rm \
  --memory="${PRE_COMMIT_MEMORY:-1g}" --cpus="${PRE_COMMIT_CPUS:-2}" --log-opt max-size=1m \
  -v "$top:/src" -v "$common:/git" -w /src \
  -v ged237-pre-commit-cache:/root/.cache \
  -e GIT_DIR="$container_gitdir" -e GIT_WORK_TREE=/src \
  -e SKIP="${SKIP:-actionlint-docker}" -e PRE_COMMIT_VERSION="$version" \
  "$image" sh -c '
    apk add -q --no-progress git bash >/dev/null
    git config --global --add safe.directory "*"
    pip install -q --disable-pip-version-check --root-user-action=ignore "pre-commit==$PRE_COMMIT_VERSION"
    exec pre-commit run --show-diff-on-failure "$@"
  ' pre-commit-docker "$@"
