# Passation — session ged-ci-qa (CI / QA)

Fichier en ajout seulement : chaque session ajoute une entrée datée à la fin, sans réécrire les précédentes.

## 2026-11-09 18:54 — PR 1 smoke e2e (#39), premier run local

**Rôle** : plan QA CI validé par l'utilisateur, en 4 étapes. (1) Smoke E2E Playwright + axe en CI. (2) Contrat API (oasdiff + Schemathesis) et aller-retour des migrations Alembic. (3) Vitest + diff-cover ≥ 80 %. (4) Jobs nocturnes : E2E complet, mutmut, k6, ZAP, quarantaine des tests instables, plafond ESLint, marqueur `tenant_isolation`.

**Où travailler** : worktree `C:\Users\lawry\Documents\Projets\GED237-e2e`, branche `ci/e2e-smoke`. Aucune écriture git dans le checkout partagé `GED237/` (LESSON-2026-019).

**PR 1, #39 (brouillon)** : https://github.com/EagleFox31/GED237/pull/39
- Rebasée sur `c7fc5bd`. Contenu : `docker-compose.e2e.yml`, projet Playwright `smoke` (auth, security-isolation, documents, full-cycle, a11y), `a11y.spec.ts` (axe-core), gate d'impact `e2e`, job `e2e` dans `ci.yml`.
- Le job e2e n'est pas bloquant dans `CI Gate` avant le 21/11 (DEC-2026-002).
- La PR contient aussi LESSON-2026-020 (conteneurs compose orphelins). L'orchestrateur renumérote la leçon de dev-backend en 021.
- Données : `seed_db.py` puis `alembic stamp head`. Le défaut des rôles en majuscules dans la migration 001 est confié à dev-backend.

**Premier run local du smoke** : 4 tests passent (auth : formulaire, champs vides, démo Super Admin, routes protégées). Presque tous les autres échouent.
- Cause : le seed nomme le tenant « Ministere des Finances » sans accent, alors que les fixtures et les `DEMO_CREDENTIALS` de `LoginPage.tsx` l'écrivent « Ministère… ». `selectOption({label})` expire.
- Correctifs locaux, pas encore commités : `e2e/pages/login.page.ts` choisit l'institution par son code entre parenthèses (MINFI), et le libellé démo `Admin Tenant` devient `Admin Institution` (auth.spec:150, auth.fixture:9).
- Défaut produit transmis à dev-frontend : les boutons démo MINFI ne sélectionnent aucune institution avec ces données.
- Défaut a11y réel détecté sur la page de connexion : `color-contrast` (serious, 8 nœuds) et `select-name` (critical, le select #institution n'a pas de nom accessible). À transmettre à dev-frontend avec le résultat du second run.

**VM Docker (4 Go, partagée)** : ordre convenu dev-backend (suite lancée à 18:53) → second smoke de ci-qa → UAT dev-frontend. Après chaque `compose up` interrompu, faire `down -v --remove-orphans`, puis vérifier avec `docker ps`.

**Prochaines étapes**
1. À la réception de « suite terminée » de dev-backend : commiter les correctifs, relancer `docker compose -f docker-compose.e2e.yml up --abort-on-container-exit --exit-code-from e2e` depuis le worktree (log dans le scratchpad), puis `down -v`.
2. Signaler la fin à dev-frontend. Résultat dans #39, passage en ready for review, message à l'orchestrateur.
3. Reconstruire `edossier-e2e-api:latest` sur main après l'UAT de dev-frontend : engagement pris auprès de lui.
4. PR 2 `ci/e2e-seed` : `scripts/e2e-reset.sh`, `backend/scripts/seed_e2e.py`, `frontend/e2e/data/seed-manifest.json` (à pousser en premier pour dev-frontend), corpus demo-import, 400 documents E2E-VOL, workflow E2E-WF-VALID pour P8.
5. OCR-0 (échéance 14/11) : benchmark Tesseract / RapidOCR / EasyOCR, voir `gestion-projet/innovateur/sources/ocr-leger.md`.

Pièges : hook pre-commit cassé sur l'hôte (venv `E:\GED237` absent). Les contrôles se rejouent dans Docker, puis `--no-verify`. Ne jamais lancer `python` sur l'hôte (il bloque sur stdin). Sous Git Bash : `MSYS_NO_PATHCONV=1`.

## 2026-11-09 19:00 — #39 : correctifs poussés, séquence de fusion

- #39 en est à `819abd7`.
  - `789ede6` : connexion choisie par le code tenant, libellé démo « Admin Institution ».
  - `819abd7` : contrôle CI image Playwright = lock, `AUTH_LOGIN_RATE_LIMIT` et `AUTH_OTP_RATE_LIMIT` à 30/minute dans l'api e2e.
- CI GitHub de #39 en cours (jobs lint et sécurité verts, E2E en attente).
- Séquence validée par l'orchestrateur :
  1. Second smoke local.
  2. #39 en ready for review, message à l'orchestrateur, accord PO.
  3. Ensuite #35 (Dependabot, Playwright 1.65) : je pousse moi-même `docker-compose.e2e.yml` → `v1.65.0-noble` sur la branche Dependabot quand l'orchestrateur fait signe.
- Cette passation est incluse dans la PR docs #40 de l'orchestrateur. Les entrées suivantes se font toujours en ajout.
- dev-frontend rebase `test/uat-playwright` sur `ci/e2e-smoke` et attend mon signal de fin de smoke pour son run.
- Après l'UAT de dev-frontend : reconstruire `edossier-e2e-api:latest` sur main, puis prévenir dev-frontend.
