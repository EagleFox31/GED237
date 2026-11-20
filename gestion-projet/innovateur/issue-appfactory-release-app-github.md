# Texte de l'issue appfactory : App GitHub dans `reusable-release.yml`

- **Pour** : O, qui ouvre l'issue sur `EagleFox31/appfactory-project-automation` après le 30/11 (les sessions ne peuvent pas créer d'issue).
- **Source** : `fiche-adopt-release-please-apres-30.md`, § 2 (ligne « Jeton »), § 3 et § 8 (commits 1a3aa30 et 904c5a0).
- **Vérifié le 17/11** :
  - `reusable-release.yml` au SHA épinglé `0523510a` (v1.4.0), l. 46-48 et 92/102, ainsi que sur `main` (l. 52, 97, 107) : seul le secret `release_token` est accepté ;
  - `reusable-repository-governance.yml` sur `main` : modèle `authentication: github-app` (l. 21-36, 85-89) ;
  - issue #25 de l'appfactory (fermée) : le modèle App par installation est celui de Repository Governance.
- **Langue** : l'anglais, comme les autres issues du dépôt.
- **Labels suggérés** : `enhancement`, `release`.

---

**Titre** : `[Release] Support GitHub App authentication in reusable-release.yml (zero-PAT release PRs that trigger CI)`

**Corps** :

## Need

Consumers that adopt `reusable-release.yml` under the AppFactory zero-PAT rule cannot get a release PR that triggers their required CI checks. The only non-default credential the workflow accepts is a token secret (`release_token`), which in practice means a PAT. A PAT contradicts the zero-PAT policy and needs a written exception in each consumer repository.

First consumer: GED237, which plans to adopt the workflow, pinned to `0523510a` (v1.4.0) in manifest mode, after its v1.0.0 release.

## Current behavior

- `reusable-release.yml` passes `token: ${{ secrets.release_token || github.token }}` to `googleapis/release-please-action@v4` (v1.4.0, l. 92 and l. 102; same on `main`, l. 97 and l. 107).
- Without `release_token`, the workflow uses `GITHUB_TOKEN`. GitHub does not start new workflow runs for events created with `GITHUB_TOKEN`, as the "Token behavior" section of the docs already notes. This has two effects:
  1. CI does not run on the release PR. With a ruleset that requires status checks, the PR stays blocked until someone closes and reopens it by hand.
  2. A `release: published` workflow in the consumer (for example, SBOM, manifest and signature) does not run for a release that Release Please publishes. It fails silently.
- The other choice is `release_token`, which is a PAT.

## Expected behavior

The same authentication contract as `reusable-repository-governance.yml`, to keep the AppFactory interface consistent:

- an input `authentication: token | github-app`, defaulting to `token` so existing callers are unchanged;
- an input `app_client_id` and a secret `app_private_key`, required only when `authentication: github-app`, and validated by an explicit error step like the one in governance (no mixed modes);
- the token is minted with `actions/create-github-app-token@v3`, scoped to the calling repository only, with `permission-contents: write`, `permission-pull-requests: write` and `permission-issues: write`;
- that token is passed to `release-please-action` in both modes (direct and manifest).

Events created by an App installation token do trigger workflows. The release PR would then run CI on its own, and a `release: published` workflow would run as well.

Acceptance criteria:

- [ ] `authentication: token` with no `release_token` behaves exactly as v1.4.0 (non-regression).
- [ ] `authentication: github-app` without `app_client_id` or without `app_private_key` fails with an actionable error.
- [ ] `authentication: github-app` with a valid App: the release PR shows the consumer's required checks without a manual close and reopen, and `release: published` workflows run.
- [ ] The private key and the minted token never appear in logs.
- [ ] `docs/product-release-automation.md` and `examples/product-release.yml` document both modes.
- [ ] Released as a minor version (new optional inputs, no breaking change).

## Workaround (until this ships)

In the consumer's caller workflow, keeping the pinned SHA and `GITHUB_TOKEN`:

1. **Release PR CI**: close and reopen the release PR by hand. The `reopened` event comes from a user, so CI runs.
2. **Integrity workflow**: add a second job `needs: release` with `if: needs.release.outputs.release_created == 'true'`. It runs `gh workflow run release-integrity.yml --ref "${{ needs.release.outputs.tag_name }}"` and needs `actions: write`. A `workflow_dispatch` started with `GITHUB_TOKEN` does run.

Cost of the workaround: one manual action for each release, plus one extra job in each consumer. If someone forgets the close and reopen, the release PR stays blocked. Nothing breaks silently.
