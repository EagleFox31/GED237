# Matrice de recette — 8 parcours de démo × scénarios UAT (table de vérité du 14/11 et du 30/11)

- **Pour** : PO (lecture le 14/11), orchestrateur (remplit « Constaté » et prononce le verdict), Q/F/B (chaque ligne a un responsable). Instruite par l'innovateur le 2026-11-09 20:05, **sans exécuter aucun test**.
- **Niveaux** : `Vérifié` = fichier lu ce jour (chemin:ligne, PR) ; `Constaté` = observé dans une passation ou un run sans que j'aie reproduit ; `Déduit` ; `Proposé`.
- **Règle de verdict** (reprise du point S1) : un scénario est **GO** seulement avec une preuve `e2e réel` ou `API` verte, datée, sur la pile Docker e2e (`ci/e2e-smoke`, #39) et sur `main`. `Manuelle` = GO **conditionnel** (recevable pour la démo, noté comme écart de preuve). Une spec `skip`/`fixme`/`mock` ne prouve rien.
- **Sources réutilisées, non refaites** : audit fonctionnel du 09/11 (ligne 2 et § « Relevé des IDs » : 25 specs, 12 avec `skip`, 4 sur `mockAuth`, IDs désalignés, dernier run `failed`), `MATRICE_UAT_E2E_2026-07-22.md` (37 scénarios, collisions RED-04/05, SEC-01/02), `parcours-demo.md` § 2 et § 4, DEC-2026-002 § 3, passations dev-frontend et ci-qa du 09/11.

## 1. Lecture rapide

| | Scénarios | GO possible avant le 24/11 par e2e réel | Par API seule | Manuelle seulement | **Aucune preuve possible avant le 24** |
|---|---|---|---|---|---|
| Total 8 parcours | **22** | 15 | 3 | 2 | **2** (SC-AUD-02 export, SC-ESP pagination si D2 la sacrifie) |

État des specs au 09/11 (`Vérifié`) : sur `main`, 25 specs, 12 avec `skip`, 4 sur `mockAuth` (`classification-admin`, `classification-reviews`, `ingestion`, `spaces`), `frontend/test-results/.last-run.json` = `failed` (6 tests). Dans le worktree de dev-frontend (branche locale `test/uat-playwright`, **non poussée**, 24e8f64), un dossier `frontend/e2e/specs/uat/` de **6 specs réelles** (18 tests, 4 `fixme`) couvre P1, P2, P3, P4, P6, P7 ; `audit.spec.ts` et `auditor-export.spec.ts` y sont supprimés. P5 et P8 n'ont **aucune spec réelle** écrite ce soir. Projet Playwright `smoke` (#39) = `auth`, `security-isolation`, `documents`, `full-cycle`, `a11y` ; les autres projets ignorent `specs/uat/`.

Écarts du second smoke (`Constaté`, identifiants **SMK-01 à SMK-10** posés par Q dans `PASSATION-ci-qa.md`, repris tels quels dans la colonne État) : B = SMK-04/05/10 (PR **#47** `fix/authz-collaborator`) ; F = SMK-01/02/06/07 et part front de SMK-10 (PR **#45** `fix/recette-smoke-1`) ; Q = SMK-08 (PR 2 seed) ; SMK-03 et SMK-09 clos. Garde de routes (`spec-garde-routes.md`) : PR **#46**. Les trois PR sont ouvertes le 09/11 au soir, non fusionnées.

## 2. Matrice

Colonnes : **ID UAT** (guide de test / matrice de juillet ; `—` = critère CDC sans ID, `nouveau` = ID créé par F) · **Spec Playwright** (fichier, état : `réelle` / `skip` / `fixme` / `mock` / `absente`) · **Preuve attendue** (`e2e réel` / `API` = pytest ou `request` Playwright / `manuelle`) · **Resp.** · **État 09/11** · **Cible**.

### P1 — Connexion, OTP, déconnexion (rôle collab)

| Scénario | ID UAT | Spec (état) | Preuve | Resp. | État 09/11 | Cible |
|---|---|---|---|---|---|---|
| Connexion e-mail + mot de passe + OTP, arrivée sur le tableau de bord du profil | SC-AUTH-01 | `auth.spec.ts` (réelle, `main`, 9 tests, dans `smoke`) ; `uat/auth-2fa.spec.ts` (réelle, worktree F) | e2e réel | F | `Constaté` : 4 tests auth verts au smoke 1 (passation Q 18:54) ; D5 corrigé par #41 fusionnée 19:06 ; **SMK-01** a11y connexion (`select-name` critical, `color-contrast`) et **SMK-02** a11y tableau de bord → F, PR #45 `fix/recette-smoke-1` | mar 11 |
| OTP erroné → message, pas de session | SC-AUTH-02 (**sens UAT juillet = refresh silencieux** : collision à acter, F a réutilisé l'ID pour « OTP erroné ») | `uat/auth-2fa.spec.ts` (réelle, 1 des 3 `fixme` ? `Déduit`) | e2e réel | F | `Vérifié` : spec écrite, run uat 1 lancé 19:29, résultat inconnu | mar 11 |
| Déconnexion → `/login`, jeton blacklisté (retour arrière bloqué) | SC-AUTH-03 | `uat/auth-2fa.spec.ts` | e2e réel + API (`GET /documents` avec l'ancien jeton → 401) | F | `Vérifié` : spec écrite ; backend `test_auth.py` (4) ne couvre pas le logout (audit ligne 9) | mar 11 |
| Rafraîchir la page : session conservée | — (critère P1 étape 5) | `uat/auth-2fa.spec.ts` (`Déduit`) | e2e réel | F | `Vérifié` : `sessionStorage` relu au chargement (`authStore.ts:147`) | mar 11 |

### P2 — Import d'un dossier et classement automatique (admin puis collab)

| Scénario | ID UAT | Spec (état) | Preuve | Resp. | État 09/11 | Cible |
|---|---|---|---|---|---|---|
| Règle active visible dans `/rules` avec priorité | SC-ADM-05 (partiel) | `rules-setup.spec.ts` (1 `skip` conditionnel, projet `authed-chromium`) | e2e réel | F | `Vérifié` : spec existe, `skip` si pré-requis absent | mer 12 |
| Import du dossier de démo : compteurs importés / doublons / en attente | SC-ADM-08 | `ingestion.spec.ts` (**mock**, `main`) → `uat/directory-import.spec.ts` (réelle, 1 test) | e2e réel | F + Q (dossier monté dans le conteneur api : `/ingest-directory` lit un chemin **serveur**) | `Vérifié` : spec réelle écrite ; montage **tranché O 09/11** : `/data/ingest` en lecture seule dans les deux compose, `INGEST_ALLOWED_ROOTS=/data/ingest` (PR 2a Q + compose B, `spec-limite-upload.md` § 5) ; la spec doit viser ce chemin | mer 12 |
| Documents rangés dans l'arborescence attendue (`/spaces`) | SC-E2E-01 (chaîne import → classement) | `full-cycle.spec.ts` (réelle mais sens « cycle de validation », dans `smoke`) ; vérification dans `uat/directory-import.spec.ts` (`Déduit`) | e2e réel | F | `Constaté` : **SMK-09** `full-cycle` (`sessionStorage` avant navigation) clos, remplacé par `uat/validation-cycle.spec.ts` dans le `testMatch` `smoke` | jeu 13 |
| Ré-import du même dossier → tous refusés comme doublons | — (candidat 12 intégré, étape 8) | aucune (`absente`) ; `bulk-upload.spec.ts` (2 `skip`, dépend d'un corpus local `CORPUS_ROOT`) | API (`test_imports.py` si présent : `À vérifier` B) sinon manuelle | B/F | `Déduit` : hash SHA-256 au stockage (`storage/local.py`), refus de doublon côté API non relu ce soir | jeu 13 |
| Dépôt unitaire par le rédacteur | SC-RED-01 | `documents.spec.ts` (réelle, 15 tests, dans `smoke`) | e2e réel | F | `Constaté` smoke 2 : **SMK-04** upload collaborateur 403 et **SMK-05** soumission au visa (policy `standard` vs seed `collaborator`) → B, PR #47 `fix/authz-collaborator` ; **SMK-06/07** modale hors écran 1280×720 → F, PR #45 `fix/recette-smoke-1` ; **SMK-08** seed sans catégorie → Q, PR 2 seed ; **SMK-03** onglet historique clos (`6ddad06`) | mar 11 |

### P3 — Simuler une règle avant activation (admin)

| Scénario | ID UAT | Spec (état) | Preuve | Resp. | État 09/11 | Cible |
|---|---|---|---|---|---|---|
| Créer une règle (condition + action) | SC-ADM-05 | `rules.spec.ts` (3 `skip`, `main`) → `uat/rule-classification.spec.ts` (réelle, 1 test) | e2e réel | F | `Vérifié` : F confirme que l'UI appelle `/classification-rules/simulate` (passation F) | mer 12 |
| Simuler : tableau avant / après, aucun déplacement tant que non activée | SC-ADM-06 (**sens UAT juillet = circuit de validation** : collision, à acter) | `classification-admin.spec.ts` (**mock**) → `uat/rule-classification.spec.ts` | e2e réel | F | `Vérifié` : spec réelle écrite | mer 12 |
| Activer puis « Relancer le workflow » sur un document à revoir → nouvelle destination | — (P3 étape 7) | aucune spec dédiée (`absente`) | manuelle (ou ajout dans `manual-review`) | F | `Vérifié` : bouton dans `ClassificationReviewPage` | jeu 20 (jeu de démo) |

### P4 — Espaces : parcourir, filtrer, paginer (manager) — Lot C9

| Scénario | ID UAT | Spec (état) | Preuve | Resp. | État 09/11 | Cible |
|---|---|---|---|---|---|---|
| Arbre service → domaine → activité → année, ouverture d'un document, téléchargement | SC-LEC-02, SC-VAL-03 (**sens UAT juillet = rejet avec motif** : collision) | `spaces.spec.ts` (**mock**) → `uat/spaces-filters.spec.ts` (réelle, 4 tests, ID **nouveau `SC-ESP-01`**) ; `reader-signed.spec.ts` (1 `skip` « aucun document accessible au lecteur ») | e2e réel | F | `Vérifié` : commit 34b4db2 « enable spaces server-side filter checks now that #38 is merged » | ven 14 (navigation) |
| Filtres serveur domaine / activité / année / statuts, compteur cohérent | — (critère CDC « arborescence », ordre 4) | `uat/spaces-filters.spec.ts` ; UI à brancher (`spec-espaces-filtres-ui.md`) | e2e réel + API (`test_spaces_filters.py`, 16 tests, #38 fusionnée) | B (fait) / F | **API `Vérifié` GO** ; UI absente jusqu'au 17/11. Précision F (09/11) : `uat/spaces-filters` teste aujourd'hui la **navigation** de la SpacesPage actuelle (arborescence, sous-service et retour, inclusion des sous-services, recherche `?q=` et bouton Effacer) et le **contrat C9 directement sur l'API** (`domain`/`activity`/`year`, `q` + `limit`/`offset` + `X-Total-Count`, `classification_status`, 422), **pas encore les filtres UI** : à compléter quand la PR UI du 17 arrive | lun 17 |
| Pagination serveur (une requête par page) | — (ordre 4, partie sacrifiable D2) | aucune (SPF-05 `Proposé` dans la spec UI) | e2e réel | F | `Proposé` ; API prête (`limit`/`offset`, `X-Total-Count`) | lun 17 ou **sacrifiée** |

### P5 — Recherche bornée au service, corbeille exclue, isolation tenant (collab puis reader)

| Scénario | ID UAT | Spec (état) | Preuve | Resp. | État 09/11 | Cible |
|---|---|---|---|---|---|---|
| Recherche plein texte, `took_ms` affiché, ouverture d'un résultat | SC-LEC-01, SC-RED-05 (**collision** : RED-05 juillet = « supprimer brouillon », e2e actuel = recherche) | `redacteur.spec.ts:137` (`skip` « champ de recherche absent ») ; **aucune spec réelle** | e2e réel | F | `Vérifié` : `Header.tsx` porte la recherche ; spec à créer (`search-scope.spec.ts`, parcours-demo) | jeu 13 |
| Document mis en corbeille → absent des résultats | — (ordre 1) | absente | API (`test_search_scope.py`, **PR #42 ouverte**, checks en cours) + e2e réel | B / F | `Vérifié` : #42 contient `postgres_engine.py`, `test_search_scope.py` ; non fusionnée | mar 11 (B) / jeu 13 (F) |
| Lecteur DSI : aucun document DAF dans les résultats | SC-SEC-01 (**collision** : e2e actuel = « rédacteur GET /authz/policies → 403 », `security-isolation.spec.ts:22`) | `security-isolation.spec.ts` (réelle, 4 tests, dans `smoke`, **mauvais sens**) | API (#42) + e2e réel | B / F | `Vérifié` : faille documentée (DEC-002 ordre 1) ; correctif dans #42 | jeu 13 |
| Isolation tenant : terme MINESUP introuvable depuis MINFI | SC-SEC-02 (**collision** : e2e actuel = « lecteur sans upload ») | idem | API (#42, `test_search_scope.py`) | B | idem (SMK-10 déplacé sur la ligne SC-SEC-03/04 de P7 : il porte sur les droits du lecteur, pas sur l'isolation tenant) | jeu 13 |

### P6 — Revue manuelle d'un document non classé (manager/admin)

| Scénario | ID UAT | Spec (état) | Preuve | Resp. | État 09/11 | Cible |
|---|---|---|---|---|---|---|
| Liste « à revoir » avec raison, choix service/domaine/activité/année, « Résoudre », document visible à destination | SC-ADM-07 (`SC-ADM-REVIEW` dans `needs-review.spec.ts` : à renommer) | `needs-review.spec.ts` (réelle, projet `authed-chromium`) ; `classification-reviews.spec.ts` (**mock**) → `uat/manual-review.spec.ts` (réelle, 1 test) | e2e réel | F | `Vérifié` : spec réelle écrite ; dépend des 2 fichiers hors règle importés en P2 (ordre d'exécution à déclarer) | mer 12 |
| Compteur « à classer » décrémenté, entrée d'audit créée | — | couvert par `uat/manual-review` + `uat/audit-trail` (`Déduit`) | e2e réel | F | idem | mer 12 |

### P7 — Journal d'audit (auditor)

| Scénario | ID UAT | Spec (état) | Preuve | Resp. | État 09/11 | Cible |
|---|---|---|---|---|---|---|
| `/audit` : filtrer par agent et par jour, retrouver revue et corbeille | SC-AUD-01 | `audit.spec.ts` (réelle, `main`, 3 tests ; **supprimée** dans le worktree F) → `uat/audit-trail.spec.ts` (réelle, 3 tests, 1 `fixme`) | e2e réel | F | `Vérifié` : spec écrite ; `fixme` = traces connexion/dépôt/import en attente du correctif B (D3, mer 12) | mer 12 (B) → jeu 13 (F) |
| Connexion, dépôt, import tracés (D3) | SC-ADM-09 (ID utilisé par F dans `audit-trail`) | `uat/audit-trail.spec.ts` (`fixme`) | e2e réel | B puis F | `Vérifié` : B4 du point S1 | mer 12 |
| Export du journal | SC-AUD-02 | `auditor-export.spec.ts` (`skip:24` « bouton Exporter absent » ; supprimée dans le worktree F) | — | — | **Aucune preuve possible : reporté V1.1 (D4, écart 8).** Ligne conservée pour que le PO voie le retrait | V1.1 |
| Auditeur : écriture refusée (403 visible) | SC-SEC-03/04 (sens e2e actuel) | `security-isolation.spec.ts` (réelle) | e2e réel | F | `Constaté` smoke 2 : **SMK-10** le reader voit « Nouveau Document », `GET /tenants/{id}` et `GET /categories/` en 403 font perdre les documents (`Promise.all`) → B (#47) et F (#45) ; garde de routes PR #46 (`GUARD-01..06`, critère C4) | mar 11 (SMK-10) / ven 14 |

### P8 — Cycle de validation (variante retenue le 09/11 : visa, rejet, retour ; manager MGR001)

DEC-2026-002 acceptée (passation F 18:08) : P8 = **cycle de validation**, les variantes corbeille/restauration et version/verrou de `parcours-demo.md` deviennent **API seule** (aucun bouton UI, `Vérifié` ce matin).

| Scénario | ID UAT | Spec (état) | Preuve | Resp. | État 09/11 | Cible |
|---|---|---|---|---|---|---|
| Soumettre → visa manager → signature (circuit `E2E-WF-VALID`) | SC-VAL-01, SC-VAL-02 | `validation.spec.ts` (supprimée), `workflow.spec.ts` (supprimée), `full-cycle.spec.ts` (supprimée, remplacée par `validation-cycle` dans le `smoke`), `workflow.page.ts` supprimé → **`uat/validation-cycle.spec.ts`** | e2e réel | Q (seed PR 2 : circuit + 3 tâches `E2E-VAL-*`) puis F | **`Absente`** ; dépend de la PR 2 seed de Q (engagement 18:10 ; repli : soumission via API dans la spec). **P8 non jouable à l'écran au 09/11** (3 défauts vérifiés F + O) : **VAL-D1** choix du manager via `GET /users` interdit au collaborateur → `GET /workflows/validators` (B) ; **VAL-D2 bloquant** `GET /workflows/pending` sans `current_version_id` → Viser/Rejeter 422, et `WorkflowTasks` envoie `approve` hors enum `ActionType` → champ ajouté côté B, front aligné. B mar 10 PR `fix/workflow-pending-validators` (0,25 j), F mer 11 PR `fix/validation-cycle-ui` (0,45 j), e2e jeu 12 ; **≈ 0,7 j-p non prévus** (budget du 24) | jeu 12 (e2e) / repli manuel si pas vert le 13 |
| Rejeter avec motif | SC-VAL-03 | idem | e2e réel | Q / F | idem ; **VAL-D3** : aucun motif saisissable au 09/11 → motif sur « Rejeter » dans `fix/validation-cycle-ui` | jeu 12 |
| Retour à l'écran du rédacteur, notification | SC-VAL-04 (+ `notifications.spec.ts`, 2 `skip`) | idem | e2e réel | F | idem ; **« Retourner pour correction » → V1.1** (VAL-D3, écart 17) : la ligne se réduit à « le rédacteur voit le statut Visé/Rejeté et le motif » | jeu 12 |
| Corbeille → restauration (ex-variante A) | SC-RED-05/06 (collision RED-05) | aucune | **API** (`test_documents.py` : `À vérifier` B) | B | `Vérifié` : routes `trash`/`restore` existent, UI absente → **annoncé** (écart « cycle de vie manuel », plan § 3 n° 9) | pytest existant |
| Nouvelle version + verrou (ex-variante B) | SC-RED-04 (collision : `redacteur.spec.ts:60` `skip` « bouton absent ») | aucune réelle | **API** | B | idem ; onglet « Historique des versions » existe en lecture (`document-detail.page.ts`, #39) | pytest existant |

## 3. Scénarios sans preuve possible avant le 24/11 (entrée de D2)

| Scénario | Pourquoi | Conséquence pour la démo | Proposition |
|---|---|---|---|
| SC-AUD-02 export du journal | fonction absente de l'UI, reportée V1.1 (D4) | le jury ne la voit pas ; écart 8 déjà formulé | **retirer de la matrice de verdict**, garder la ligne barrée |
| Pagination P4 | UI non livrée avant le 17 ; **premier sacrifice prévu par D2** (après garde de routes et sauvegarde automatisée) | la démo montre les filtres sans page 2 ; corpus de démo < 200 documents par service suffit pour que « tout » tienne sans `limit` | décision le 14/11 : si F est à l'heure sur les 8 parcours, garder ; sinon sacrifier **sans** toucher au reste de P4 |
| P8 validation si la PR 2 seed de Q n'est pas fusionnée le 12 | la spec n'a rien à viser ; repli API dans la spec = 0,25 j F de plus | P8 passerait en **manuelle** (démonstration à la main sur un circuit créé la veille) | alerte PO le 14 si `E2E-WF-VALID` absent du manifeste |
| P5 e2e si #42 glisse après le 13 | la recherche bornée n'existe pas encore sur `main` | SC-SEC-01/02 prouvés par **pytest seul** (`test_search_scope.py`), parcours démontré manuellement | acceptable pour le 14 ; e2e réel exigé pour le GO du 21 |
| Ré-import = doublons (P2 étape 8) | aucune spec ; dépend d'un test backend non relu | manuelle | ligne `manuelle` assumée, 0 j |

## 4. Collisions d'ID à acter une fois pour toutes (F, PR `test/uat-playwright`)

Les IDs ci-dessous portent **deux sens** (guide UAT de juillet vs specs). La règle proposée : **le sens de la démo gagne**, l'ancien sens est renommé avec suffixe, et `MATRICE_UAT_E2E_2026-07-22.md` reçoit une note « remplacée par `innovateur/matrice-recette.md` le 2026-11-14 ». Sans cela, le PO lira deux tableaux contradictoires le 14.

| ID | Sens juillet | Sens démo retenu | Action |
|---|---|---|---|
| SC-AUTH-02 | refresh silencieux | OTP erroné | ancien → `SC-AUTH-02b` (non démontré) |
| SC-ADM-06 | circuit de validation | simulation de règle | ancien → couvert par SC-VAL-01 |
| SC-VAL-03 | rejet avec motif | consultation manager (P4) **et** rejet (P8) | garder « rejet avec motif » pour P8 ; P4 ne cite que SC-LEC-02 + `SC-ESP-01` |
| SC-RED-04 / 05 | version / supprimer brouillon | version (API) / recherche rédacteur | RED-05 recherche → fusionner dans SC-LEC-01 ; RED-05 reste « corbeille » (API) |
| SC-SEC-01 / 02 | isolation cross-tenant / séparation des pouvoirs | cloisonnement service / cloisonnement tenant | les tests « 403 policies » et « lecteur sans upload » actuels → `SC-SEC-03`/`04` (déjà présents dans la spec) |
| SC-SEC-03a / 03b / 04a / 04b | — | déclinaisons de SC-SEC-03/04 portées par `security-isolation` (#48, Q, constat 09/11) | **ajouter** tels quels ; la ligne SC-SEC-03/04 de § 2 cite #48 en plus de SMK-10 et #46 |
| SC-E2E-01 | chaîne import → classement (`full-cycle`) | **couvert par SC-VAL-01** : `full-cycle.spec.ts` supprimée, remplacée par `validation-cycle` dans le `smoke` (09/11) | ne plus citer comme spec propre ; P2 garde SC-ADM-08 + SC-RED-01 comme preuves |
| `SC-ADM-REVIEW`, `SC-ADM-RULES`, `SC-E2E-BULK` | IDs libres | SC-ADM-07, SC-ADM-05, (supprimé) | renommer |

## 5. Ce que le PO doit voir le 14/11 (`Proposé`)

1. Cette matrice avec la colonne **État** remplie par O (`Vérifié` + lien run / `Constaté` / `Absent`) : objectif S1 = **toutes les lignes P1, P2, P3, P6, P7 en e2e réel vert** sur la pile Docker, **P4 navigation** vert, **P5 API** vert (#42 fusionnée), **P8** vert ou `Absent` avec repli décidé.
2. Le § 3 relu : chaque ligne « aucune preuve » a soit une décision (sacrifice, V1.1), soit une date.
3. Le nombre de specs `skip`/`mock` restantes dans `frontend/e2e/specs/` **sur `main`** (objectif au 21/11 : zéro `mock`, `skip` seulement conditionnel au seed) : un `grep -c` suffit, Q le fournit.

## Sources

- `gestion-projet/walkthrough/[Audit] Audit fonctionnel profond - 2026-11-09.md` (l. 21, 51, 65-80, 88) ; `gestion-projet/MATRICE_UAT_E2E_2026-07-22.md` (l. 1-35, 49-51, 57-61, 69, 88-91, 107-119) ; `gestion-projet/innovateur/parcours-demo.md` § 2, § 4 ; DEC-2026-002 § 3 (l. 19, 31-37, 69).
- `frontend/e2e/specs/*.spec.ts` sur `main` a4b8dbe (comptage `test(`, `test.skip`, `mockAuth`, IDs `SC-*`), `frontend/test-results/.last-run.json` ; worktree `GED237-lotc-frontend` (branche `test/uat-playwright` 24e8f64) : `frontend/e2e/specs/uat/*.spec.ts`, `frontend/playwright.config.ts` (projets `smoke`, `authed-chromium`, `testIgnore` uat) ; PR #39 (`smoke` testMatch), #38 (fusionnée), #41 (fusionnée), #42 (ouverte).
- `PASSATION-dev-frontend.md` (entrées 18:04 → 19:29), `PASSATION-ci-qa.md` (18:54 → 19:33).
