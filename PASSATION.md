# PASSATION — GED237

## Objectif en cours
Lot B de `AUDIT.md` : items 7 et 8 fusionnés dans `main` (PR #4 et #5, CI verte, `8f66542`). Prochaine étape : item 6 (tests API) puis `.gitattributes`.

## Fait (2026-10-29) — branche `chore/lint-blocking`, PR #4
- Baseline 96 erreurs ruff / 43 fichiers non formatés / 5 bandit LOW → 0 / 0 / 0.
- a8c42f2 : correctifs lint ; E712 en `.is_(True/False)` (`notifications.py`, `workflows.py`) ;
  `except: pass/continue` → `logger.warning` (`classification_reviews.py`, `imports.py`) ;
  `backend/ruff.toml` (E402 seulement pour `tests/conftest.py`, `scripts/*.py`) ; `# noqa: F401` sur `import app.models` (`alembic/env.py`).
- 2a30afa : `ruff format` isolé, listé dans `.git-blame-ignore-revs` (8490dd6).
- CI : job `Lint (ruff)` dans `.github/workflows/backend.yml` ; bandit de `security.yml` bloque sur tout constat (même config que le hook) ;
  versions ruff/bandit lues dans `backend/requirements.txt`.
- f99b33e : `check-json` exclut `tsconfig*.json` (JSONC) → `pre-commit run --all-files` vert.
- 6983cf7 : `RUN apk upgrade --no-cache` dans l'étape `production` de `frontend/Dockerfile` (CVE brotli-libs, Trivy rouge).
- Doc : LESSON-2026-010 et 011, LESSON-2026-008 en `prevention-added` ; walkthrough `walkthrough/[Claude] Lot B8 - Lint bloquant - 2026-10-29.md`.
- Suite backend Docker : 155 passed, couverture 70,15 %.

## Décisions prises
- Pas de `--unsafe-fixes` ruff : E712 automatique (`is True`) casserait les filtres SQLAlchemy.
- Bandit CI aligné sur le hook (tout constat bloque) : une seule source de vérité, `.bandit.yml` ; exception uniquement via `# nosec BXXX - raison`.
- `backend/fix.py` (script ponctuel, chemin `e:\` codé en dur) laissé en place : hors périmètre.
- Merge commits : le SHA de `.git-blame-ignore-revs` reste valide après fusion.

## Fait (2026-10-29, suite) — branche `feat/schema-head-check`, PR #5 (base `chore/lint-blocking`)
- 3a11cb3 : `app/core/schema_check.py` + `SCHEMA_CHECK_MODE` ; 12 tests ; preuve : boot refusé sur base vierge, OK après upgrade.
- 656fe6b : limites mem/CPU/logs dans `docker-compose.yml` et `test-in-docker.sh`.
- 623e269 : `frontend/.dockerignore` (node_modules, .auth, .env.local entraient dans l'image).
- 42a279a : compose sans `version`, `restart: unless-stopped`, healthcheck API. 52b40f7 : `.github/dependabot.yml`.
- Suite Docker complète : 167 passed, couverture 70,34 %.

## Reste à faire
1. `.gitattributes` en commit isolé (LESSON-2026-003).
2. Lot B item 6 : tests API reports, users, org_units, usage ; marge de couverture faible (70,34 %) → piste
   `[tool.coverage.run] concurrency = ["greenlet", "thread"]` (aucun `pyproject.toml` backend : à créer ou `.coveragerc`).
3. Retirer le `define` GEMINI_API_KEY inutilisé de `frontend/vite.config.ts` (clé injectée dans le bundle si renseignée).
4. Lancer une fois `release-integrity.yml` à la main (`workflow_dispatch`) pour valider SBOM + manifeste ; supprimer les branches distantes fusionnées si le PO le souhaite.
5. `docker prune` : le PO a dit non, ne pas le proposer.

## Pièges / contexte
- **Tout s'exécute dans Docker**, jamais sur l'hôte. Tests : `bash backend/scripts/test-in-docker.sh` (≈ 13 min, gate 70 %).
- Lint rapide : `git archive HEAD backend | docker run --rm -i python:3.12-slim …` + `pip install ruff==0.6.9 bandit==1.8.3`.
- `gh` : préfixer `export GODEBUG=;`. pre-commit : `export PATH="$HOME/.local/bin:$PATH"`.
- Commits : plus de `SKIP` nécessaire, tous les hooks passent.
- Avertissements « LF will be replaced by CRLF » : bénins (autocrlf), réglés par le futur `.gitattributes`.
- Trivy peut virer au rouge sans changement de code (nouvelle CVE dans une image de base).
- Identité git : AKAA Jennifer. Aucune mention d'IA dans commits/PR.
