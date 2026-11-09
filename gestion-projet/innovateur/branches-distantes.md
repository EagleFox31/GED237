# Inventaire des branches distantes — lecture seule, aucune suppression effectuée

- **Instruction** : innovateur, 2026-11-09 20:40, après `git fetch --prune origin` ; `Vérifié` (`git for-each-ref`, `git merge-base --is-ancestor`, `gh pr list --state all`). Décision de suppression : **PO**, exécution : orchestrateur ou ci-qa via `git push origin --delete <branche>` (jamais depuis le checkout partagé d'une session en cours de travail).
- 19 branches distantes hors `main`. **12 fusionnées et supprimables**, 1 fermée sans fusion supprimable, **6 à garder** (PR ouvertes).

## Supprimer (fusionnées dans `main`, PR MERGED ; contenu entièrement dans l'historique)

| Branche | Dernier commit | Date | PR | Motif |
|---|---|---|---|---|
| `fix/runtime-ocr-hardening` | 7d9574f | 2026-10-28 | #1 MERGED | fusionnée |
| `feat/v1-local-consolidation` | 7a696c0 | 2026-10-28 | #2 MERGED | fusionnée |
| `docs/test-in-docker` | 4d0daea | 2026-10-28 | #3 MERGED | fusionnée |
| `chore/lint-blocking` | 6983cf7 | 2026-10-29 | #4 MERGED | fusionnée |
| `feat/schema-head-check` | 5e29870 | 2026-10-29 | #5 MERGED | fusionnée |
| `dependabot/npm_and_yarn/frontend/eslint-import-resolver-typescript-4.4.5` | 1ebe180 | 2026-10-30 | #10 MERGED | fusionnée (Dependabot supprime normalement ses branches : vérifier l'option « Automatically delete head branches » du dépôt, désactivée à en juger par ces restes) |
| `dependabot/pip/backend/pytest-cov-7.1.0` | 8045dad | 2026-10-30 | #13 MERGED | fusionnée |
| `dependabot/pip/backend/pre-commit-4.7.0` | 99deb96 | 2026-10-30 | #14 MERGED | fusionnée |
| `chore/gitattributes` | ebdfd85 | 2026-10-29 | #16 MERGED | fusionnée |
| `test/api-coverage-lot-b6` | 5f64adc | 2026-10-29 | #17 MERGED | fusionnée |
| `ci/impact-aware-ci` | 52b19ee | 2026-10-30 | #19 MERGED | fusionnée |
| `docs/equipe-agents` | de3ab47 | 2026-11-09 | #34 MERGED | fusionnée aujourd'hui ; supprimer après la fin de la journée pour ne pas gêner une session qui l'aurait encore en worktree |

## Supprimer (PR fermée sans fusion, remplacée)

| Branche | Dernier commit | Date | PR | Motif |
|---|---|---|---|---|
| `dependabot/pip/backend/python-7d63d1b177` | c0faf6f | 2026-11-02 | #31 CLOSED | fermée par DEC-2026-001 (monolithe de 25 mises à jour non fusionnable, remplacée par la PR ciblée #37 fusionnée) ; 1 commit non fusionné, sans valeur |

## Garder (PR ouvertes)

| Branche | Dernier commit | Date | Avance sur main | PR | Motif |
|---|---|---|---|---|---|
| `ci/e2e-smoke` | 819abd7 | 2026-11-09 | 4 commits | #39 OPEN | travail ci-qa en cours (pile e2e Docker, Playwright smoke) |
| `docs/point-2026-11-09-soir` | 59866bd | 2026-11-09 | 1 commit | #40 OPEN | PR docs de l'orchestrateur (DEC-003, dossiers innovateur, passations) |
| `dependabot/npm_and_yarn/frontend/npm-63dacba73d` | df0f9c5 | 2026-11-09 | 1 commit | #35 OPEN | à fusionner (triage du 09/11) ; la branche disparaît avec la fusion si la suppression automatique est activée |
| `dependabot/npm_and_yarn/frontend/typescript-7.0.2` | dd9550e | 2026-11-09 | 1 commit | #29 OPEN | reportée après le 30/11 (DEC-2026-001) ; Dependabot la met à jour seul |
| `dependabot/npm_and_yarn/frontend/eslint-10.14.0` | fec2579 | 2026-11-09 | 1 commit | #30 OPEN | idem #29, même chantier ESLint flat config |

## Recommandations annexes (0 j-p, réglages du dépôt, accord PO)

1. Activer **« Automatically delete head branches »** dans les paramètres GitHub du dépôt : évite que l'inventaire se reconstitue à chaque fusion (les 7 branches Dependabot/`chore` fusionnées ci-dessus en sont la conséquence).
2. Convention : une branche fusionnée est supprimée **par l'auteur de la fusion** le jour même, après avoir vérifié qu'aucun worktree local ne la référence (`git worktree list`).
3. Commande de nettoyage, à exécuter par l'orchestrateur après validation PO (une ligne, idempotente : une branche déjà supprimée renvoie une erreur sans effet) :

```
git push origin --delete fix/runtime-ocr-hardening feat/v1-local-consolidation docs/test-in-docker chore/lint-blocking feat/schema-head-check dependabot/npm_and_yarn/frontend/eslint-import-resolver-typescript-4.4.5 dependabot/pip/backend/pytest-cov-7.1.0 dependabot/pip/backend/pre-commit-4.7.0 chore/gitattributes test/api-coverage-lot-b6 ci/impact-aware-ci dependabot/pip/backend/python-7d63d1b177
```

(`docs/equipe-agents` à ajouter demain.) Vérification après coup : `git ls-remote --heads origin | wc -l` doit donner 7 (main + 6 gardées).
