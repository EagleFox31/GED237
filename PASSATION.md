# PASSATION — GED237

## Objectif en cours
Impact-Aware CI (brique `EagleFox31/appfactory-project-automation` v1.4.0) adoptée sur
`ci/impact-aware-ci` : la CI ne lance que les gates des surfaces touchées. PR vers `main` à fusionner.
Lot B de `AUDIT.md` : items 6, 7, 8 et `.gitattributes` fusionnés (PR #4, #5, #16, #17).

## Fait (2026-10-29) — branche `ci/impact-aware-ci`
- 9fcffe0 : `.github/appfactory-impact.json` (5 surfaces, `fallback: all`) ; `ci.yml` : job
  `Change impact` épinglé par SHA, jobs gardés par gate, gitleaks + `Tracked files` toujours,
  `workflow_dispatch` = tout ; `security.yml` : entrée `gates` (défaut : tous les scans) ;
  `CI Gate` refuse `cancelled` et l'échec de l'analyse ; `quality-gate.yml` (doublon) supprimé ;
  `scripts/check-impact-gates.py` en hook pre-commit + étape actionlint.
- 0ba7d11 : `CONTRIBUTING.md`, `RAIDER.md` (écart Scoped execution résorbé), LESSON-2026-016,
  walkthrough `walkthrough/[Claude] Impact-Aware CI - 2026-10-29.md`.
- Preuves : actionlint exit 0 ; garde-fou rouge sur 3 mutations ; moteur réel rejoué sur des commits
  historiques et sur les 534 fichiers suivis (aucun hors carte).

## Décisions prises
- Adopt appfactory tel quel ; seul Build : le garde-fou de cohérence carte ↔ workflows.
- Fichiers transversaux (`.github/**`, `scripts/**`, `.pre-commit-config.yaml`, `.gitattributes`) → tout.
- `dir/**` ne couvre pas les dotfiles (`path.matchesGlob`) : `backend/**/.*`, `frontend/**/.*` ajoutés.
- Pas de `--unsafe-fixes` ruff ; Bandit CI = hook (`.bandit.yml`) ; un seul script pour hook et CI.

## Reste à faire
1. PO : fusionner #19 (CI 12/12 verte) ; passer son walkthrough en DONE.
   Dépôt passé en **public** le 2026-10-30 (Actions refusées sur le privé faute de facturation).
2. Proposer en amont (appfactory) : `git -c core.quotePath=false diff -z --name-only` dans
   `analyze.mjs` — un chemin non ASCII déclenche aujourd'hui le fallback `all`.
3. PO : trancher les constats du walkthrough Lot B6 (`assignable-roles` sans RBAC, `standard` sans
   `users:update_own`, upsert du snapshot par `user_id` seul). Relever le gate de 70 % : décision à part.
4. Retirer le `define` GEMINI_API_KEY inutilisé de `frontend/vite.config.ts` (clé injectée dans le bundle si renseignée).
5. Lancer une fois `release-integrity.yml` à la main (`workflow_dispatch`) pour valider SBOM + manifeste ;
   supprimer les branches distantes fusionnées si le PO le souhaite.
6. Évaluer `reusable-project-automation.yml` (board GitHub Project) : dernier écart de `RAIDER.md`.

## Pièges / contexte
- **Tout s'exécute dans Docker**, jamais sur l'hôte. Tests : `bash backend/scripts/test-in-docker.sh` (≈ 13 min, gate 70 %).
- Docker Desktop peut s'arrêter seul (« Ressources système insuffisantes ») : `docker desktop restart`.
- `docker prune` : le PO a dit non, ne pas le proposer.
- Rejouer le moteur d'impact : tarball appfactory v1.4.0 extrait **dans** un conteneur Node
  (`tar` Git Bash échoue sur `C:/…`), `MSYS_NO_PATHCONV=1`.
- `main` non protégée. Possible depuis le passage en public (l'API répondait 403 en privé) :
  exiger `CI Gate` via `scripts/setup-branch-protection.sh` ou la Repository Governance d'appfactory.
- `gh` : préfixer `export GODEBUG=;`. pre-commit : `export PATH="$HOME/.local/bin:$PATH"`.
- pre-commit refuse de tourner si `.pre-commit-config.yaml` a des modifs non indexées : `git stash push --keep-index -- <fichiers>`.
- Sous Windows, relire `git status` après un `git add` global : collision de casse possible (LESSON-2026-014).
- Ne jamais écrire de Markdown via `echo`/`>>` PowerShell (LESSON-2026-013).
- Trivy peut virer au rouge sans changement de code (nouvelle CVE dans une image de base).
- La CI ne tourne que sur les PR vers `main`/`develop` : une PR empilée n'a aucun check avant reciblage.
- Identité git : AKAA Jennifer. Aucune mention d'IA dans commits/PR.
- Fichier non suivi `gestion-projet/walkthrough/[Gemini] Etat de sante du projet - 2026-10-29.md` : pas à nous, ne pas commiter.
