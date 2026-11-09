# Passation — session dev-backend (GED237)

## 2026-11-09 17:56 — dev-backend : PR sécurité dépendances Python + Lot C filtres serveur

**Objectif en cours** — Livrer deux PR vers main sans fusionner : (1) fix/deps-security, (2) feat/spaces-server-filters (Lot C, AUDIT.md items 9-10) ; envoyer les numéros à orchestrateur-ged.
**Fait**
- Guide de rôle produit : gestion-projet/dev-backend/GUIDE_BACKEND_BD.md (checklist avant PR + 7 sections sourcées).
- Worktree ../GED237-secu (fix/deps-security) : backend/requirements.txt → fastapi 0.117.1, starlette 0.48.0 (épinglé), python-multipart 0.0.33, python-dotenv 1.2.2, pypdf 7.0.0 ; imports adaptés dans app/services/ocr/strategy.py:8,116 et app/workers/tasks.py:90. pip-audit (conteneur) 73 → 54 avis. Walkthrough gestion-projet/walkthrough/[Claude] PR securite dependances - 2026-11-09.md (EN COURS). Suite Docker lancée (non commité).
- Worktree ../GED237-lotc-backend (feat/spaces-server-filters) : WorkspaceDocumentFilters + X-Total-Count dans app/api/v1/endpoints/documents.py (list_workspace_documents), relais dans spaces.py, expose_headers CORS dans app/main.py ; tests backend/tests/api/test_spaces_filters.py (7 tests) ; ruff + py_compile OK ; walkthrough Lot C (EN COURS). Rien commité, suite Docker pas encore lancée.
**Décisions**
- Contrat Lot C figé avec ged-dev-frontend : domain_id, activity_id, year (1900-2100), status, classification_status, q (≤120, ILIKE échappé sur titre/tags/domaine/activité/catégorie), limit optionnel 1..200 (absent = tout, non cassant), offset ≥ 0 ; corps = tableau inchangé ; total dans X-Total-Count ; tri created_at desc, id ; pas de sort.
- fastapi 0.117 : aucune mineure n'impose starlette ≥ 0.47.2 ; 0.117 est la première qui l'admet sans exiger pydantic ≥ 2.7 (2.6.1 conservé). starlette 1.x (12 avis restants) hors périmètre PO.
- « ged237-b7 » n'existe pas : b7 = session FleetMaster. Coordination suites Docker avec ged-ci-qa et ged-dev-frontend (pile e2e ≈3,6 Go sur VM 4 Go).
**Reste à faire**
1. Lire le résultat de la suite secu (tâche de fond) ; si vert : commit (identité AKAA Jennifer, sans mention d'IA), walkthrough → EN REVUE, PR vers main avec modèle du dépôt (section RAIDER review), numéro → orchestrateur-ged.
2. Lancer la suite Docker dans ../GED237-lotc-backend (pas en parallèle), corriger, commit, PR, numéro → orchestrateur-ged et ged-dev-frontend ; prévenir ged-ci-qa « suite terminée ».
3. Compléter « Preuves » des deux walkthroughs ; proposer LESSON si incident.
**Pièges / contexte**
- Docker only ; gh : export GODEBUG=; ; pre-commit : export PATH="$HOME/.local/bin:$PATH".
- Python hôte (3.14) : passer les chemins via cygpath -w ; heredoc bash avec quotes triples échoue → script dans le scratchpad.
- ruff en conteneur monté :ro → --no-cache et PYTHONPYCACHEPREFIX.
- Fichier non suivi « [Gemini] Etat de sante… » : pas à nous.

## 2026-11-09 17:56 — dev-backend : ajout de périmètre par l'orchestrateur (DEC-2026-002)

**Objectif en cours** — inchangé ; file d'attente après les deux PR en cours, avant la partie UI du Lot C9.
**Reste à faire (ajouté, dans cet ordre)**
4. PR « recherche bornée » : core/search/postgres_engine.py:79-101 + api/v1/endpoints/search.py → résultats limités au service (org unit) de l'utilisateur, corbeille (deleted_at) exclue ; tests : autre service, document en corbeille, autre tenant.
5. PR « MAX_UPLOAD_SIZE » : core/config.py:46 appliqué par l'API d'upload → 413 + test.
6. Doublon de routes `simulate` (règles) signalé par l'innovateur : vérifier ; supprimer la route morte + test si trivial, sinon le noter dans la PR.
**Pièges / contexte** — une PR par correctif, petites, tests Docker ; écritures git uniquement dans ../GED237-secu et ../GED237-lotc-backend (créer un worktree par correctif) ; aucune fusion sans accord PO ; numéros de PR → orchestrateur-ged.

## 2026-11-09 17:58 — dev-backend : file complétée (orchestrateur + innovateur)

**Reste à faire (ajouté)**
7. Mardi 11/11, même journée que la recherche bornée : migration Alembic normalisant les codes de rôle en minuscules (défaut « Vérifié » dans alembic/versions/001_initial_schema.py:67-72 ; l'app attend des minuscules ; base issue d'`alembic upgrade head` seul = aucun compte utilisable). ~0,25 j, PR séparée. Test Docker : `alembic upgrade head` sur base vierge puis login du compte seed. Ajouter LESSON-2026-020 (un seed qui masque une migration fausse) dans DOCS/engineering/lessons-learned.md.
8. Dans la PR recherche bornée : vérifier et noter que DEBUG est faux dans la configuration de démo (slowapi 5/min sur auth.py:35/71, 1000/min si DEBUG). Verrou après 3 OTP erronés : pas maintenant, candidat vendredi 21/11.

## 2026-11-09 18:04 — dev-backend : D3 journal d'audit ajouté (mer 12/11)

**Reste à faire (ajouté)**
9. Mercredi 12/11, même PR que le plafond upload 413 : D3 — trois entrées AuditLog manquantes (connexion réussie, dépôt de document, import de dossier) dans les endpoints existants, modèle actuel, sans migration, aucune part frontend (/audit lit déjà la table). ~0,5 j. Test Docker : un login + un upload + un ingest → trois lignes visibles par le rôle auditeur.
- Verrou OTP après 3 échecs : abandonné (V1.1), ne pas coder — corrige l'entrée précédente.
- Ordre confirmé : PR deps → Lot C9 → mar 11 recherche bornée + migration rôles → mer 12 upload 413 + D3.

## 2026-11-09 18:12 — dev-backend : PR #37 sécurité ouverte

**Fait** — Suite Docker fix/deps-security : 227 passed, 85,10 %. Commit + push, PR #37 (https://github.com/EagleFox31/GED237/pull/37) ouverte avec modèle RAIDER, orchestrateur prévenu. Walkthrough secu → EN REVUE. Suite Docker Lot C lancée en fond dans ../GED237-lotc-backend.
**Reste à faire** — la liste précédente moins l'item 1 ; prochaine action : lire le verdict de la suite Lot C, commit (3 fichiers app + test + walkthrough), PR, numéros → orchestrateur-ged et ged-dev-frontend, « suite terminée » → ged-ci-qa et ged-dev-frontend.

## 2026-11-09 18:14 — dev-backend : exception pip-audit starlette (pour la PR de mardi 11)

**Reste à faire (ajouté à l'item 4, PR recherche bornée)** — ajouter une exception pip-audit datée (ignore-vuln) sur les 12 avis starlette 0.48.0 restants, expiration 2026-12-15, commentaire renvoyant à « Avis pip-audit restants » de gestion-projet/innovateur/contexte-application.md ; montée starlette 1.x reportée en V1.1 (après le 30/11). Tout avis pré-authentification apparu d'ici le 30/11 repasse en priorité 1. Ne rien ajouter à #37.
**Contexte** — #37 rebranchée sur main par l'orchestrateur (fusion à sa CI verte) ; prochaines branches à partir de origin/main 621e3d7 ; rebaser feat/spaces-server-filters avant la PR.

## 2026-11-09 18:34 — Lot C livré : PR #38 ouverte

**Objectif en cours** — filtres serveur sur `GET /api/v1/spaces/documents` (Lot C, AUDIT.md item 9).
**Fait** —
- Suite Docker complète verte : 243 passed (227 + 16), couverture 85,17 %, 18 min 33.
- Walkthrough `gestion-projet/walkthrough/[Claude] Lot C filtres serveur - 2026-11-09.md` → statut EN REVUE, section Preuves remplie.
- Commit `9d0f94e` (après rebase sur origin/main 8c90260) dans le worktree `../GED237-lotc-backend`, branche `feat/spaces-server-filters`, poussée.
- PR #38 ouverte vers main avec le modèle du dépôt (Résumé, Validation, RAIDER review). Non fusionnée.
- Numéro envoyé à orchestrateur-ged et ged-dev-frontend ; « suite terminée » envoyé à ged-ci-qa et ged-dev-frontend.
**Décisions** — `limit` optionnel (absent = liste complète) pour ne pas casser le frontend actuel ; total dans `X-Total-Count` plutôt qu'une enveloppe JSON (corps inchangé).
**Reste à faire** —
1. Mardi 11/11 : nouveau worktree depuis origin/main → PR recherche bornée (`core/search/postgres_engine.py:79-101`, `api/v1/endpoints/search.py` : service de l'utilisateur, corbeille exclue ; tests autre service / corbeille / autre tenant) + exception pip-audit datée starlette (expire 2026-12-15, renvoi « Avis pip-audit restants » dans `gestion-projet/innovateur/contexte-application.md`) + vérifier DEBUG=false en démo (slowapi auth.py:35/71).
2. Mardi : PR séparée migration Alembic rôles en minuscules (`001_initial_schema.py:67-72`) + LESSON-2026-020 ; test Docker : `alembic upgrade head` sur base vierge puis login du compte seed.
3. Mercredi 12/11 : PR upload 413 (`MAX_UPLOAD_SIZE`, `core/config.py:46`) + D3 trois AuditLog manquants (connexion, dépôt, import dossier) ; test login + upload + ingest → 3 lignes côté auditeur.
4. Vérifier doublon de route `simulate` (règles).
5. Suivre la revue de #38 (corrections éventuelles). OTP lock : abandonné V1.1, ne pas coder.
**Pièges / contexte** — pre-commit ruff-format reformate au commit : refaire `git add -u` puis recommit. Aucune écriture git dans GED237/ (checkout partagé) : worktrees uniquement. `gh` : `export GODEBUG=;`. Une seule suite Docker backend à la fois (coordination ged-ci-qa / ged-dev-frontend).

## 2026-11-09 18:45 — #38 fusionnée, nettoyage

**Objectif en cours** — attente du créneau mardi 11/11 (recherche bornée).
**Fait** — #38 fusionnée par l'orchestrateur (main = c7fc5bd) ; worktrees `../GED237-lotc-backend` et `../GED237-secu` supprimés, branches locales purgées.
**Reste à faire** — corrige l'entrée précédente : ajouter en tête de la prochaine PR le passage du walkthrough Lot C en `Statut : DONE`. Le reste de la liste est inchangé.
**Pièges / contexte** — prochaine branche : `git worktree add ../GED237-<sujet> -b <branche> origin/main` après `git fetch`.

## 2026-11-09 18:53 — Recherche bornée en cours (worktree ../GED237-search)

**Objectif en cours** — PR `fix/search-scoped` : recherche limitée au tenant + périmètre de rôle, corbeille exclue (DEC-2026-002 ordre 2), démarrée en avance sur accord orchestrateur.
**Fait** — code (interfaces, postgres_engine, endpoint search), 5 tests `backend/tests/api/test_search_scope.py` (7 passed en ciblé), `backend/pip-audit-ignore.txt` + lecture dans `.github/workflows/security.yml`, walkthrough Lot C → DONE, nouveau walkthrough `[Claude] Recherche bornee tenant service corbeille - 2026-11-09.md` (EN COURS). Rien committé.
**Décisions** — bug latent corrigé au passage : `doc.category` inexistant plantait la recherche dès le 1er résultat (code catégorie via jointure). DEBUG=true dans `docker-compose.yml` → rate-limit 1000/min : noté dans le walkthrough, non modifié.
**Reste à faire** —
1. `docker ps` : attendre la fin de la pile `edossier-e2e-*` (ci-qa) puis suite complète `bash backend/scripts/test-in-docker.sh` ; compléter Preuves, statut EN REVUE.
2. Commit (AKAA Jennifer), push, `gh pr create` (modèle + RAIDER review), numéro à orchestrateur-ged.
3. Mardi : PR migration rôles minuscules + **LESSON-2026-021** (renuméroté : ci-qa a pris la 020 dans #39) à ajouter en fin de `DOCS/engineering/lessons-learned.md`, après la 020.
4. Mercredi : upload 413 + journal D3. Puis doublon route `simulate`.
**Pièges / contexte** — conteneurs `gedtest-pg`/`gedtest-redis` persistent entre runs (réutilisés par le script). Lint en conteneur : `MSYS_NO_PATHCONV=1`, ruff récent signale du préexistant (repo épinglé v0.6.9 via pre-commit) → se fier à pre-commit.

## 2026-11-09 18:55 — LESSON-2026-022 ajoutée, inventaire DEBUG pour la PR suivante

**Objectif en cours** — suite complète en cours (tâche fond) pour `fix/search-scoped` ; ensuite commit/PR.
**Fait** — `DOCS/engineering/lessons-learned.md` : LESSON-2026-022 (tests de recherche sans résultat = vert trompeur) ajoutée en fin de fichier ; walkthrough recherche mis à jour (ligne LESSON, DEBUG → PR séparée acceptée par PO via DEC-2026-002).
**Décisions (orchestrateur)** — DEBUG=false en PR séparée juste après celle-ci (`docker-compose.yml:110` → "false", `core/config.py:15` défaut False). Leçon rôles majuscules = LESSON-2026-021 (mardi).
**Reste à faire** —
1. Fin de suite → Preuves + EN REVUE, commit, push, PR, numéro à orchestrateur-ged ; « suite terminée » à ged-ci-qa.
2. PR DEBUG : ce que DEBUG pilote = slowapi (`auth.py:35/71/98` : 1000/min si DEBUG, sinon 5/5/10 par minute) et `database.py:9` (`echo=settings.DEBUG`, SQL en clair dans les logs). Rien sur /docs ni CORS (à confirmer par le grep main.py ci-dessus). À faire : limites réglables par env (`AUTH_RATE_LIMIT_LOGIN`, `_OTP`, `_REFRESH` ou similaire, défauts 5/5/10 par minute) au lieu du test sur DEBUG ; conftest fixe explicitement des limites hautes (plusieurs tests enchaînent des logins) ; walkthrough avec cet inventaire.
3. Mardi : migration rôles minuscules + LESSON-2026-021. Mercredi : upload 413 + D3.

## 2026-11-09 18:57 — Spéc complétée pour la PR DEBUG=false (orchestrateur)

**Objectif en cours** — inchangé : suite complète `fix/search-scoped` en cours, puis PR.
**Spéc PR DEBUG (≈ 0,25 j, après recherche bornée)** —
- `docker-compose.yml:110` DEBUG → "false" ; `core/config.py:15` défaut `False`.
- Variables d'env `AUTH_LOGIN_RATE_LIMIT` et `AUTH_OTP_RATE_LIMIT` (défaut `5/minute` inchangé) remplaçant le test sur DEBUG dans `auth.py:35/71` (ligne 98 : garder 10/minute, même mécanisme) ; `30/minute` dans le compose de démo. Pour `docker-compose.e2e.yml` (fichier de ci-qa, PR #39) : lui proposer la variable par message, il l'ajoute lui-même.
- Justification innovateur : `parcours-demo.md` §0 — 9 connexions / 10 OTP en 13 min, pic 4 OTP en 60 s ; le 429 compte comme tentative.
- Clé slowapi derrière nginx : `get_remote_address` = IP de nginx → compteur partagé par toute la salle. Drapeau `TRUSTED_PROXY` (défaut false) : si vrai, clé = premier `X-Forwarded-For` ; sinon `request.client.host` et l'en-tête est ignoré. Tests : sans proxy, proxy de confiance, en-tête forgé sans drapeau (3 tests).
- Conftest : fixer explicitement des limites hautes (tests enchaînant des logins).
- Documenter les 3 variables dans le walkthrough et `gestion-projet/dev-backend/GUIDE_BACKEND_BD.md`.
