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

## 2026-11-09 19:03 — Décisions PO du soir (via orchestrateur)

- Démo sur place en Docker, pas de VPS : OCR-1 en V1.1, aucune tâche Caddy/VPS avant le gel.
- B6 (assignable-roles sans RBAC, users:update_own, clé snapshot) → V1.1 : ne pas y toucher avant le 30/11.
- Fusionnées : #40 docs (36ea190), #41 D5. Toute nouvelle branche part d'origin/main à jour (fetch avant worktree).
- File inchangée : recherche bornée (suite en cours) → DEBUG=false + AUTH_*_RATE_LIMIT + clé proxy → mardi migration rôles + LESSON-021 → mercredi upload 413 + D3 → **lundi 17/11 : sauvegarde** selon `gestion-projet/innovateur/sauvegarde-restauration.md` (Adopt offen/docker-volume-backup v2.50.1 + restore.sh, doc sur main).

## 2026-11-09 19:04 — Précision PR DEBUG : DEBUG ne pilote plus le rate-limit

- Supprimer la branche `"1000/minute" if settings.DEBUG else ...` dans `auth.py:35/71/98` : `AUTH_LOGIN_RATE_LIMIT` / `AUTH_OTP_RATE_LIMIT` (défaut `5/minute`) deviennent la seule source ; ligne 98 (refresh/autre, 10/minute) → même mécanisme avec sa propre variable ou valeur fixe, à trancher dans la PR.
- DEBUG défaut False ; DEBUG ne touche plus qu'à `echo` SQL (`database.py:9`).
- Test obligatoire : avec DEBUG=True, la limite configurée s'applique quand même (ex. limite 2/minute → 3e appel = 429).
- Pile e2e de ci-qa : déjà à 30/minute via ces variables (il ajoute la variable dans son compose, moi je ne touche pas son fichier).
- Rappel : la suite backend enchaîne des logins → conftest doit fixer des limites hautes explicitement (env ou override settings).

## 2026-11-09 19:08 — PR #42 recherche bornée ouverte

**Fait** — suite 248 passed / 85,30 % ; commit `9a34f99` rebasé sur a4b8dbe (#41) ; PR #42 ouverte (non fusionnée) ; numéro envoyé à orchestrateur-ged ; « suite terminée » à ged-ci-qa. Worktree `../GED237-search` à supprimer après fusion.
**Reste à faire** — 1. PR DEBUG (spéc dans les entrées précédentes) : nouveau worktree `../GED237-debug` depuis origin/main. 2. Mardi migration rôles + LESSON-021. 3. Mercredi upload 413 + D3. 4. Lundi 17 sauvegarde.
**Pièges** — actionlint (pre-commit) refuse `$VAR` non quoté dans les workflows : utiliser un tableau bash (`mapfile` + `"${A[@]}"`).

## 2026-11-09 19:28 — PR DEBUG / limites auth en cours (worktree ../GED237-debug)

**Objectif en cours** — Livrer la PR `fix/debug-off-rate-limits` : DEBUG ne pilote plus la sécurité, limites auth configurables, clé IP fiable.
**Fait** —
- `core/config.py` : DEBUG=False par défaut ; AUTH_LOGIN/OTP_RATE_LIMIT (5/minute), AUTH_REFRESH_RATE_LIMIT (10/minute), TRUSTED_PROXY=False.
- `core/rate_limit.py` : `client_ip()` (X-Forwarded-For seulement si TRUSTED_PROXY), limiteur partagé ; `auth.py` utilise ce limiteur avec `@limiter.limit(lambda: settings.AUTH_*)`, branche 1000/min supprimée.
- `docker-compose.yml` : DEBUG false, 30/minute login/OTP, TRUSTED_PROXY true (nginx seul port publié) ; `.env.example` documenté ; conftest fixe 1000/minute explicitement.
- Tests `tests/api/test_auth_rate_limit.py` (8) ; ciblés en Docker : 76 passed. Walkthrough « [Claude] DEBUG off et rate-limit auth configurable - 2026-11-09.md » ; GUIDE §7.5.
- #42 : contrôle d'expiration pip-audit livré (37b5914) ; CI rouge = panne GitHub Actions (orchestrateur relance), ne rien ajouter pour les alias GHSA sans son signal.
**Reste à faire** —
1. Lire le résultat de la suite complète (log `%TEMP%/claude/full_debug_suite.log`), reporter dans le walkthrough, commit (AKAA Jennifer, pre-commit), push, PR, numéro à l'orchestrateur.
2. Mardi 11 : migration codes rôles minuscules + LESSON-2026-021. Mercredi 12 : upload 413 — lire d'abord `gestion-projet/innovateur/spec-limite-upload.md` (checkout partagé, non commitée) : plafond dans `save_file_with_checksum`, pré-contrôle Content-Length, 413 FILE_TOO_LARGE, .part + os.replace, test 1 Kio ; middleware ASGI → V1.1 ; nginx body → ci-qa.
**Pièges / contexte** — ne pas dupliquer le mécanisme 30/min de la pile e2e de ci-qa (déjà en place) ; slowapi 0.1.9 accepte un callable sans argument comme limite.

## 2026-11-09 19:36 — Spec PR fix/authz-collaborator (SMK-04/05/10) ; PR DEBUG en attente de suite

**Objectif en cours** — Finir la PR DEBUG (suite Docker complète en cours, log `%TEMP%/claude/full_debug_suite.log`), puis PR `fix/authz-collaborator` (worktree dédié, depuis origin/main).
**Fait** — Diagnostics envoyés à orchestrateur et ci-qa ; arbitrages reçus.
**Spec fix/authz-collaborator (≈0,25 j, référencer SMK-04, SMK-05, SMK-10 de ci-qa)** —
1. SMK-04 : `policy.csv` rôle `standard` → `collaborator` (seed = collaborator, migration 001 = COLLABORATOR à passer en minuscules mardi, dans cet ordre) ; 12 occurrences « standard » dans `tests/api/test_authz.py` ; test upload collaborateur → 201 ; pas d'alias `g`. PR : commande de redémarrage du conteneur backend (policy chargée au démarrage, pas de script de rechargement).
2. SMK-05 : `GET /tenants/{id}` 403 pour reader/manager/unit_admin/auditor (Sidebar.tsx:20 l'appelle pour tous). L'action `tenants read` couvre aussi la liste (`tenants.py:82`) → option code : propre tenant autorisé pour tout utilisateur authentifié, Casbin conservé pour tenant étranger ; dérogation justifiée dans la PR ; tests reader 200 son tenant / 403 autre / liste 403.
3. SMK-10 : `categories read` à collaborator, reader, manager, unit_admin (auditor l'a déjà) ; écritures inchangées ; tests reader 200 GET /categories/, 403 POST.
- `GET /users/` 403 : pages collaborateur/tenant-admin, backend conforme, point dev-frontend.
**Reste à faire** — 1. Résultat suite → walkthrough, commit, push, PR DEBUG, numéro à l'orchestrateur. 2. fix/authz-collaborator ci-dessus. 3. Mardi migration rôles minuscules + LESSON-021 ; mercredi upload 413 (lire spec-limite-upload.md).

## 2026-11-09 19:51 — PR #44 corrigée, PR #47 authz ouverte, VM Docker gelée

**Objectif en cours** — Attendre « VM prête » (ci-qa, passage VM 4→12 Go), relancer gedtest-pg/gedtest-redis, rejouer la suite complète sur `../GED237-authz` (#47) et reporter la preuve dans la PR ; #44 a déjà sa suite complète (251 passed) mais a reçu un commit depuis (06a79cd) : rejouer aussi si l'orchestrateur le demande.
**Fait** —
- #44 (fix/debug-off-rate-limits) : revue orchestrateur → `client_ip()` prend le DERNIER élément de X-Forwarded-For (nginx ajoute, n'écrase pas) ; 2 tests ajoutés (10 au total) ; 06a79cd poussé.
- #47 (fix/authz-collaborator, e693808, worktree `../GED237-authz`) : policy.csv `standard`→`collaborator` + `categories read` rôles de lecture ; `tenants.py` lecture de son propre tenant sans Casbin (dérogation justifiée) ; tests renommés (conftest sème `collaborator`) ; `test_authz_smoke_fixes.py` ; LESSON-2026-023 ; walkthrough EN REVUE. Modules touchés : 126 passed.
**Décisions** — Règle de file VM (orchestrateur) : e2e ci-qa exclusif ; pytest jamais pendant un e2e ; `--cov` seulement en CI. Perf pytest planifiée marge S2 : `--durations=20`, puis create_all par session + TRUNCATE, puis xdist 2 workers.
**Reste à faire** — 1. Suite complète #47 après « VM prête », reporter dans PR + walkthrough. 2. Ordre à confirmer par l'orchestrateur : P1 ingest-directory (`INGEST_ALLOWED_ROOTS`, realpath, 403, tests ../ + symlink ; ci-qa mettra /srv/e2e-import) vs migration rôles mardi (LESSON-021, minuscules, après #47) vs upload 413 mercredi (lire `gestion-projet/innovateur/spec-limite-upload.md`). 3. Après fusions : supprimer worktrees `../GED237-search`, `../GED237-debug`, `../GED237-authz`.
**Pièges** — gedtest-pg/gedtest-redis à relancer après le shutdown WSL (le script test-in-docker.sh les recrée s'ils manquent ? vérifier `docker ps -a`).

## 2026-11-09 20:09 — Trois chantiers en parallèle, base de test occupée

**Objectif en cours** — Faire valider #47 (suite complète en cours), puis livrer PR rôles et PR workflow.
**Fait**
- `../GED237-authz` (#47, e693808) : suite complète Docker lancée en arrière-plan (log `$TEMP/claude/full_authz_suite.log`) ; constante `POLICY` inutilisée retirée de `tests/api/test_authz_smoke_fixes.py` (non commité, à commiter avec le résultat de la suite).
- `../GED237-roles` (branche `fix/role-codes-lowercase`, non poussée) : migration `f0a1b2c3d4e5_lowercase_role_codes.py` (repointage users/workflow_template_steps, suppression doublons, renommage, CHECK `code = lower(code)`), 001 en minuscules, `app/core/authz/roles.py` (`ROLE_CODES`), `seed_db.py` assert, `init_db.py` codes minuscules, LESSON-2026-021, walkthrough « Codes de rôle en minuscules - 2026-11-11 ». Script de scénario : `scratchpad/mig_check.sh` (base vierge, no-op, doublons + utilisateur, CHECK).
- `../GED237-workflow` (branche `fix/workflow-pending-validators`, non poussée) : `DocumentSummary.current_version_id` (schemas/workflow.py) renseigné dans `GET /workflows/pending` ; `GET /workflows/validators` (manager + tenant_admin actifs du tenant, id + full_name, authz `documents create`) ; `tests/api/test_workflow_validators.py` (4 tests). Pre-commit passé, pas encore exécuté en Docker.
**Décisions** — Orchestrateur : ordre de fusion #43 (faite) → #44, #42, #46 → #47 (après suite + CI, puis `gh pr update-branch 47` et conflit lessons-learned) ; PR rôles avant PR workflow ; mercredi upload 413 puis ingest-directory (`INGEST_ALLOWED_ROOTS=/data/ingest`, branche `fix/ingest-allowed-roots`, spec §5). Numéros de leçons : 020 #39, 021 rôles, 022 #42, 023 authz, 024 orchestrateur. Le test `SEEDED_ROLE_CODES` sera branché sur `ROLE_CODES` après fusion des deux branches. ci-qa fera `alembic upgrade head` avant le seed (CHECK posé partout).
**Reste à faire**
1. Fin de la suite #47 : résultat dans walkthrough « Preuves » + commit (AKAA Jennifer) + push + commentaire PR 47 + message orchestrateur.
2. `bash scratchpad/mig_check.sh` dans GED237-roles, consigner dans le walkthrough, tests `tests/api/test_authz*.py`, commit, push, PR, numéro à l'orchestrateur.
3. Tests Docker `tests/api/test_workflow_validators.py tests/api/test_workflows.py` dans GED237-workflow, walkthrough, commit, PR.
4. Après fusions : supprimer worktrees `../GED237-search`, `-debug`, `-authz` et branches locales.
**Pièges / contexte** — Une seule base `test_ged` partagée par `test-in-docker.sh` : pas deux pytest en même temps. `client_as("collaborator")` n'existe que sur #47 ; sur main le rôle par défaut s'appelle encore `standard`, d'où `auth_client` dans les tests workflow. `export MSYS_NO_PATHCONV=1` avant tout docker ; `export GODEBUG=;` avant `gh`.

## 2026-11-09 20:12 — File planifiée après le 413 et ingest (orchestrateur)

**Lundi 17/11 matin, PR `ops/backup-restore` (≈0,25 j)** selon `gestion-projet/innovateur/sauvegarde-restauration.md` § 6 :
- `backend/scripts/backup.sh` : `pg_dump -Fc` dans le conteneur postgres + tar du volume `storage_data` via conteneur alpine temporaire ; worker et api arrêtés 1 à 2 min ; Redis ignoré volontairement.
- `backend/scripts/restore.sh` : vérifie `SHA256SUMS`, exige `--wipe`, `pg_restore --clean --if-exists --no-owner`, compare au `MANIFEST.txt`, code retour ≠ 0 si écart, second passage = zéro écart.
- Destination hôte `backups/ged237-AAAAMMJJ-HHMMSS/` (gitignore) : `edossier.dump`, `storage.tar.gz`, `MANIFEST.txt` (alembic_version, nombre de documents, nombre de fichiers), `SHA256SUMS`. Doc `DOCS/exploitation/sauvegarde.md`.
- ci-qa rejoue la restauration le 18 (pile e2e) et le 20 (poste de secours). Glissement : prévenir l'orchestrateur le 14 au plus tard, sinon ci-qa écrit les scripts.

## 2026-11-09 20:16 — Contrat P8 transmis au frontend

Contrat de `GET /workflows/validators` (ValidatorRead : `id`, `full_name`) et de `current_version_id` (nullable, dans `task.document` de `GET /workflows/pending`) envoyé à ged-dev-frontend, qui code `fix/validation-cycle-ui` dessus : ne plus changer ces noms sans le prévenir. Suite #47 toujours en cours.
