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

## 2026-11-09 19:33 — #39 : second smoke, 21 réussis / 10 en échec, tous classés

- Smoke lancé avec `--build` sur main a4b8dbe (#41 inclus) : 21 réussis, 10 en échec, 9,9 min. Log : scratchpad de la session, `e2e-run3.log`. `down -v` fait.
- #39 à `6ddad06` : la spec de l'onglet historique attend désormais la liste des versions ou « Aucun historique disponible ». Le typage n'a pas été vérifié en local (VM prise par l'UAT de dev-frontend) : c'est le job CI « Frontend / Lint & Typecheck » qui fait foi.
- Classement des 10 échecs :
  - Défauts produit, transmis à dev-frontend :
    - a11y : `select-name` critical sur `#institution`, plus `color-contrast` ;
    - modale « Nouveau Document » hors écran à 1280×720 (documents:360 et 415) ;
    - SC-SEC-02 : le lecteur voit « Nouveau Document ».
  - Défauts produit, transmis à dev-backend :
    - `collaborator` n'a aucune règle dans `policy.csv` : upload en 403 (documents:243 et 274) ;
    - « read tenants » refusé au reader.
  - Données, pour la PR 2 : aucune catégorie dans le seed (documents:446).
  - Dérive de spec : full-cycle:25, remplacé par `uat/validation-cycle.spec.ts` de dev-frontend.
- **Bloqué** : le classifieur de permissions a refusé `gh pr edit 39 --body-file` et `gh pr ready 39`. Le corps à jour est dans le scratchpad de la session (`pr1-v2.md`, section « Résultat du smoke local »). L'utilisateur doit l'appliquer ou autoriser l'action. L'orchestrateur est prévenu de ne pas le faire à ma place.
- `spaces.spec.ts` appartient au projet `mocked-chromium`, hors smoke : réponse envoyée à l'orchestrateur.
- CI GitHub perturbée (panne partielle d'Actions) : l'orchestrateur relance, ne rien corriger.
- Suite : #35 (image `v1.65.0-noble`) au signal de l'orchestrateur, puis PR 2 `ci/e2e-seed` (lire d'abord `gestion-projet/innovateur/jeu-donnees-demo.md`), puis OCR-0 avant le 14/11.

## 2026-11-09 19:35 — Identifiants SMK des échecs du smoke #39, causes précisées

| ID | Spec | Classe | Cause | Suite |
|---|---|---|---|---|
| SMK-01 | `a11y.spec.ts:30` SC-A11Y-01 connexion | Défaut produit | `select-name` critical (le select `#institution` n'a pas de nom accessible), `color-contrast` serious (8 nœuds) | dev-frontend |
| SMK-02 | `a11y.spec.ts:35` SC-A11Y-02 tableau de bord | Défaut produit | `color-contrast` serious | dev-frontend |
| SMK-03 | `documents.spec.ts:128` onglets du détail | Dérive de spec | L'onglet historique est livré, la spec attendait « fonctionnalité à venir » | **corrigé ici** (`6ddad06`) |
| SMK-04 | `documents.spec.ts:243` upload par le collaborateur | Défaut produit | `POST /documents/upload` répond 403 : policy.csv nomme ce rôle `standard`, le seed crée `collaborator` (dev-backend : PR fix/authz-collaborator) | dev-backend |
| SMK-05 | `documents.spec.ts:274` soumission au visa par le collaborateur | Défaut produit | Même cause que SMK-04 | dev-backend |
| SMK-06 | `documents.spec.ts:360` modale, Annuler | Défaut produit | À 1280×720, la modale « Nouveau Document » dépasse la fenêtre : Annuler est hors écran (`element is outside of the viewport`) | dev-frontend |
| SMK-07 | `documents.spec.ts:415` modale, titre vide | Défaut produit | Même cause que SMK-06, pour le bouton Envoyer | dev-frontend |
| SMK-08 | `documents.spec.ts:446` upload Admin complet | Données | Aucune catégorie dans le seed : `selectOption` attend sans fin | PR 2 (`ci/e2e-seed`) |
| SMK-09 | `full-cycle.spec.ts:25` cycle complet | Dérive de spec | `sessionStorage` est lu avant toute navigation (`SecurityError`) | Remplacé par `uat/validation-cycle.spec.ts` (dev-frontend) |
| SMK-10 | `security-isolation.spec.ts:33` SC-SEC-02 | Défaut produit | Le lecteur voit « Nouveau Document », et GET /tenants/{id} (Sidebar) et GET /categories/ en 403 pour le reader ; Documents.tsx (Promise.all) perd alors aussi les documents | dev-frontend et dev-backend |

- Corps de PR à jour avec ces identifiants : `pr1-v2.md` dans le scratchpad. Application (`gh pr edit` / `gh pr ready`) en attente de l'autorisation du PO dans cette session ; l'orchestrateur fusionne ensuite.
- VM signalée libre à dev-frontend pour son premier run UAT. Prochaine tâche : PR 2 `ci/e2e-seed` depuis main (seed avec catégories + `scripts/e2e-reset.sh`).

## 2026-11-09 19:36 — Démarrage de la PR 2 `ci/e2e-seed`

- Branche `ci/e2e-seed` créée depuis origin/main a4b8dbe dans le worktree `GED237-e2e`. Aucun commit pour l'instant. #39 reste sur `ci/e2e-smoke` (6ddad06), en attente de l'accord du PO (gh pr edit et gh pr ready).
- Périmètre, d'après `gestion-projet/innovateur/jeu-donnees-demo.md` et `PASSATION-dev-frontend.md` l.38-81 :
  - manifeste `frontend/e2e/data/seed-manifest.json` : codes E2E-DOM, E2E-ACT, E2E-RULE-DEMO (motif `e2edemo-…`), E2E-VOL-001..400, section `expected` ;
  - catégories dans le seed (lève SMK-08) ;
  - circuit E2E-WF-VALID (MINFI002 → visa MGR001 → signature) ;
  - `pendingTasks` E2E-VAL-* ou `[]` ;
  - corpus `frontend/e2e/data/demo-import/` ;
  - `scripts/e2e-reset.sh` idempotent.
  Le jeu de démo (`demo-manifest.json`, codes DEMO-…) sera une deuxième instance du même schéma.
- Réutiliser `seed_db.py` et `test_real_export_v2.py` (sortie via `GED_EXPORT_OUT`) : pas de nouveau générateur.
- dev-backend : PR fix/authz-collaborator en cours. Elle ajoute `categories read` à collaborator, reader, manager et unit_admin, et la lecture du tenant propre pour tous. `GET /users/` reste réservé à l'admin (`DraftWorkspace.tsx:25` : à traiter par dev-frontend).
- Prochaine étape : plan de l'agent architecte (modèles catégories, domaines, activités, règles, workflows), puis implémentation.

## 2026-11-09 19:40 — PR 2 : plan en cours, engagements pris

- Agent architecte lancé en fond pour le plan de la PR 2 `ci/e2e-seed` : modèles catégories, plan de classement, règles, workflows, `pendingTasks`, schéma du manifeste, insertion du volume en base ou via l'API. Implémentation à la réception du plan.
- Engagements envers l'orchestrateur :
  - le montage du corpus `frontend/e2e/data/demo-import/` en lecture seule dans l'api fait partie de la PR 2 (SC-ADM-08 / `/ingest-directory`) ;
  - PR 2 ouverte le 11 au soir, prête à fusionner le 12, date à confirmer le 10 au matin ;
  - en cas de glissement, livrer d'abord la partie qui débloque P8 (catégories, circuit, corbeille/version) et reporter le volume.
- Nœuds color-contrast (connexion : 8, tableau de bord : 13) envoyés à dev-frontend. Extraction faite depuis `playwright-report/index.html` (zip en base64) avec jq dans le conteneur `ghcr.io/jqlang/jq:1.7.1`. Résultat dans le scratchpad, `axe/contrast-nodes.txt`.
- dev-frontend : UAT 3 donne 15 verts, 3 fixme, 0 échec. Il a la VM pour tsc, lint et build de `fix/recette-smoke-1` (SMK-06, SMK-07, SMK-10, select-name) et prévient à la fin.
- #39 attend toujours l'accord du PO pour `gh pr edit` et `gh pr ready` (corps : `pr1-v2.md` dans le scratchpad).

## 2026-11-09 19:40 — PR 2 : découpage et dates validés par l'orchestrateur (pour la matrice de recette)

- **PR 2a, `ci/e2e-seed`, prioritaire, débloque P8** :
  - catégories et plan de classement MINFI (lève SMK-08) ;
  - circuit E2E-WF-VALID (MINFI002 → visa MGR001 → signature) ;
  - documents en corbeille et à versions multiples ;
  - manifeste `frontend/e2e/data/seed-manifest.json` (section `expected`) ;
  - `scripts/e2e-reset.sh` idempotent ;
  - montage lecture seule de `frontend/e2e/data/demo-import/` dans l'api, au chemin autorisé par `/ingest-directory` (SC-ADM-08).
- **PR 2b, en second, seulement si la 2a glisse** : volume E2E-VOL-001..400 et corpus généré par `test_real_export_v2.py` (sortie `GED_EXPORT_OUT`).
- **Dates** : ouverture le 11 au soir, fusion visée le 12, confirmation le 10 au matin après le plan détaillé (agent architecte en cours). Si la PR n'est pas fusionnée le 12, P8 bascule en preuve manuelle (matrice de l'innovateur).

## 2026-11-09 19:49 — PR 2a en cours ; gel de la VM pour le passage à 12 Go

- **Worktree** `GED237-e2e`, branche `ci/e2e-seed` basée sur `origin/ci/e2e-smoke` (6ddad06), rien de commité. Plan détaillé : scratchpad `plan-pr2.md`.
- **Écrit, non commité** :
  - `frontend/e2e/data/seed-manifest.json` (catégories E2E-CAT-GEN/WF, plan E2E-DOM/E2E-ACT, règle E2E-RULE-DEMO, circuit E2E-WF-VALID et aiguillage E2E-ROUTE-VALID, documents E2E-VAL-VISA/REJET/RETOUR, E2E-TRASH, E2E-MULTI-VERSION, section `expected`) et `frontend/e2e/data/seed.ts` (lecture typée) ;
  - `backend/scripts/seed_e2e.py` : upsert par (tenant, code), documents clés `extra_data.e2e_seed`, routage par `_run_routing` ; ruff check et format verts ;
  - `backend/scripts/e2e_reset.sh` (seed_db puis seed_e2e) ;
  - compose : commande via e2e_reset.sh, montages `/e2e-data` et `/srv/e2e-import` (demo-import, `.gitkeep` seul suivi), `E2E_MANIFEST`, start_period 60 s ;
  - `e2e/specs/seed.spec.ts` (API) ; projet Playwright `seed`, dont smoke dépend ; `documents.spec` choisit la catégorie par libellé du manifeste.
- **Constat sécurité à remonter à dev-backend** : `POST /documents/ingest-directory` lit n'importe quel dossier du serveur (aucune racine autorisée), pour tout rôle ayant documents:create.
- **File VM** : je la tiens. Gel demandé à dev-frontend (libre) et dev-backend (en attente de réponse), puis « VM libre » à l'orchestrateur, qui renverra « VM prête ».
- **Ensuite** : lancer `E2E_ARGS=--project=seed`, puis smoke complet, sur ci/e2e-seed ; puis le smoke de dev-frontend sur fix/recette-smoke-1 ; commit, push, PR 2a (ouverture le 11).

## 2026-11-09 20:10 — PR 2a commitée ; #39 corrigée en local ; flux migrations/seed bloqué

- **PR 2a** : commit local `96e1579` sur `ci/e2e-seed` (worktree `GED237-e2e`), non poussé. Seed vert (3/3), idempotence prouvée (0 écriture au 2e passage). Corpus d'ingestion monté en `/data/ingest:ro` (décision orchestrateur) ; `INGEST_ALLOWED_ROOTS=/data/ingest` à ajouter quand dev-backend livre la variable. Ouverture de la PR le 11 au soir.
- **Hook pre-commit cassé** sur cette machine (venv `E:\GED237\...` inexistant) : commits en `--no-verify` après rejeu en conteneur des mêmes contrôles (JSON/YAML, espaces, ruff **0.6.9** = version épinglée, bandit 1.8.3). Ne pas utiliser un ruff récent : il formate autrement.
- **#39 (`ci/e2e-smoke`)**, deux commits locaux :
  - `6e7212d` : `switchUser` de full-cycle ne vide plus le stockage sur about:blank (SecurityError) ; documents:128 n'attend plus le placeholder « à venir » ;
  - `1e17ed1` : `test.fixme` ciblés, à annuler dans les branches combinées. SMK-01/02/06/07/10 → #45 ; SMK-04/05 et full-cycle → #47 ; SMK-08 → #45 et seed.
  - Smoke local en cours (log scratchpad `e2e-smoke39.log`). Pousser s'il est vert ; `gh pr ready` attend toujours l'accord du PO dans cette session.
- **Flux « alembic upgrade head puis seed »** (demandé par l'orchestrateur) : il casse. 001_initial_schema insère les rôles en MAJUSCULES, donc seed_db SKIP et aucun compte n'est créé. J'ai proposé de garder « seed puis stamp » jusqu'à la migration des rôles de dev-backend et un seed_db convergent. Réponse attendue.
- **Leçon** : ne jamais changer de branche dans un worktree pendant qu'un run compose monte `./frontend` ou `./backend` depuis ce dossier (lecture via `git show` à la place). Cette fois, le run avait déjà copié les sources.
- **Ensuite** :
  1. pousser #39 ;
  2. relire **PR #48** (Lot C, dev-frontend) : config Playwright, aucun test smoke perdu sans fixme, IDs SC alignés sur la matrice §4 ; avis en 3 lignes à l'orchestrateur ;
  3. run combiné seed + #45 + #47 sans les fixme (`git revert --no-commit 1e17ed1`), puis SMK et SC-VAL-01 à dev-frontend et à l'orchestrateur.

## 2026-11-09 20:14 — #39 poussée ; #48 relue ; run combiné en cours

- **#39** : poussée en `1e17ed1`. Smoke local : 22 réussis, 9 fixme, 0 échec. `gh pr edit 39 --body-file` (scratchpad `pr1-v2.md`) et `gh pr ready 39` attendent l'accord du PO **dans cette session**.
- **`ci/e2e-seed`** : `origin/ci/e2e-smoke` fusionnée dedans (`e07f701`). Rien n'est poussé ; ouverture de la PR le 11.
- **Avis #48** envoyé, favorable sous condition :
  - SC-VAL-01 doit passer en fixme lié à #47, ou #48 fusionner après #47 ;
  - le conflit modify/delete sur full-cycle se résout en supprimant le fichier ;
  - matrice-recette §4 n'a pas SC-SEC-03a/03b/04a/04b.
- **Run combiné** (branche locale jetable `tmp/smoke-combined` : seed + #45 + #47, fixme annulés) : log scratchpad `e2e-combined.log`. #45 et #47 sont en conflit sur lessons-learned.md (signalé).
- **En attente** : réponse de l'orchestrateur sur le flux migrations/seed (je propose de garder « seed puis stamp » jusqu'à la migration des rôles).
- **Ensuite** :
  1. résultats SMK et SC-VAL-01 à l'orchestrateur et à dev-frontend ;
  2. supprimer `tmp/smoke-combined` ;
  3. revenir sur `ci/e2e-seed`.

## 2026-11-09 20:15 — Décisions de l'orchestrateur

- PR 2a garde « seed puis stamp ». La bascule vers « upgrade head puis seed » se fait **juste après la fusion de la PR de migration des rôles** (dev-backend, seed_db convergent) : une ligne à changer dans `e2e_reset.sh`. L'orchestrateur transmet lui-même à dev-backend.
- Ordre de fusion : #39 → #42 → #47 → #48. Aucun fixme supplémentaire dans #48. dev-frontend supprime full-cycle au rebase, innovateur aligne la §4.

## 2026-11-09 22:59 — #39 à jour avec main, correctifs PR 2a, INGEST_ALLOWED_ROOTS

- **#39** : fusion origin/main poussée (09c2587, conflit lessons-learned résolu 019→020→022), CI 13/13 verte, CLEAN, brouillon. `gh pr edit 39 --body-file scratchpad/pr1-v2.md` et `gh pr ready 39` attendent l'accord de l'utilisateur ou du PO dans cette session, jamais via un pair. Fusion prévue après #47.
- **ci/e2e-seed (PR 2a, non poussée)** : adf9a6d (fichier unique par upload via e2e/data/files.ts, attente stable de l'onglet circuit) ; 2044f39 (INGEST_ALLOWED_ROOTS=/data/ingest dans le compose e2e, exigé par #53 : PR 2a doit fusionner avant #53).
- **Worktrees** : GED237-e2e sur tmp/smoke-combined (seed + #45 + #47, fixme SMK-04 à 08 retirés hors commit), branche jetable. GED237-merge39 sur ci/e2e-seed.
- **Runs** : documents+full-cycle avec fixme → 13 réussis, 6 sautés. Sans fixme → full-cycle 3/3 en échec et SMK-08 instable, tous au page.goto (Vite > 10 s) pendant la suite backend de #53 (npm ci 13 min). Rerun en cours (log scratchpad/e2e-run4.log). Si vert → défaillance d'environnement. Si rouge → mesurer free -m / docker stats et prévenir l'orchestrateur avant toute action.
- **Règle** : une seule charge Docker lourde à la fois ; dev-backend et moi nous prévenons mutuellement.
- **Rapport HTML** à garder pour dev-frontend : GED237-e2e/frontend/e2e-out/playwright-report ; mes runs écrivent dans playwright-report-run2 (override scratchpad/e2e-run2.override.yml).
- **#35** : fusion après le 30/11, pas d'image v1.65 sans signal.
- **File** : PR 2a mer 11 → e2e P8 jeu 12 → OCR-0 ven 13 matin → après #50 : service seed + bascule e2e_reset.sh « upgrade head puis seed » (une PR, reset chronométré).

## 2026-11-09 23:15 — documents + full-cycle verts, PR 2a complète en local

- **Preuve** : branche combinée seed + #45 + #47, fixme retirés, VM calme, `--repeat-each=3 --retries=0` → 9/9 (full-cycle 11 à 14 s, SMK-08 9 à 12 s). Log : scratchpad/e2e-run6.log.
- **Causes** : SMK-08 = charge VM (suite #53 concurrente). full-cycle = budget 30 s trop court (`test.slow()`) + `networkidle` sur la page tasks qui n'aboutissait jamais (retiré ; cause non tracée, WebSocket notifications suspect non prouvé).
- **ci/e2e-seed (local, non poussé, worktree GED237-merge39)** : adf9a6d, 2044f39, 9ba9cc2. Les fixme SMK-04 à 07 restent jusqu'à la fusion de #45/#47.
- **GED237-e2e** : tmp/smoke-combined avec des modifications non commitées (jetable).
- **Verrou Docker** : feu vert donné à dev-backend pour la suite #53 ; aucune campagne e2e avant qu'il signale la fin.
- **En attente** : accord utilisateur/PO pour `gh pr edit 39 --body-file` et `gh pr ready 39`.

## 2026-11-09 23:18 — PR 2a ouverte : #55

- **#55** (brouillon) : base ci/e2e-smoke (empilée sur #39, reciblée sur main à sa fusion), head ci/e2e-seed. Contenu : seed déclaratif + adf9a6d + 2044f39 + 9ba9cc2 + 0e9ca16 (conventions en en-tête de playwright.config.ts, LESSON-2026-025). Corps de PR : scratchpad/pr2a.md.
- **Contraintes** : #55 doit fusionner avant #53 (INGEST_ALLOWED_ROOTS). Retirer les fixme SMK-04 à 07 dans #55 à la fusion de #45/#47.
- **Verrou Docker** : suite complète #53 de dev-backend en cours ; pas de campagne e2e avant son signal.
- **En attente** : accord utilisateur/PO pour `gh pr edit 39 --body-file` et `gh pr ready 39`.
- **Ensuite** : e2e P8 jeu 12 → OCR-0 ven 13 matin → après #50 : service seed + bascule « upgrade head puis seed ».

## 2026-11-09 23:51 — OCR-0 outillé, merge main → #55 en cours

- **OCR-0** : worktree GED237-ocr0, branche ci/ocr-0-bench (depuis origin/main 4e0ddba, non poussée). Fichiers : backend/scripts/bench_ocr_0.py (prepare/run/table), backend/Dockerfile.bench (FROM api, rapidocr 3.10.0, onnxruntime 1.31.1, jiwer 4.0.0, tessdata_best dans /opt/tessdata_best), backend/scripts/bench_ocr_0.sh (1 conteneur plafonné 1g/2 CPU par moteur, --rm). Entrées de la répétition : scratchpad/ocr0/make_seed_pdfs.py (6 PDF du seed). Base : edossier-e2e-api:latest. Lint ruff/bandit relancé (PyPI très lent).
- **Écarts protocole à remonter à l'innovateur** : (1) tessdata_best copié dans le tessdata par défaut transformerait T-fast en T-best → dossier séparé + --tessdata-dir ; (2) RapidOCR ≥ 3.9 : PP-OCRv6 small multilingue (fr inclus) par défaut, lang_type sans effet en v6 → pas de « latin » ; (3) RapidOCR attend du BGR ; (4) le texte du seed (Helvetica sans /Encoding) rend « à » selon StandardEncoding — sans incidence pour une répétition, vérité = pdftotext.
- **Orchestrateur 23:4x** : #49, #45, #39 fusionnées ; #55 reciblée sur main. À faire : merge origin/main dans ci/e2e-seed (sans forcer), retirer fixme SMK-04..07, smoke local vert, pousser, SHA à l'orchestrateur ; lessons attendues 019, 020, 022, 023, 025. #55 après #52, avant #53.
- **Docker** : dev-backend a libéré Docker (267 + 77 passed).

## 2026-11-10 00:19 — #55 poussée, OCR-0 en répétition, prochaine tâche : e2e « upgrade head puis seed »

- **#55** : be18a98 poussée (merge main 3059179 + retrait fixme SMK-04..08). Smoke local --retries=0 : 31 passed, 3 skipped (SMK-01/02/10), 0 échec. Dans la chaîne de fusion de l'orchestrateur (update-branch, CI, merge) puis #53, #54.
- **OCR-0** : ci/ocr-0-bench local 8aea340 (+ correctif runner non commité : here=host_path). Répétition run2 en cours (scratchpad/ocr0/run2.log, work/results/). Livrable à l'orchestrateur : 3 lignes (durée, débit, écarts d'outillage) + tableau en passation + écarts à l'innovateur.
- **Ensuite (orchestrateur)** : #50/#51/#52 sur main. Petite PR depuis worktree neuf sur main : pile e2e en « alembic upgrade head puis seed » (plus de create_all/stamp côté e2e). Preuve : reset e2e + smoke --retries=0 vert. Prévenir dev-backend avant la campagne Docker ; signaler le push à l'orchestrateur (dev-backend retirera create_all côté app).

## 2026-11-10 00:40 — #55 rouge en CI : correctifs prêts, non poussés

- CI #55 (run 42718458561) : (1) TS2614 `FilePayload` non exporté par @playwright/test → type local exporté par frontend/e2e/data/files.ts, importé dans pages/documents.page.ts ; (2) seed_e2e : `targetUnitType: "ministry"` → `MINISTRY` (codes migration 001 en majuscules depuis #50, LESSON-021).
- Worktree GED237-merge39 : pull de 5f5c3ba (update-branch GitHub) fait, correctifs non commités. Reste : typecheck frontend + smoke --retries=0 en conteneur, commit, push, SHA à l'orchestrateur.
- OCR-0 run2 en cours ; dev-backend lance la pile gedver quelques minutes (charge concurrente à noter sur les temps OCR).
- Puis : PR e2e « upgrade head puis seed » (après fusion de #55, e2e_reset.sh n'existe sur main qu'avec elle).
