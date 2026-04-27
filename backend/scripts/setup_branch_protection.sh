#!/usr/bin/env bash
# T6.11 — Configure branch protection rules via GitHub CLI
# Usage: ./scripts/setup_branch_protection.sh [owner/repo]
# Requires: gh auth login (admin access)

set -euo pipefail

REPO="${1:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
echo "Configuring branch protection for: $REPO"

for BRANCH in main develop; do
  echo ""
  echo "=== Protecting branch: $BRANCH ==="

  gh api "repos/$REPO/branches/$BRANCH/protection" \
    --method PUT \
    --input - <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["CI / CI Gate"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
EOF

  echo "Branch '$BRANCH' protected."
done

echo ""
echo "Done. Branch protection configured for main and develop."
echo "Required status check: 'CI / CI Gate'"
