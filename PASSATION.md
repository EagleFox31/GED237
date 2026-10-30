# PASSATION — GED237

## Objectif en cours
Lots A et B clos (hors décisions PO du B6). Prochain chantier : Lot C (`AUDIT.md` items 9-10) ou dette restante.

## Fait (2026-10-30)
- PR #20 fusionnée (a170e73) : politique de protection de `main` versionnée (`.github/project-config.json`),
  `CONTRIBUTING.md`, LESSON-2026-017.
- PR #21 fusionnée (50081e2) : `define` GEMINI_API_KEY retiré de `frontend/vite.config.ts` (plus de secret
  injecté dans le bundle). CI ciblée constatée : frontend + gitleaks seuls, backend/Trivy/Bandit sautés.
- PR #22 fusionnée (2333eb7) : Lot B item 8 volet frontend. `eslint --fix` 605 → 488 avertissements,
  7 règles rendues à `error`, cliquet `--max-warnings 488` dans `npm run lint`, LESSON-2026-018,
  walkthrough B8 complété.
- PR #18 fusionnée (ba71e2a) : 11 dépendances npm + types recharts ; CI verte sous le plafond 488.
- Branches locales fusionnées supprimées ; local = `main` seul, à jour.

## Décisions prises
- Dette ESLint héritée : plafonnée, pas réécrite. Le plafond baisse au chiffre mesuré après chaque
  nettoyage, jamais relevé (`CONTRIBUTING.md`).
- Les 11 règles encore en `warn` (`frontend/.eslintrc.json`) ne sont pas corrigeables automatiquement.
- Ordre de fusion : un changement de lint avant une montée de dépendances, pour que la CI de la seconde
  vérifie le plafond.

## Reste à faire
1. Après fusion de cette PR doc : constater que seuls gitleaks + `Tracked files` ont tourné (item 3).
2. Suivre appfactory #140 (toujours ouverte le 2026-10-30) ; à sa correction, mettre à jour le SHA épinglé
   dans `ci.yml` (2 occurrences).
3. PO : trancher les constats du walkthrough Lot B6 (`assignable-roles` sans RBAC, `standard` sans
   `users:update_own`, upsert du snapshot par `user_id` seul). Gate de couverture 70 % : décision à part.
4. PO : supprimer les branches distantes fusionnées (chore/gitattributes, chore/lint-blocking,
   ci/impact-aware-ci, feat/schema-head-check, test/api-coverage-lot-b6…) et trier les 4 branches
   `dependabot/*` restantes (une ESLint resolver, un groupe npm, deux pip).
5. Lancer une fois `release-integrity.yml` à la main.
6. Évaluer `reusable-project-automation.yml` (board GitHub Project) : dernier écart de `RAIDER.md`.
7. Dette frontend (Lot D) : 488 avertissements (215 `no-explicit-any`, 87 `button-has-type`, 83 `no-console`),
   bundle ~1,56 Mo sans code-splitting.

## Pièges / contexte
- **Tout s'exécute dans Docker**, plafonné (`--memory`, `--cpus=1`, `--log-opt max-size=1m`). Tests :
  `bash backend/scripts/test-in-docker.sh` (≈ 13 min, gate 70 %). `docker prune` : refusé par le PO.
- Frontend en Docker : copier `frontend/` (sans `node_modules`, `dist`) dans le conteneur `node:20-alpine`
  monté en `:ro`, `npm ci`, puis lint/typecheck/build. Pour rapatrier un `--fix` : tar des fichiers modifiés
  vers un volume du scratchpad, extraire sur l'hôte, `git add` puis `git checkout -- frontend/` (fins de ligne).
- `eslint --fix` sur `object-property-newline` casse l'indentation (règle `indent` à `off`) : relire le diff.
- Plus de push direct sur `main` : tout passe par PR, `CI Gate` vert et branche à jour (`gh pr update-branch`).
- Gouvernance / moteur d'impact en local : tarball appfactory v1.4.0 (`gh api repos/EagleFox31/appfactory-project-automation/tarball/0523510…`)
  extrait **dans** un conteneur `node:24-alpine` ; env `INPUT_GOVERNANCE_MODE`, `INPUT_GOVERNANCE_TOKEN`
  (via `"$(gh auth token)"`, jamais affiché), `INPUT_CONFIG_PATH`, `GITHUB_REPOSITORY`,
  `GITHUB_EVENT_NAME`, `GITHUB_EVENT_PATH`. `MSYS_NO_PATHCONV=1` et `pwd -W` sous Git Bash.
- `gh` : préfixer `export GODEBUG=;`. pre-commit : `export PATH="$HOME/.local/bin:$PATH"`.
- pre-commit refuse de tourner si `.pre-commit-config.yaml` a des modifs non indexées : `git stash push --keep-index -- <fichiers>`.
- Husky (`frontend/.husky`, lint-staged `--max-warnings=0`) n'est pas actif : seul le hook pre-commit tourne.
- Sous Windows, relire `git status` après un `git add` global : collision de casse possible (LESSON-2026-014).
- Ne jamais écrire de Markdown via `echo`/`>>` PowerShell (LESSON-2026-013).
- Trivy peut virer au rouge sans changement de code (nouvelle CVE dans une image de base).
- Fusions et changements de réglages GitHub : autorisation explicite du PO à chaque fois.
- Identité git : AKAA Jennifer. Aucune mention d'IA dans commits/PR.
- Fichier non suivi `gestion-projet/walkthrough/[Gemini] Etat de sante du projet - 2026-10-29.md` : pas à nous, ne pas commiter.
