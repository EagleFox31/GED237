# PASSATION — session dev-frontend (Lot C, recette Playwright)

En ajout seulement : chaque reprise ajoute une entrée à la fin.

## 2026-11-09 18:02 — Lot C : specs UAT écrites, premier run en attente de la VM

**Contexte.** Mission de l'orchestrateur : campagne Playwright de recette, première PR avant le 14/11. La liste de travail = les 8 parcours de
`gestion-projet/innovateur/parcours-demo.md`. Ne pas corriger les défauts applicatifs : les consigner et les transmettre.

**Où.** Worktree `../GED237-lotc-frontend`, branche `test/uat-playwright`. **Jamais de git dans `GED237/`** (checkout partagé).
Rien n'est commité pour l'instant.

**Fait (non commité).**
- `frontend/e2e/fixtures/uat.fixture.ts` : `UatApi` (domaines, activités, règles, upload, revues, resolveReview, auditLogs,
  documentAuditLogs, tryUpload), `apiLogin`, `apiAs(request, role)`, fixtures `runId` / `adminApi` (jeton par worker).
- `frontend/e2e/specs/uat/` :
  - `auth-2fa.spec.ts` (P1 : AUTH-01 + E1/E2, E3 fixme D1 ; AUTH-02 + E1, destination fixme D2 ; AUTH-03) ;
  - `directory-import.spec.ts` (P2) ;
  - `rule-classification.spec.ts` (P3) ;
  - `spaces-filters.spec.ts` (P4 : navigation, filtres en fixme jusqu'à C9) ;
  - `manual-review.spec.ts` (P6) ;
  - `audit-trail.spec.ts` (P7 ; D3, D4 en fixme).
- `frontend/playwright.config.ts` : projet `uat` ajouté ; `specs/uat` ignoré par les projets chromium, firefox et webkit.
- Walkthrough `gestion-projet/walkthrough/[Claude] Lot C recette Playwright - 2026-11-09.md` (EN COURS) : table des parcours,
  table des 37 UAT, contrat figé des filtres d'espaces, défauts D1–D4.
- Copie locale `docker-compose.e2e.yml` (venant de `../GED237-e2e`) : **ne pas commiter**. Ne pas commiter non plus `frontend/e2e-out`,
  ni `ci.yml`, ni `package-lock.json`.

**Défauts transmis à l'orchestrateur (non corrigés).**
- D1 : pas de blocage après 3 OTP erronés.
- D2 : `redirectToLogin` ne garde pas la destination ; regroupé avec l'ordre 6 de DEC-2026-002.
- D3 : l'audit ne trace ni la connexion, ni le dépôt, ni l'import.
- D4 : pas d'export du journal d'audit.

**Coordination.**
- File VM Docker (4,1 Go) : pytest dev-backend → run ci-qa → moi. Attendre le message « suite terminée » de dev-backend
  et le feu vert de ci-qa. Pas de run en parallèle.
- ci-qa (PR 1 `ci/e2e-smoke`, puis PR 2 `ci/e2e-seed`) : manifeste `frontend/e2e/data/seed-manifest.json` (codes `E2E-DOM`,
  `E2E-ACT`, `E2E-RULE-DEMO` motif `e2edemo-…`, `E2E-VOL-001..400` avec répartition déclarée), corpus
  `frontend/e2e/data/demo-import/`, reset une fois par run (`scripts/e2e-reset.sh`). À importer dans `uat.fixture.ts` dès qu'il est poussé.
- dev-backend : `feat/spaces-server-filters` (contrat figé, voir le walkthrough) → retirer les `fixme` de P4 à la livraison.

**Suite.**
1. Run : `E2E_ARGS="--project=uat --retries=0 --reporter=line" docker compose -p edossier-e2e-uat -f docker-compose.e2e.yml up --build --abort-on-container-exit --exit-code-from e2e`
   (option : `image: edossier-e2e-api` pour réutiliser l'image de ci-qa), puis `down -v`. Journal dans le scratchpad.
2. Corriger sélecteurs et assertions ; renforcer la post-condition de P2 avec le manifeste.
3. Rebaser sur `ci/e2e-smoke` (conflit attendu dans `playwright.config.ts` : projet `smoke`).
4. Supprimer les specs mockées et périmées (ingestion, rules, classification-admin, spaces, audit), une fois les UAT vertes.
5. Walkthrough : résultats, RAIDER, EN REVUE. PR vers main (modèle du dépôt, section RAIDER review, sans mention d'IA,
   identité AKAA Jennifer, `export GODEBUG=;`). Compte rendu à l'orchestrateur : n° de PR, couverture, nombre de parcours verts.
6. P5 : attendre le correctif de la recherche restreinte. P8 : attendre la décision du PO.

## 2026-11-09 18:03 — audit.spec.ts supprimé, P3 confirmé

- `frontend/e2e/specs/audit.spec.ts` supprimé dans le worktree, avec l'accord de l'orchestrateur ; à citer dans la PR. `auditor-export.spec.ts` est conservé (son remplacement n'a pas été validé).
- P3 : le simulateur de /classement appelle bien `/classification-rules/simulate`, ce que couvre `rule-classification.spec.ts`.
- D3 et D4 sont en instruction chez l'innovateur puis le PO. Ne pas toucher au backend. P7 reste dans la démo avec les traces revue et corbeille.
- Prochaine étape : inchangée (attendre la VM, puis lancer le premier run).

## 2026-11-09 18:04 — Arbitrage D3/D4 appliqué

- D3 : le correctif backend (audit de la connexion, du dépôt et de l'import) est prévu le 12/11 par dev-backend. Le test `fixme` de `audit-trail.spec.ts` est à réactiver quand leur PR arrive.
- D4 : l'export est reporté en V1.1. Le test SC-AUD-02 est retiré de P7 et `auditor-export.spec.ts` est supprimé dans le worktree (à citer dans la PR, comme `audit.spec.ts`). Le walkthrough est à jour.
- État : rien de commité, aucun run. Prochaine étape inchangée : attendre la VM (pytest dev-backend, puis ci-qa), puis lancer le premier run du projet `uat`.

## 2026-11-09 18:08 — DEC-2026-002 acceptée : P8 = cycle de validation

- P8 devient le cycle de validation (specs existantes : validation, workflow, full-cycle). Ces specs se mettent en skip conditionnel faute de tâche dans le seed. Je l'ai signalé à l'orchestrateur et je propose une spec `uat/validation-cycle.spec.ts` déterministe (circuit et document créés via l'API) après le premier run.
- B6 reste ouvert jusqu'au 17/11 : D2 (garde de routes) attend.
- Plan inchangé : attendre la VM, puis lancer le premier run.

## 2026-11-09 18:09 — P8 validé : uat/validation-cycle.spec.ts

- Accord de l'orchestrateur : écrire `uat/validation-cycle.spec.ts` (visa, rejet et retour à l'écran avec MGR001) et supprimer `validation.spec.ts`, `workflow.spec.ts` et `full-cycle.spec.ts` dans la même PR, en les citant.
- Ordre : P2/P3/P6, puis le premier run, puis P8.
- Demandé à ci-qa (PR 2) : circuit stable `E2E-WF-VALID` (MINFI002 → visa MGR001 → signature) et 3 tâches en attente `E2E-VAL-VISA`, `E2E-VAL-REJET` et `E2E-VAL-RETOUR` dans le manifeste ; en repli, la spec soumet un document via l'API. Réponse attendue.

## 2026-11-09 18:10 — ci-qa accepte le seed P8

- Engagement ferme dans la PR 2 de ci-qa : circuit `E2E-WF-VALID` (MINFI002 → visa MGR001 → signature), dont le déclencheur sera écrit dans le manifeste.
- Tâches en attente `E2E-VAL-*` : livrées seulement si le modèle de workflow le permet. Sinon le manifeste contiendra `pendingTasks: []`, et la spec devra soumettre via l'API (lire `pendingTasks` d'abord).
- La PR 2 pourra être reprise par une nouvelle session ged-ci-qa (même nom).
- État inchangé : rien de commité, aucun run ; j'attends la VM (pytest dev-backend, puis ci-qa).

## 2026-11-09 18:17 — Incident : pile e2e démarrée sans commande de ma part

- Vers 18:16, la pile `edossier-e2e-uat` (api, postgres, redis, e2e) a démarré alors que dev-backend lançait pytest (`gedtest-*`). La cause probable est le `docker compose up --build` du premier run : arrêté par TaskStop, il a survécu en orphelin, a terminé son build puis a démarré la pile. Je l'ai démontée en moins d'une minute (`down -v --remove-orphans`) et ci-qa est prévenu.
- Un processus `docker.exe` (PID 50880, lancé à 18:11) reste actif. Je n'ai pas pu l'inspecter (inspection refusée) et ne l'ai pas tué, car il appartient peut-être à une autre session.
- Prévention : après un TaskStop sur un `compose up`, toujours vérifier `docker ps -a --filter name=<projet>` et `docker compose ls` ; lancer les runs longs en tâche suivie, jamais en `--build` sans surveillance.
- File inchangée : pytest dev-backend, puis smoke ci-qa (qui me préviendra), puis moi avec `image: edossier-e2e-api:latest`.

## 2026-11-09 18:34 — pytest dev-backend terminé ; PR backend #38

- dev-backend : suite terminée, PR #38 (filtres serveur des espaces, contrat figé ; en plus : `q` ≤ 120 caractères, sinon 422). Retirer les `fixme` de P4 (`spaces-filters.spec.ts`) dès que #38 est fusionnée dans la base de mon run.
- VM : c'est au tour de ci-qa (smoke). Je lance mon run uat quand ci-qa m'envoie « fin de smoke ».

## 2026-11-09 18:34 — Smoke ci-qa en cours ; compose local prêt

- ci-qa lance son smoke (pile `edossier-e2e`) et me préviendra après son `down -v`.
- Copie locale `docker-compose.e2e.yml` (non commitée) : `image: edossier-e2e-api:latest` ajouté au service api, run sans `--build` :
  `E2E_ARGS="--project=uat --retries=0 --reporter=line" docker compose -p edossier-e2e-uat -f docker-compose.e2e.yml up --abort-on-container-exit --exit-code-from e2e`

## 2026-11-09 18:34 — Tâche future : brancher SpacesPage sur C9 (lundi 17/11)

- Contrat de la PR #38 (fusion après accord du PO) : `GET /spaces/{id}/documents` **et** `GET /spaces/documents` acceptent `domain_id`, `activity_id`, `year`, `status`, `classification_status`, `q` (≤ 120 caractères), `limit` (1..200, optionnel), `offset`. Une valeur invalide renvoie 422. Le total filtré est dans `X-Total-Count`. Pas de migration.
- Ne rien changer dans SpacesPage avant la fusion de #38. Ensuite : le brancher le 17/11, et retirer les `fixme` de P4.
- Priorité inchangée : premier run (en attente de la fin du smoke ci-qa).

## 2026-11-09 18:45 — #38 fusionné ; ma base a 33 commits de retard sur main

- C9 (#38) est fusionné dans main (c7fc5bd). Ma branche `test/uat-playwright` (base 3e05d6c) a **33 commits de retard** sur origin/main, et mon travail n'est pas commité.
- Le `backend/requirements.txt` de main diffère de celui de l'image `edossier-e2e-api:latest` (fastapi 0.117, redis 8.1, pypdf 7…) : il faudra une reconstruction pip complète.
- Plan : (1) premier run sur l'image actuelle (P1, P2, P3, P6, P7, navigation P4 ; filtres P4 en `fixme`) ; (2) commit, puis rebase sur origin/main (ou sur `ci/e2e-smoke` rebasée) ; (3) image reconstruite **une seule fois** sur main, a priori par ci-qa (question posée) ; (4) retrait des `fixme` P4, puis run de preuve final.

## 2026-11-09 18:47 — ci-qa : ordre VM et reconstruction d'image fixés

- ci-qa confirme l'ordre : (1) fin de son smoke et `down -v`, puis son signal ; (2) mon premier run uat sur l'image actuelle `edossier-e2e-api:latest` ; (3) une fois mon run terminé (je le préviens), ci-qa rebase la PR 1 sur origin/main et reconstruit l'image sous le même tag, puis me prévient.
- Je ne construis jamais l'image moi-même et je ne lance rien avant le signal de ci-qa.
- Après ma reconstruction-signal : commit, rebase sur origin/main, retrait des `fixme` P4, run de preuve final.
- État : rien de commité, aucun run. J'attends le signal « fin de smoke ».

## 2026-11-09 18:52 — Connexion e2e cassée (accents du seed) ; défaut D5

- Smoke ci-qa : `selectOption({label:'Ministère…'})` expire, car le seed nomme le tenant « Ministere des Finances » (sans accent). ci-qa corrige `selectInstitution` (choix par le code entre parenthèses) dans sa PR #39 (`ci/e2e-smoke`, déjà basée sur main c7fc5bd). **Avant mon run, rebaser `test/uat-playwright` sur `origin/ci/e2e-smoke` une fois le correctif poussé** : ne pas le dupliquer. Le login API des UAT n'est pas touché (`_resolve_tenant` accepte le code).
- D5 (non corrigé) : les boutons démo MINFI de `LoginPage.tsx` ont un libellé en dur absent des options et ne présélectionnent rien. Ajouté au walkthrough et transmis à l'orchestrateur.
- La LESSON-2026-020 de ci-qa (commit 08fb8da) couvre le même incident que la mienne : j'ai retiré mon doublon du worktree.
- File VM : pytest dev-backend (15 à 19 min), puis second smoke ci-qa (~10 min), puis moi, sur signal de ci-qa.

## 2026-11-09 19:00 — Branche rebasée ; D5 corrigé (PR #41)

- `test/uat-playwright` : commits d2effd7 (specs UAT, suppression d'audit et d'auditor-export) et 093911b (walkthrough D5), rebasés sur `origin/ci/e2e-smoke` 789ede6 (correctif selectInstitution de ci-qa). Conflit `playwright.config.ts` résolu : les projets `smoke` et `uat` coexistent. **Pas encore poussée.**
- `docker-compose.e2e.yml` est désormais suivi (venu de ci-qa) : ma modification locale `image: edossier-e2e-api:latest` reste **non commitée**. Ne jamais faire `git add -A`. Copie de secours : scratchpad `compose.local.yml`.
- D5 : sur décision de l'orchestrateur, je l'ai corrigé moi-même → **PR #41** (`fix/login-demo-institution`, worktree `../GED237-login-d5`, LoginPage choisit l'option par code de tenant). tsc OK ; ESLint 3 avertissements avant, 3 après. Non fusionnée (accord du PO requis). Walkthrough : « corrigé par PR #41 ».
- À coordonner : `full-cycle.spec.ts` (à supprimer pour P8) est dans le testMatch `smoke` de ci-qa. Je ne la supprime qu'avec son accord.
- Suite : signal VM de ci-qa → premier run uat (commande sans `--build`, voir l'entrée 18:34) → `down -v` + `docker compose ls` → compte rendu à l'orchestrateur (nombre de parcours verts) → je préviens ci-qa (il reconstruit l'image sur main).

## 2026-11-09 19:00 — Conditions de ci-qa pour supprimer full-cycle (P8)

- ci-qa accepte la suppression de `full-cycle.spec.ts`, **à condition que** la même PR remplace `full-cycle` par `validation-cycle` dans le testMatch du projet `smoke` (`frontend/playwright.config.ts`). Sinon, la couverture P8 du smoke disparaît sans qu'aucun test échoue.
- Si `uat/validation-cycle.spec.ts` dépend du circuit `E2E-WF-VALID` (PR 2 seed de ci-qa), la suppression **attend la fusion de la PR 2**.
- Mettre ged-ci-qa en relecture de cette PR.
- VM : toujours en attente (pytest dev-backend, puis ~10 min de smoke ci-qa, puis signal pour moi).

## 2026-11-09 19:03 — Décisions PO : B6, démo Docker, #41 approuvée

- B6 : seule la garde de routes admin / non-admin côté frontend est retenue, planifiée le **mardi 18/11** (0,5 j). Les trois constats backend passent en V1.1. D2 (destination perdue après expiration du refresh) était regroupé avec cette garde : vérifier avec l'orchestrateur s'il entre dans le lot du 18/11, et mettre à jour le routage de D2 dans le walkthrough.
- Démo du 30/11 : sur place, en Docker, pas de VPS.
- #41 (D5) est approuvée et se fusionnera automatiquement quand sa CI relancée sera verte. #40 (docs) est fusionnée (36ea190).
- **Quand #41 et #39 seront fusionnées, rebaser `test/uat-playwright` sur origin/main** (et supprimer le worktree `../GED237-login-d5` une fois #41 fusionnée).
- Priorité inchangée : premier run P1/P2/P3/P6/P7 au signal VM de ci-qa.

## 2026-11-09 19:06 — #41 fusionnée (a4b8dbe)

- D5 : PR #41 fusionnée dans main (a4b8dbe). Le walkthrough indique « corrigé par PR #41, fusionnée a4b8dbe » (commit fixup 3bffb4b, à squasher avec `git rebase --autosquash` au prochain rebase). Worktree `../GED237-login-d5` et branche locale supprimés.
- Suite : ci-qa réintègre main dans `ci/e2e-smoke`. **À son signal, rebaser `test/uat-playwright` sur `origin/ci/e2e-smoke` (avec autosquash), avant le premier run.** Mettre `docker-compose.e2e.yml` de côté (modification locale de l'image) pendant le rebase, puis le restaurer.

## 2026-11-09 19:06 — Rebasée sur ci/e2e-smoke 2145758 (main avec #41)

- `test/uat-playwright` = dce594d (specs UAT) + 6b96457 (walkthrough D5, fixup squashé), sur `origin/ci/e2e-smoke` 2145758 (main a4b8dbe incluse). Pas encore poussée.
- Modification locale `image: edossier-e2e-api:latest` réappliquée sur `docker-compose.e2e.yml` (non commitée ; patch : scratchpad `compose-local.patch`).
- Attente VM : dev-backend (gedtest-*), puis smoke ci-qa, puis moi au signal.

## 2026-11-09 19:08 — Image reconstruite sur main par ci-qa ; filtres P4 réactivés

- ci-qa lance son second smoke avec `--build` : `edossier-e2e-api:latest` est reconstruite sur main (#38 compris). C'est **la seule reconstruction** (~15 min de pip + ~10 min de tests). Signal pour moi après son `down -v`.
- Commit 34b4db2 : `fixme` retiré des tests de filtres P4 (contrat #38 vérifié dans `WorkspaceDocumentFilters`). Le test de pagination est borné aux documents du test (`q`=runId, 2 docs, limit/offset, X-Total-Count=2, q>120 → 422) pour rester stable en parallèle. Walkthrough P4 mis à jour.
- Branche : dce594d, 6b96457, 34b4db2 sur 2145758. Non poussée. `docker-compose.e2e.yml` : modification locale de l'image, non commitée.
- Premier run (au signal) : P1, P2, P3, **P4 complet**, P6, P7. Sans `--build`. Commande dans l'entrée 18:34.

## 2026-11-09 19:29 — Premier run uat lancé (VM à moi)

- Signal ci-qa reçu : son smoke a donné 21 réussis / 10 échecs (il analyse et me transmettra ce qui touche mes écrans). L'image `edossier-e2e-api:latest` est reconstruite sur main (#41 incluse).
- Run lancé en tâche de fond : pile `edossier-e2e-uat`, sans `--build`, avec `down -v --remove-orphans` enchaîné. Journal : scratchpad `uat-run1.log`. **Si la session s'arrête : vérifier `docker compose ls` et démonter `edossier-e2e-uat`.**
- Suite : analyser les échecs, corriger les specs (pas l'app), compte rendu à l'orchestrateur (nombre de parcours verts), puis prévenir ci-qa que la VM est libérée.

## 2026-11-09 19:35 — Run UAT 2, garde de routes codée, fix/recette-smoke-1 démarrée

- Run 1 : échec au chargement (TEST_USERS non réexporté) → corrigé, commit 24e8f64 sur test/uat-playwright (non poussée).
- Run 2 : 10 verts / 5 rouges / 3 fixme. Rouges = specs : resolveReview sans classification_target_org_unit_id (scope service), « N document(s) » → « N document(s) » réel = « N document/documents », onglets du plan de classement = boutons (pas role=tab), « Vérifier le classement » exact, contenus identiques → 409 doublon. Corrigés (non commités) dans lotc. **Run 3 en cours** (journal scratchpad uat-run3.log), démontage enchaîné. Si la session s'arrête : `docker compose ls`, démonter edossier-e2e-uat, prévenir ci-qa « VM libérée ».
- Garde de routes codée (non commitée, non vérifiée Docker) : ../GED237-route-guard, App.tsx (ADMIN_ROUTES, RequireProfile, guarded()) + frontend/e2e/specs/route-guard.spec.ts GUARD-01..06. Spec non incluse dans le testMatch smoke : à décider.
- Nouvel ordre orchestrateur : 1) PR fix/recette-smoke-1 (worktree ../GED237-recette1 depuis a4b8dbe) : modale UploadDocumentModal max-h + défilement à 1280×720 ; masquer « Nouveau Document » (Documents.tsx:91) et actions d'écriture pour le lecteur ; a11y : label htmlFor=institution (LoginPage), contrastes si tokens existants. **Ne pas toucher Sidebar.tsx:20** (/tenants côté authz, dev-backend). 2) garde de routes. 3) SpacesPage le 17 (spec-espaces-filtres-ui.md ; sortir spaces.spec.ts de mocked-chromium).

## 2026-11-09 19:50 — Run UAT 3 vert, PR #45 et #46 ouvertes

- Run 3 UAT (test/uat-playwright, lotc) : 15 verts / 3 fixme / 0 rouge, 6 parcours sur 8 (P5 attend correctif recherche, P8 à écrire). Commits 24e8f64 + 2ebb084, branche **non poussée** ; walkthrough modifié non commité (reste : statut EN REVUE + checklist RAIDER).
- **PR #45** fix/recette-smoke-1 (c89f74e) : bouton « Nouveau Document » masqué hors profils créateurs, modale upload défilante, a11y LoginPage/Sidebar/Header/OrgDashboard. tsc/lint/build verts. Smoke à rejouer par ci-qa (elle le lance après passage VM 4→12 Go).
- **PR #46** feat/route-guard-admin (8a6c0f9) : ADMIN_ROUTES + RequireProfile dans App.tsx, spec e2e/specs/route-guard.spec.ts GUARD-01..06. tsc/lint/build verts ; e2e **pas joué** : créneau demandé à ci-qa. À ajouter au testMatch smoke après fusion #39.
- Orchestrateur prévenu (#46, question D2 close ou non).
- **VM** : ne rien lancer sans feu vert ci-qa.
- Prochaine étape : P8 uat/validation-cycle.spec.ts dans lotc (code seul), vérifier dépendance E2E-WF-VALID (PR 2 seed ci-qa), puis suppression validation/workflow/full-cycle.spec.ts + testMatch smoke, collisions ID matrice, walkthrough EN REVUE, push + PR Lot C. SpacesPage le 17/11.

## 2026-11-09 20:04 — #46 e2e vert, P8 écrite, défauts VAL-D1..D3 remontés

- **#46** : GUARD-01..06 6/6 verts (run avec la config et les fixtures de #39 et l'App.tsx de #46, arbre temporaire dans le scratchpad), corps de PR coché. Relue OK par l'orchestrateur ; reste l'accord PO. #45 relue OK, attend le smoke de ci-qa (#45 + #47).
- **P8** : commit 2919973 sur test/uat-playwright (lotc, **non poussée**). uat/validation-cycle.spec.ts : SC-VAL-01 (pile manager) actif ; SC-VAL-01 écran, -02, -03 et -04 en fixme. Helpers me, submitForVisa et workflowSteps ajoutés dans uat.fixture. validation, workflow et full-cycle.spec.ts ainsi que pages/workflow.page.ts sont supprimés ; dans le smoke, full-cycle est remplacé par validation-cycle. Pas de dépendance au seed E2E-WF-VALID.
- **Défauts signalés à l'orchestrateur** (arbitrage attendu : qui corrige, pour quand) :
  - VAL-D1 : collab sans users:read → liste des valideurs vide ;
  - VAL-D2 : /workflows/pending sans current_version_id → Viser/Rejeter en 422 ; /tasks envoie action_type 'approve' ;
  - VAL-D3 : pas de motif ni de retour à l'écran.
- Run P8 lancé (journal scratchpad p8-run.log, démontage enchaîné). Si la session s'arrête : NAME                STATUS              CONFIG FILES
cfao-projets        running(5)          C:\Users\lawry\Documents\Projets\cfao-projets\docker-compose.yml
deploy              running(3)          C:\Users\lawry\Documents\Projets\FleetMaster2.0-main\fm-expiry\deploy\docker-compose.yml
roadmapmentor       running(3)          C:\Users\lawry\Documents\Projets\roadmapmentor\docker-compose.yml,C:\Users\lawry\AppData\Local\Temp\claude\c--Users-lawry-Documents-Projets-roadmapmentor\333db2bb-a48f-4b48-8a15-58eb9355caf0\scratchpad\override.yml, démonter edossier-e2e-uat, prévenir ci-qa.
- Reste Lot C :
  - collisions d'ID de la matrice (§4) et renommage SC-ADM-REVIEW, RULES et E2E-BULK, avec une note dans MATRICE_UAT_E2E_2026-07-22.md ;
  - suppression des 4 specs mockées ;
  - walkthrough EN REVUE avec RAIDER, à commiter ;
  - rebase sur main après #39, avec le patch du compose de côté ;
  - push puis PR Lot C.
- SpacesPage le 17/11.

## 2026-11-09 20:09 — PR Lot C #48 ouverte ; prochaine étape fix/validation-cycle-ui

- **#48** test/uat-playwright → base ci/e2e-smoke (#39). Commits 2919973 (P8), 0d3a5f3 (specs mockées supprimées + ID §4), fe5b20c (walkthrough EN REVUE + RAIDER). Corps : scratchpad pr-lotc.md.
- Run P8 : SC-VAL-01 en échec à la préparation (403 upload pour le rôle collaborator, corrigé par #47) ; ci-qa le rejoue dans son run combiné #45+#47. Pile démontée.
- Note de ci-qa : #39 porte des fixme « lifted by #45 » (SMK-06/07/08/10, a11y 01/02). Si #45 fusionne après #39, retirer ces lignes dans ma branche.
- Arbitrage P8 (orchestrateur) : branche **fix/validation-cycle-ui** (depuis main), à coder maintenant contre le contrat :
  - ValidationHub lit current_version_id de GET /workflows/pending (ajouté par la PR dev-backend fix/workflow-pending-validators, mardi) ;
  - WorkflowTasks passe par submitWorkflowAction avec un ActionType valide ;
  - l'Atelier remplit la liste des valideurs via GET /workflows/validators (id, full_name) ;
  - motif saisissable au rejet ;
  - retour pour correction en V1.1.

  e2e SC-VAL-01..04 dès que la PR backend est fusionnée (jeudi 12 au plus tard). SpacesPage le 17.

## 2026-11-09 20:29 — orchestrateur : consigne reçue hors session (dev-frontend injoignable)

- #48 : avis ci-qa favorable ; fusion après #47 (ordre #39 → #42 → #47 → #48), pas de fixme SC-VAL-01 ; au rebase sur ci/e2e-smoke, conflit modify/delete sur full-cycle.spec.ts → supprimer le fichier. Contrat /validators : dev-backend envoie schéma + exemple (manager + tenant_admin actifs du tenant, champs id + full_name, autorisé par documents create ; current_version_id nullable dans DocumentSummary de /pending).
- #45 : présentée au PO telle quelle (run combiné ci-qa : SMK-06/07 verts), ne rien y ajouter.
- Après fix/validation-cycle-ui : PR fix/recette-smoke-2 (mer 11, ≈0,2 j) = (1) SMK-10 : masquer « Ranger / Importer » (Sidebar) pour le profil lecteur, même ensemble de profils que CAN_CREATE_DOCUMENT de #45 (réutiliser) ; écart V1.1 à noter dans le walkthrough ; (2) SMK-01/02 : color-contrast « serious » restants, 1 élément connexion + 4–5 tableau de bord, détail dans le rapport HTML ci-qa (GED237-e2e/frontend/e2e-out/playwright-report), corriger via tokens Tailwind existants. Preuve : smoke local SMK-01/02/10 sans fixme, verts.
- 22:28 — orchestrateur : spec a11y livrée par innovateur → gestion-projet/innovateur/spec-a11y-contrast.md (5 violations color-contrast mesurées dans les traces axe : DemoProfiles.tsx:27 et Logo.tsx:14 slate-400 → slate-500 ; OrgDashboard.tsx:184/188/192 green/blue/red-500 sur cartes -50 → -700 ; 5e Déduit Header.tsx:191 ; mêmes classes dans Dashboard.tsx:90/94/98, PlatformDashboard.tsx:82, CategoriesTab.tsx:181). À appliquer dans la PR fix/recette-smoke-2 (mer 11) avec le masquage « Ranger / Importer » pour le lecteur ; preuve SC-A11Y-01/02 verts en Docker + grep sans reste.
- 22:44 — orchestrateur : spec P8 écran livrée par innovateur → gestion-projet/innovateur/spec-validation-cycle-ui.md (PR fix/validation-cycle-ui). Écarts Vérifié : ValidationHub.tsx:36 lit step.document_version_id ?? step.current_version_id (inexistants dans /pending) → item.document?.current_version_id (nullable → boutons désactivés) ; DraftWorkspace.tsx:25/246 getUsers + filtre role_id !== 5 en dur → GET /workflows/validators (à ajouter dans workflows.api.ts + services/index.ts) ; ValidationHub:23/37/43 confirm natif, commentaire en dur, alert → modale « Motif du rejet » (label Motif, Confirmer inactif si vide), erreurs via le bus ; WorkflowTasks.tsx:31 validateWorkflowStep (action_type approve sans version) → submitWorkflowAction puis suppression. Spec SC-VAL-01 : sélection par value = manager.id (pas l option MGR001), aria-label « Valideur » sur le select ; autres sélecteurs à respecter ; SC-VAL-04 reste fixme. Lien « Ouvrir le document » = GET /documents/{id}/content?disposition=inline. Ordre : mar 10 codable sans #51 (/validators 404 local → état vide), mer 11 rebase après fusion #51 + spec dans la même PR, jeu 12 run P8 avec ci-qa. Budget 0,45 j F.
- 23:16 — orchestrateur : règle e2e issue du run ci-qa (full-cycle vert 9/9) : jamais waitForLoadState(networkidle) (n aboutit jamais sur /tasks, suspect WebSocket notifications) ; un parcours à plusieurs connexions + upload prend test.slow(). À appliquer à SC-VAL-01 et à la P8 dans #48 (full-cycle.spec.ts y est supprimé au rebase, la version stabilisée vit dans PR 2a de ci-qa). Rapport HTML a11y intact dans ../GED237-e2e/frontend/e2e-out/playwright-report.

## 2026-11-10 08:25 — consignes de relance 10/11 (innovateur, à la demande de l'orchestrateur)
- **Base** : `main` 97e4ea1 (11 fusions de la nuit : #39, #45, #47, #49, #50, #51, #52, #53, #54, #55, #58, #59, #60). Repartir d'une branche neuve depuis `main`.
- **Ordre inchangé** : (1) `fix/validation-cycle-ui` (spec `gestion-projet/innovateur/spec-validation-cycle-ui.md`, 0,45 j) → (2) `fix/recette-smoke-2` (SMK-10 lecteur + a11y `spec-a11y-contrast.md`, retirer les `fixme` SMK-01/02/10) → (3) rebase #48 sur `main` (supprimer `full-cycle.spec.ts`, `FilePayload` local, code `MINISTRY` dans le manifeste) → (4) `SpacesPage` filtres serveur mar 17 (`spec-espaces-filtres-ui.md`).
- **Contrat P8 fusionné (#51, Vérifié sur main)** : `GET /workflows/validators` → `[{id, full_name}]` (rôles `manager` + `tenant_admin`, actifs, tenant courant ; 403 sans `documents:create`) ; `GET /workflows/pending` → `document.current_version_id` nullable (`schemas/workflow.py:51`) ; `POST /workflows/step/{id}/actions` = `WorkflowActionCreate` {`action_type` ∈ read_ack|visa|approval|final_signature, `outcome` ∈ accepted|acknowledged|rejected|returned, `document_version_id` UUID obligatoire, `comment` optionnel} (`schemas/workflow.py:87-93`). `validateWorkflowStep` (`action_type: 'approve'`) est invalide : à retirer.
- **Pile e2e** : `scripts/e2e_reset.sh [profil]` = `alembic upgrade head` → `seed_db.py` → `seed_e2e.py --profile` (#59) ; `create_all` retiré hors tests (#60) ; compose e2e à la racine (`docker-compose.e2e.yml`), image Playwright `v1.64.1-noble` épinglée (ne pas bumper `@playwright/test`, #56 reportée après le 30/11).
- **Version** : `APP_VERSION` lu côté API (#58, `/health` renvoie `version`) ; côté front `VITE_APP_VERSION` **n'existe pas encore** : à créer (D6, `release-demo.md` § 4), affichage discret dans l'UI, hors des PR (1)-(3).
- **Règles Docker** : build, lint, tsc, e2e uniquement en conteneur ; **une seule charge lourde à la fois**, annoncée à ci-qa avant lancement (suites e2e) ; conteneurs bornés en RAM/CPU. Jamais `waitForLoadState('networkidle')` (règle du 09/11 23:16).
- Mots de passe : jamais dans les fiches ni les PR (rôle + identifiant seulement).
