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

## 2026-11-09 17:10 — Modèle d'équipe d'agents (4 sessions) et base Innovateur

- Créé `gestion-projet/EQUIPE_AGENTS.md` (statut PROPOSÉ) : 4 sessions max (`orchestrateur`,
  `innovateur`, `dev-backend`, `dev-frontend`), PO humain décideur + sous-agent `product-owner`,
  protocole de décision (Innovateur d'abord → DEC → PO si impact produit), communication (messagerie
  inter-sessions, repli fichiers), plan hebdo jusqu'au 30/11 (gel le 24/11).
- Créé `gestion-projet/innovateur/` : README, `contexte-application.md`, `sources/anthropic-agents.md`,
  `sources/github-agents-skills.md` (13 dépôts évalués Adopt/Adapt/Learn/Écarté), `sources/ged-normes.md`.
- Créé `.claude/agents/orchestrateur.md`, `innovateur.md` (mémoire projet, `claude --agent <nom>`),
  `product-owner.md` (sous-agent Sonnet).
- Rien de commité : attendre validation du PO, puis PR `docs/equipe-agents`.
- État dépôt : branche `chore/node-24`, PR #26 verte en attente d'accord PO ; #27 (Node 26) à fermer
  après #26 ; majors Dependabot #29/#30/#32 à instruire par l'innovateur. Messagerie inter-sessions :
  vérifier `/list-agents` (Windows natif ≥ 2.1.234).

## 2026-11-09 17:45 — Orchestrateur : lancement de l'équipe, tri Dependabot exécuté

- Session `orchestrateur-ged` active ; sessions `innovateur`, `ged-dev-backend`, `ged-dev-frontend`,
  `ged-ci-qa` (ex-`ged237-b7`, CI e2e, mission PO). Messagerie inter-sessions fonctionnelle.
- PO a validé le modèle (`EQUIPE_AGENTS.md` → ACCEPTÉ) et DEC-2026-001 : #26 fusionnée (3e05d6c), #27 et
  #31 fermées, #28/#32/#33 à fusionner à CI verte, #29/#30 reportés après le 30/11, PR sécurité ciblée
  (python-multipart, fastapi/starlette, python-dotenv, pypdf) assignée à ged-dev-backend.
- PR #34 (`docs/equipe-agents`) : + `.claude/**` ignoré dans `appfactory-impact.json` (motif `**/*.md` ne
  traverse pas les dossiers à point → repli `all`), DEC-2026-001, walkthrough Node 24 DONE. À fusionner à CI verte.
- Audit fonctionnel profond en cours (sous-agent) → `gestion-projet/walkthrough/[Audit] Audit fonctionnel profond - 2026-11-09.md`.
- Règle apprise : aucune écriture git dans le checkout partagé, worktrees obligatoires (`../GED237-<sujet>`).
  À ajouter dans `EQUIPE_AGENTS.md` §4 et comme LESSON-2026-019.
- Point du jour : `gestion-projet/plans/point-2026-11-09.md`.
- 18:05 — Audit fonctionnel livré (`gestion-projet/walkthrough/[Audit] Audit fonctionnel profond - 2026-11-09.md`,
  non commité) : 17-19 j-p d'écarts pour ~10 j de capacité ; top 1 = recherche sans autorisation par service.
  DEC-2026-002 (périmètre démo) demandée à l'innovateur. #28 fusionnée ; #32/#33/#34 en CI après rebranchage.

## 2026-11-09 17:55 — Orchestrateur : #34 fusionnée, DEC-2026-002 et parcours de démo reçus

- #34 fusionnée (a92e34d) : modèle d'équipe, base innovateur, agents, DEC-2026-001. Branche locale supprimée, checkout partagé sur `main`.
- #33 (spacy) rebranchée, CI en cours ; fusion au vert (accord PO du 17:30). #29/#30 reportées après le 30/11.
- DEC-2026-002 (PROPOSÉ, innovateur) soumise au PO : 6 écarts corrigés pour 9 j-p, 7 écarts annoncés, gel le 24/11.
  Questions PO ouvertes : (a) démo VPS ou on-site, (b) B6 avant le 17/11, (c) liste des écarts annoncés,
  (d) parcours P8 (corbeille/version sans UI) : recommandation = cycle de validation à la place, 0 j-p.
- `gestion-projet/innovateur/parcours-demo.md` : 8 parcours de démo retenus sur 12 ; P4 attend Lot C9, P5 attend l'ordre 1.
  Décisions orchestrateur : ordre d'exécution avec reset de base tenu par ci-qa ; doublon de routes `simulate` vérifié par dev-backend.
- Règle worktrees écrite (`EQUIPE_AGENTS.md` §4, LESSON-2026-019). Ces docs partent en PR `docs/point-2026-11-09` depuis `../GED237-docs`.
- Reprise : fusionner #33 au vert ; relancer le PO sur (a)-(d) ; dispatcher les ordres 1-2 de DEC-002 à dev-backend une fois acceptée.

##  — Orchestrateur : #33 fusionnée, #36 (docs du jour) prête à fusionner

- Dependabot clos pour le 30/11 : #26, #28, #32, #33 fusionnées ; #27, #31 fermées ; #29, #30 reportées. Checkout partagé sur `main` à jour.
- #36 (`docs/point-2026-11-09`, worktree `../GED237-docs`) : CI verte en no-op (gates skippés = preuve impact-aware), contient PASSATION, point, audit, DEC-2026-002, parcours-demo, plan-presentation, EQUIPE_AGENTS §4, LESSON-2026-019. Fusion sur accord PO.
- Amendement DEC-2026-002 confirmé par l innovateur : migration rôles minuscules obligatoire (dev-backend, mar 11, LESSON-2026-020) ; verrou OTP si marge le 21 ; budget 9,75/10 j-p.
- Équipe : dev-backend (PR deps → Lot C9 → recherche bornée + rôles → upload 413), dev-frontend (specs P1 fait, P2/P3/P6/P7 ; D2 regroupé avec garde de routes), ci-qa (PR e2e-smoke puis e2e-seed, passation prévue), innovateur (disponible).
- Verrous : décisions PO (a) VPS/on-site, (b) B6 avant le 17/11, (c) écarts annoncés, (d) P8 → cycle de validation ; aucune fusion sans PO.
- Prochaine étape : relancer le PO sur (a)-(d) ; à l accord, fusionner #36, passer DEC-2026-002 en ACCEPTÉ, puis `git pull` dans le checkout partagé après avoir supprimé les copies locales non suivies (sauf le fichier `[Gemini]`).
- 18:02 — Défauts D3 (journal sans connexion/dépôt/import) et D4 (aucun export du journal) remontés par dev-frontend sur P7 ; en instruction chez l innovateur (corriger vs annoncer, ce qui saute). Question PO (e) à venir. P1 et P7 écrits, D2 regroupé avec la garde de routes.
- 18:03 — Arbitrage innovateur D3/D4 : D3 corrigé (dev-backend, mer 12, avec upload 413, 0,5 j), D4 annoncé V1.1 (écart 8), verrou OTP abandonné et annoncé ; budget 9,75/10 ; sacrifice 6 → 5 (pg_dump manuel) → pagination 4. plan-presentation ajusté. Question PO (e) = valider cet arbitrage.

## 2026-11-09 18:07 — PO : « go ». DEC-2026-002 ACCEPTÉ, #36 en fusion

- Le PO a validé d'un mot l'ensemble soumis : fusion de #36, questions (c) écarts annoncés, (d) P8 → cycle de validation, (e) arbitrage D3/D4/OTP.
- (a) démo VPS ou on-site et (b) B6 restent ouvertes, échéance 17/11 ; hypothèse de travail = démo on-site Docker, à confirmer par le PO.
- Statut et amendements écrits dans le fichier DEC-2026-002 (section « Amendements acceptés »). Équipe informée.
- Après fusion : nettoyer le checkout partagé (copies locales identiques aux fichiers fusionnés, sauf `[Gemini]`), `git pull`, supprimer le worktree `../GED237-docs`.
- Reprise : suivre les PR de dev-backend (deps, Lot C9), ci-qa (e2e-smoke), dev-frontend (specs) ; point S1 le 14/11 ; relancer le PO sur (a) et (b) le 14 au plus tard.
- 18:09 — #36 fusionnée (621e3d7), checkout partagé nettoyé et sur `main` à jour, worktree `../GED237-docs` supprimé. Restent non suivis : `PASSATION-<rôle>.md` des autres sessions (à eux), `[Gemini]` (jamais commité). P8 : dev-frontend écrit `uat/validation-cycle.spec.ts` (données créées via API) et supprime les specs qui se mettent en skip sans tâche en attente.
- 18:12 — PR #37 (fix/deps-security : fastapi 0.117.1, starlette 0.48, python-multipart 0.0.33, pypdf 7 ; 227 tests, 85,10 %, pip-audit 73 → 54) rebranchée sur main, CI en cours ; fusion au vert au titre de l accord PO du 17:30 (PR sécurité ciblée). Starlette 1.3.1 (12 avis restants) en instruction chez l innovateur. Lot C9 : suite Docker en cours, PR ensuite.
- 18:14 — Starlette 1.3.1 : instruction innovateur = V1.1 (12 avis = 6 CVE doublées, aucune exploitable sans compte, 1 à 1,5 j-p de montée fastapi ≥ 0.133) ; exception pip-audit datée (expire 2026-12-15) confiée à dev-backend pour la PR du mardi 11. #37 : après rebranchage (ef63360) aucun run CI attaché pendant plusieurs minutes, surveillance en cours ; si rien, fermer/rouvrir la PR pour déclencher.
- 18:15 — Veille OCR (demande PO directe à l innovateur) : sources/ocr-leger.md → Adapt RapidOCR PP-OCRv6 small + Adopt OCRmyPDF, retrait EasyOCR, VLM écartés. Avant le 30/11 : OCR-0 benchmark (0,5 j) confié à ci-qa après ses 2 PR, échéance 14/11 ; corpus de démo pré-OCRisé la veille, worker éteint pendant la présentation. OCR-1 (1,5–2 j B) en V1.1 sauf démo VPS retenue (alors substitué à l ordre 6). Lié à la question PO (a).
- 18:18 — DEC-2026-003 (OCR léger, RapidOCR) écrite ACCEPTÉ par l innovateur sur validation directe du PO (rapportée, à confirmer par le PO auprès de l orchestrateur). Inscrit au plan : OCR-0 (ci-qa, ≤ 14/11) ; OCR-1 (dev-backend, 1,5–2 j) en V1.1 par défaut, avant le gel à la place de l ordre 6 seulement si démo VPS retenue le 17/11 ET CER RapidOCR ≤ CER EasyOCR ET worker < 1 Go ; OCR-2/3 en V1.1. Fichier DEC-003 non commité → prochaine PR docs.

## 2026-11-09 18:25 — Orchestrateur : plan jour par jour expliqué au PO

- PO demande la nature des items du plan DEC-2026-002 §3 (fonctionnalités ou correctifs). Réponse : surtout correctifs de sécurité + preuves de recette ; seules nouveautés = Lot C9 (filtres/pagination Espaces) et sauvegarde/restauration.
- #37 : surveillance CI toujours active ; fusion au vert (accord PO 17:30). Prochaine étape inchangée : PR de dev-backend, ci-qa, dev-frontend ; point S1 le 14/11.
- 18:41 — #37 fusionnée (8c90260), branche distante supprimée, dev-backend prévenu. PR #38 Lot C9 (feat/spaces-server-filters, 9d0f94e, +402/-6, 16 tests, 85,17 %) relue : contrat filtres + limit optionnel + X-Total-Count, CI entièrement verte, état CLEAN. En attente de l accord PO pour la fusion ; contrat transmis à dev-frontend pour SpacesPage le 17/11.
- 18:44 — PO « go » : #38 fusionnée, branche distante supprimée, main à jour. Lot C9 côté API livré avec 4 jours d avance ; dev-frontend branche SpacesPage le 17/11.
- 18:48 — Consigne PO : pipeline permanent, toute session libre reçoit la tâche suivante. Dispatch : dev-backend démarre la recherche bornée ce soir (au lieu de mardi) ; ci-qa relancé (aucune PR e2e ouverte, statut demandé, PASSATION-ci-qa.md à créer) ; innovateur : 1) brief décisions PO (a) VPS/on-site et (b) B6 pour demain midi, 2) triage Dependabot #35 (nouveau, hors DEC-001), 3) spec jeu de démo, 4) étude reuse-first sauvegarde/restauration. Constaté : branches distantes obsolètes (chore/*, ci/*, feat/*, fix/*, test/*, docs/equipe-agents) → ménage à proposer au PO plus tard.
- 18:53 — Innovateur : dossier décisions PO livré (gestion-projet/innovateur/decision-po-vps-b6.md) : reco (a) démo sur place Docker + poste de secours (VPS 198 Mo libres, disque 77 %, +2 à 2,5 j) ; reco (b) garde admin/non-admin seule mardi 18, constats backend B6 en V1.1. Soumis au PO, réponse attendue. Ci-qa : PR #39 brouillon (ci/e2e-smoke : docker-compose.e2e.yml, Playwright smoke + axe, gate e2e non bloquant, LESSON-2026-020 conteneurs orphelins) ; smoke local en cours, ready for review ensuite puis PR 2 seed et OCR-0. Leçon rôles de dev-backend renumérotée 021. Surveillance CI #39 en cours.
- 18:54 — Dev-backend (worktree ../GED237-search, fix/search-scoped) : recherche bornée codée, 5 tests, pip-audit-ignore.txt daté 2026-12-15, walkthrough Lot C DONE ; PR après libération de la VM par ci-qa. Constats : (1) bug latent recherche 500 au premier résultat (doc.category) corrigé, tests existants sans hit → LESSON-2026-022 demandée dans la PR ; (2) DEBUG=true (compose:110, config.py:15) → slowapi 1000/min au lieu de 5/min sur login/OTP → PR séparée DEBUG=false (amendement DEC-002 déjà accepté), inventaire de ce que DEBUG pilote, limites réglables par env. Innovateur : tâche 2b = vérifier parcours démo vs 5/min et recommander une valeur démo.
- 18:55 — #39 : CI entièrement verte, toujours brouillon (attente résultat smoke ci-qa). D5 (dev-frontend) : boutons démo MINFI de LoginPage.tsx ne présélectionnent pas l institution (libellé accentué en dur vs seed sans accent) → correction confiée à dev-frontend en petite PR fix/login-demo-institution (sélection par code, comme _resolve_tenant côté backend), pendant son attente de VM ; ci-qa corrige selectInstitution dans #39 pour la recette. Ordre VM Docker ce soir : pytest dev-backend → second smoke ci-qa → premier run dev-frontend.
- 18:57 — Innovateur : tâches 2, 2b, 3 livrées (triage-dependabot-35.md, parcours-demo.md § 0, jeu-donnees-demo.md). #35 (zustand 5.1.0, @playwright/test 1.65.0, mineurs) : fusion recommandée après #39, accord PO demandé ; PR BEHIND, update-branch à faire au moment venu. Limites auth : 9 connexions + 10 OTP en 13 min, 5/min casse répétition et rejeux → PR DEBUG de dev-backend étendue : AUTH_LOGIN_RATE_LIMIT / AUTH_OTP_RATE_LIMIT (défaut 5/min, 30/min compose démo et e2e) + clé slowapi derrière nginx via X-Forwarded-For seulement sous drapeau TRUSTED_PROXY. Jeu de démo : 420 docs DRH/DAF/DSI, seed existant + manifeste format ci-qa, attribution (ci-qa 0,75 j / B 0,25 j) au point S1. Tâche 4 sauvegarde en cours.
- 18:59 — Innovateur : tâche 4 livrée (sauvegarde-restauration.md : Adopt offen/docker-volume-backup v2.50.1 + restore.sh maison, B 0,75 j lun 17, Q 0,5 j ; repli backup.sh manuel). Nouvelle file innovateur : protocole OCR-0 pour ci-qa, inventaire branches distantes mortes, checklist démo J-1/J0. Ci-qa : #39 à 819abd7, image Playwright reste 1.64 + contrôle image/lock ; #35 exigera docker-compose.e2e.yml → v1.65.0-noble (une ligne) au moment de sa fusion ; AUTH_*_RATE_LIMIT déjà à 30/min dans l api e2e. PR docs du soir en cours depuis worktree ../GED237-docs2 (branche docs/point-2026-11-09-soir).
- 19:00 — PR #40 docs du soir ouverte (59866bd, 15 fichiers, CI en cours). PR #41 D5 (dev-frontend, fix/login-demo-institution, LoginPage.tsx seul, +31/-8) relue : sélection du tenant par code (short_name, insensible à la casse), repli saisie libre, effet sur chargement tardif de la liste ; CI frontend en cours ; accord PO demandé. Constat V1.1 : identifiants des comptes démo codés en dur dans LoginPage.tsx (préexistant, voulu pour la démo) → à lister dans les écarts annoncés. Dev-frontend : test/uat-playwright rebasée sur ci/e2e-smoke, premier run dès signal VM de ci-qa. Après fusion de #40 : réconcilier PASSATION.md local (superset) avant git pull.
- 19:02 — PO « go tout » : #40 fusionnée (36ea190), checkout partagé réconcilié (passations réappendues, README innovateur restauré) ; décisions (a) démo sur place Docker + poste de secours et (b) garde admin/non-admin seule, constats backend V1.1 → consignées en fin de DEC-2026-002 (non commité, prochaine PR docs). À fusionner dès vertes : #41 (CI en cours), #39 (après second smoke + ready), #35 (après #39, ligne image Playwright par ci-qa). Innovateur : protocole-ocr-0.md livré, branches-distantes.md en cours. Constat : #39 contient déjà un assouplissement des limites auth e2e → à aligner sur AUTH_*_RATE_LIMIT.
- 19:04 — #41 était BEHIND après #40 → update-branch, fusion automatique au vert en cours (tâche de fond, accord PO « go tout »). Décisions (a)(b) diffusées à dev-frontend, dev-backend, ci-qa ; innovateur : propager dans ses fiches + écarts annoncés consolidés (B6 backend, D4, OTP, starlette, OCR-1, identifiants démo en dur) puis squelette plans/point-2026-11-14.md. Innovateur a livré branches-distantes.md (12 fusionnées + 1 fermée à supprimer, 7 à garder, reco : activer la suppression automatique des branches de tête) et checklist-demo.md. Ces deux actions GitHub attendent l accord PO. Prochaine PR docs : DEC-002 fin, 3 fiches innovateur + README, passations.
- 19:04 — Ci-qa : #39 à jour de main par merge (force-push refusé par ses permissions, acceptable) ; sa pile e2e porte déjà AUTH_*_RATE_LIMIT=30/min, un seul mécanisme ; constat : auth.py force 1000/min si DEBUG vrai → consigne à dev-backend : supprimer cette branche, variables seule source, DEBUG=False par défaut, test dédié. « #39 ready » après second smoke (VM occupée par la suite dev-backend).
- 19:06 — #41 fusionnée (a4b8dbe), main local à jour, dev-frontend et ci-qa prévenus (réintégration de main dans ci/e2e-smoke avant « #39 ready »). Bilan du 9/11 : 6 PR fusionnées (#34, #36, #37, #38, #40, #41). En attente : « #39 ready » (ci-qa), PR recherche bornée (dev-backend, VM), PR DEBUG/limites, fiches innovateur (propagation décisions, écarts annoncés, squelette point S1), accord PO sur suppression de 13 branches + suppression automatique des branches de tête. #35 après #39.
- 19:08 — Innovateur : décisions propagées (decision-po-vps-b6 TRANCHÉ, checklist-demo, contexte-application, plan-presentation § 3 = 15 écarts annoncés avec réponse jury, § 4 +2 questions, README). Squelette plans/point-2026-11-14.md en cours. Prochaine PR docs quand il est livré : fin de DEC-002, 3 fiches nouvelles (protocole-ocr-0, branches-distantes, checklist-demo), fiches modifiées, README, passations.
- 19:09 — PR #42 recherche bornée (dev-backend, fix/search-scoped, +271/-7, 9 fichiers, 248 tests, 85,30 %) relue : même périmètre de lecture que GET /documents (constantes réutilisées), tenant toujours filtré, corbeille exclue, 500 doc.category corrigé via jointure DocumentCategory, LESSON-2026-022, pip-audit-ignore.txt (6 PYSEC, expire 2026-12-15, lu par security.yml). Point ouvert : l expiration n est qu un commentaire → contrôle de date demandé. CI en cours, accord PO à demander ensuite. Dev-backend enchaîne PR DEBUG/limites/TRUSTED_PROXY.
- 19:10 — Innovateur : squelette plans/point-2026-11-14.md livré (attendus par rôle avec colonne Constaté, décisions D1–D5 du 14/11, glissements, budget). Numérotation des écarts tranchée : plan-presentation § 3 fait foi, note ajoutée en fin de DEC-002 (OTP = écart 12). PR docs de la nuit ouverte depuis ../GED237-docs3 (docs/point-2026-11-09-nuit).
