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
