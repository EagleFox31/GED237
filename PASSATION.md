# PASSATION — GED237

## Objectif en cours
Lot B de `AUDIT.md` : items 7 et 8 fusionnés (PR #4, #5). `.gitattributes` fait sur `chore/gitattributes`
(PR ouverte, à fusionner après CI verte). Prochaine étape : item 6 (tests API).

## Fait (2026-10-29) — branche `chore/gitattributes`
- 2d88228 : `tasks/lessons.md` réparé (git le voyait binaire : double encodage cp1252, bloc UTF-16LE,
  lettres mangées par les échappements PowerShell). Backticks de code perdus non réinventés.
- 65e6080 : `.gitattributes` (`* text=auto eol=lf`, CRLF pour `.bat`/`.cmd`, binaires déclarés).
- 1d95776 : `git add --renormalize .` isolé (77 fichiers), listé dans `.git-blame-ignore-revs`.
- eafff21 : `docs/engineering/*` → `DOCS/engineering/*` (le dépôt suivait les deux casses).
- f1c0546 : `scripts/check-tracked-files.sh` (casse, binaire non déclaré, contrôle/U+FFFD) en hook
  pre-commit + job CI `Tracked files` requis par le `CI Gate`.
- Doc : LESSON-2026-003 en `prevention-added`, LESSON-2026-013 et 014 ; walkthrough
  `walkthrough/[Claude] Lot B - gitattributes et fichiers portables - 2026-10-29.md`.
- `pre-commit run --all-files` vert.

## Décisions prises
- Pas de `--unsafe-fixes` ruff : E712 automatique (`is True`) casserait les filtres SQLAlchemy.
- Bandit CI aligné sur le hook (tout constat bloque) : une seule source de vérité, `.bandit.yml`.
- Un seul script pour hook et CI (`check-tracked-files.sh`) : même modèle qu'actionlint/bandit.
- Working copies non réécrites après renormalisation : le CRLF disque reste accepté, normalisé à l'ajout.
- `backend/fix.py` (script ponctuel, chemin `e:\` codé en dur) laissé en place : hors périmètre.

## Reste à faire
1. Fusionner la PR `chore/gitattributes` une fois la CI verte ; passer le walkthrough en DONE.
2. Lot B item 6 : tests API reports, users, org_units, usage ; marge de couverture faible (70,34 %) → piste
   `[tool.coverage.run] concurrency = ["greenlet", "thread"]` (aucun `pyproject.toml` backend : à créer ou `.coveragerc`).
3. Retirer le `define` GEMINI_API_KEY inutilisé de `frontend/vite.config.ts` (clé injectée dans le bundle si renseignée).
4. Lancer une fois `release-integrity.yml` à la main (`workflow_dispatch`) pour valider SBOM + manifeste ; supprimer les branches distantes fusionnées si le PO le souhaite.
5. `docker prune` : le PO a dit non, ne pas le proposer.

## Pièges / contexte
- **Tout s'exécute dans Docker**, jamais sur l'hôte. Tests : `bash backend/scripts/test-in-docker.sh` (≈ 13 min, gate 70 %).
- Docker Desktop peut s'arrêter seul (« Ressources système insuffisantes ») : `docker desktop restart`.
- Lint rapide : `git archive HEAD backend | docker run --rm -i python:3.12-slim …` + `pip install ruff==0.6.9 bandit==1.8.3`.
- `gh` : préfixer `export GODEBUG=;`. pre-commit : `export PATH="$HOME/.local/bin:$PATH"`.
- pre-commit refuse de tourner si `.pre-commit-config.yaml` a des modifs non indexées : `git stash push --keep-index -- <fichiers>`.
- Sous Windows, relire `git status` après un `git add` global : collision de casse possible (LESSON-2026-014).
- Ne jamais écrire de Markdown via `echo`/`>>` PowerShell (LESSON-2026-013).
- Trivy peut virer au rouge sans changement de code (nouvelle CVE dans une image de base).
- Identité git : AKAA Jennifer. Aucune mention d'IA dans commits/PR.
- Fichier non suivi `gestion-projet/walkthrough/[Gemini] Etat de sante du projet - 2026-10-29.md` : pas à nous, ne pas commiter.
