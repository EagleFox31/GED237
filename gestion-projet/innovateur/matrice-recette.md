# Matrice de recette — 8 parcours de démo × scénarios UAT (table de vérité du 14/11 et du 30/11)

- **Pour** : PO (lecture le 14/11), orchestrateur (remplit « Constaté » et prononce le verdict), Q/F/B (chaque ligne a un responsable). Instruite par l'innovateur le 2026-11-09 20:05, **sans exécuter aucun test**.
- **Niveaux** : `Vérifié` = fichier lu ce jour (chemin:ligne, PR) ; `Constaté` = observé dans une passation ou un run sans que j'aie reproduit ; `Déduit` ; `Proposé`.
- **Règle de verdict** (reprise du point S1) : un scénario est **GO** seulement avec une preuve `e2e réel` ou `API` verte, datée, sur la pile Docker e2e (`ci/e2e-smoke`, #39) et sur `main`. `Manuelle` = GO **conditionnel** (recevable pour la démo, noté comme écart de preuve). Une spec `skip`/`fixme`/`mock` ne prouve rien.
- **Sources réutilisées, non refaites** : audit fonctionnel du 09/11 (ligne 2 et § « Relevé des IDs » : 25 specs, 12 avec `skip`, 4 sur `mockAuth`, IDs désalignés, dernier run `failed`), `MATRICE_UAT_E2E_2026-07-22.md` (37 scénarios, collisions RED-04/05, SEC-01/02), `parcours-demo.md` § 2 et § 4, DEC-2026-002 § 3, passations dev-frontend et ci-qa du 09/11.

## 0. Mise à jour du 17/11 pour la recette du 20 au 23

- **Base** : `main` 33b2425, le 17/11 après-midi. Elle contient #188 (portée des rapports), #198 (entrées « Recherche » et « Accès & Permissions » retirées du menu admin, GUARD-07) et #200 (redémarrage automatique du frontend après un reboot de l'hôte). Relevé en lecture seule : `git grep` sur `origin/main`, `gh pr list` et `gh run list`. **Aucun test exécuté par l'innovateur.**
- **Dernière recette nocturne** (`e2e-uat-nightly.yml`, #130) : verte le 17/11 à 03:30 sur 31485c0. Ce SHA est **antérieur** à #188, #198 et #200 : Q relance la recette nocturne sur le SHA final avant le 20 (#158).
- **⚠ Lignes d'avant le 15/11** : toutes les cellules « État 09/11 » des § 1 à 3 datent du 09/11. Elles ne valent plus comme état. L'état à jour est le tableau ci-dessous. Une ligne absente du tableau garde son marquage ⚠ et doit être revérifiée avant d'être jouée.
- **mockAuth** : plus aucune spec ne l'utilise sur `main`. Les `skip` restants sont dans les anciennes specs hors `uat/` (`redacteur`, `super-admin`, `tenant-admin-config`, `unit-admin`, `notifications`, `rules`) ; ils ne comptent pas pour le verdict.

### 0.1 Limite de la rc.1 : code de connexion affiché

Le code à 6 chiffres n'est envoyé ni par SMS ni par e-mail. L'API le renvoie et l'écran le **pré-remplit**, car la pile tourne en `ENVIRONMENT: development` (`docker-compose.yml`, `auth_service.py` l. 121-122, `LoginPage.tsx` l. 139-140). Le cadre « Espace Démo Interactif » s'affiche toujours (`LoginPage.tsx` l. 365). Décision O du 17/11 : rien ne change pour la rc.1 ni pour la démo du 30. Après le 30, le lot ENVIRONMENT de B, empilé sur #154, et sa part front par F les masquent en production. **En recette** : constater ces deux éléments comme limite annoncée, pas comme anomalie. Ne pas écrire « OTP reçu ».

### 0.2 Hors rc.1 : PR gelées jusqu'après le 30

Ces fonctions ne sont **pas à recetter**. Une ligne qui en dépend est marquée « hors rc.1 ».

| Fonction | PR gelées | Ce qui existe sur `main` |
|---|---|---|
| Corbeille à l'écran, restauration, annulation d'une suppression ou d'un déplacement | #152, #181, #179, #182, #184 (e2e #168) | routes API `trash` / `restore` seulement ; aucun bouton « supprimer » dans l'UI |
| Numérotation des rapports officiels | #161 (PDF #197) | rapports sans numéro (« Générer un rapport » : PDF, Excel, CSV) |
| Envoi du code par e-mail, renvoi du code | #154 (e2e #172) | code pré-rempli (§ 0.1) |
| Application d'authentification (TOTP) | #193, DEC-2026-004 | aucun |
| Hors liste d'O, gelées aussi | vue doublons #171 / #199 ; portée `unit_admin` #195 / #203 ; #196 | tuile « Doublons refusés » seulement ; portée `unit_admin` actuelle |

### 0.3 État par ligne sur `main` au 17/11

| Parcours | Scénario (ID) | État sur `main` | Preuve sur `main` | À faire par Q pendant la recette |
|---|---|---|---|---|
| P1 | Connexion 2FA (SC-AUTH-01) | Livré, **avec la limite § 0.1** | `uat/auth-2fa.spec.ts` : séquence principale, E1, E2 réelles | constater code pré-rempli et cadre démo comme limite |
| P1 | 3 codes faux → compte verrouillé 15 min (SC-AUTH-01 E3, SC-V11-03 partie OTP) | Livré : #83 (API, 3 essais, 900 s), #88 (écran 423 avec compte à rebours) | **aucune** : `auth-2fa.spec.ts:83` en `fixme` avec un motif périmé ; SC-V11-03 en `fixme` | lever le `fixme` ou prouver à la main **sur un compte dédié** (le verrou bloque le compte 15 min) |
| P1 | Code faux → message, nouvelle saisie (SC-AUTH-02 sens démo) | Livré | `auth-2fa` E2 réelle | — |
| P1 | Refresh silencieux, reprise de la page quittée (#97, #123, #140) | Livré | `auth-2fa` l. 113-181 réelles | — |
| P1 | Déconnexion (SC-AUTH-03) | Livré | `auth-2fa` l. 192 réelle | — |
| P1 | Accessibilité connexion et tableau de bord (SC-A11Y-01/02) | Livré : #45, #73 | `a11y.spec.ts` sans `fixme` (smoke) | — |
| P2 | Import de dossier, racines autorisées (SC-ADM-08, SC-SEC-05) | Livré : #53, #55, #59 | `uat/directory-import` (1 test) ; pytest #53 | rejouer un chemin hors racine depuis l'UI |
| P2 | Ré-import = doublons refusés, tuile « Doublons refusés » (SC-V11-01) | Livré : #77, #81, #99 | **`fixme`** `v11-lots.spec.ts:13` | lever le `fixme` ou preuve manuelle |
| P2 | Export / import des règles (SC-V11-02) | Livré : #79, #84 | `v11-lots` SC-V11-02 réelle (#91) | — |
| P2 | Dépôt unitaire (SC-RED-01) | Livré : #45, #47, #52 | `documents.spec.ts` (smoke) | — |
| P3 | Créer, simuler, activer une règle (SC-ADM-05/06) | Livré | `uat/rule-classification` (1), `uat/classification-admin` (2) | « Relancer le workflow » reste manuel ⚠ |
| P3 | Critères contenu OCR et année (SC-V11-04) | Livré : #92, #95 | **`fixme`** `v11-lots.spec.ts:98` | lever le `fixme` (prévu à la fusion de #92) |
| P4 | Arbre, filtres serveur, pagination (C9) | Livré : #38, #78 ; explorateur clavier et clic droit #164, #173 | `uat/spaces-filters` (4, pagination **par l'API**), `uat/spaces-keyboard`, `uat/spaces-context-menu` | pagination à l'écran : preuve manuelle (page 2) |
| P5 | Recherche bornée au service et au tenant (SC-LEC-01, SC-SEC-01/02) | Livré : #42 ; saisie rapide #174 | pytest `test_search_scope.py` ; `uat/header-search-typing` | — |
| P5 | Document en corbeille absent des résultats | Exclusion **livrée côté API** (#42) ; mise en corbeille à l'écran **hors rc.1** | pytest #42 seulement | ne pas jouer à l'écran |
| P6 | Revue manuelle d'un document à classer (SC-ADM-07) | Livré | `uat/manual-review` (1) ; jeu de démo : 51 à revoir (#128) | — |
| P7 | Journal filtré, connexions, dépôts, imports tracés (SC-AUD-01, SC-ADM-09 / D3) | Livré : #98 ; `fixme` levés par #108 | `uat/audit-trail` (3) | — |
| P7 | Export du journal (SC-AUD-02) | **Livré** (était « V1.1 ») : #80 (API), #87 (« Exporter (CSV) ») ; **un utilisateur à la fois** | `uat/audit-export` (1) réelle ; doublon SC-V11-03 en `fixme` | constater la limite « un utilisateur à la fois » |
| P7 | Lecteur et auditeur sans écriture, routes admin gardées (SC-SEC-03/04, C4) | Livré : #46, #47, #48 ; menu admin nettoyé #198 (GUARD-07) | `security-isolation` (smoke), garde de routes | — |
| P8 | Viser, valider, rejeter avec motif, statut visible au rédacteur (SC-VAL-01 à 04) | Livré : #51, #66, #69 ; données P8 #127 | `uat/validation-cycle` (5) | — |
| P8 | Corbeille → restauration (SC-RED-05/06) | **hors rc.1** à l'écran ; API seule | pytest ⚠ (non relu depuis le 09/11) | ne pas jouer à l'écran |
| P8 | Nouvelle version + verrou (SC-RED-04) | API seule, inchangé depuis le 09/11 ⚠ | pytest ⚠ | — |
| Rapports | Manager limité à son service, compteurs bornés (#175, #177, #188) | Livré | `uat/manager-reports` (3) | vérifier un manager de chaque service démo |
| Surveillance | Dossier surveillé importé par le worker, état affiché (SC-V11-05) | Livré : #100, #101 | **`fixme`** `v11-lots.spec.ts:100` | lever le `fixme` ou preuve manuelle |
| Exploitation | Frontend redémarré après un reboot de l'hôte (#200) | Livré | pytest `test_compose_restart_policy.py` | à observer pendant la sonde C6 |

## 1. Lecture rapide

| | Scénarios | GO possible avant le 24/11 par e2e réel | Par API seule | Manuelle seulement | **Aucune preuve possible avant le 24** |
|---|---|---|---|---|---|
| Total 8 parcours | **22** | 15 | 3 | 2 | **2** (SC-AUD-02 export, SC-ESP pagination si D2 la sacrifie) |
| ⚠ Ligne du 09/11. **Au 17/11** (§ 0.3) | | export et pagination livrés | corbeille et version : API seule | « Relancer le workflow », pagination à l'écran | **0 dans le périmètre rc.1** ; corbeille à l'écran hors rc.1 ; 4 `fixme` à lever (verrou OTP, SC-V11-01, -04, -05) |

État des specs au 09/11 (`Vérifié`) : sur `main`, 25 specs, 12 avec `skip`, 4 sur `mockAuth` (`classification-admin`, `classification-reviews`, `ingestion`, `spaces`), `frontend/test-results/.last-run.json` = `failed` (6 tests). Dans le worktree de dev-frontend (branche locale `test/uat-playwright`, **non poussée**, 24e8f64), un dossier `frontend/e2e/specs/uat/` de **6 specs réelles** (18 tests, 4 `fixme`) couvre P1, P2, P3, P4, P6, P7 ; `audit.spec.ts` et `auditor-export.spec.ts` y sont supprimés. P5 et P8 n'ont **aucune spec réelle** écrite ce soir. Projet Playwright `smoke` (#39) = `auth`, `security-isolation`, `documents`, `full-cycle`, `a11y` ; les autres projets ignorent `specs/uat/`.

Écarts du second smoke (`Constaté`, identifiants **SMK-01 à SMK-10** posés par Q dans `PASSATION-ci-qa.md`, repris tels quels dans la colonne État) : B = SMK-04/05/10 (PR **#47** `fix/authz-collaborator`) ; F = SMK-01/02/06/07 et part front de SMK-10 (PR **#45** `fix/recette-smoke-1`) ; Q = SMK-08 (PR 2 seed) ; SMK-03 et SMK-09 clos. Garde de routes (`spec-garde-routes.md`) : PR **#46**. Les trois PR sont ouvertes le 09/11 au soir, non fusionnées.

## 2. Matrice

Colonnes : **ID UAT** (guide de test / matrice de juillet ; `—` = critère CDC sans ID, `nouveau` = ID créé par F) · **Spec Playwright** (fichier, état : `réelle` / `skip` / `fixme` / `mock` / `absente`) · **Preuve attendue** (`e2e réel` / `API` = pytest ou `request` Playwright / `manuelle`) · **Resp.** · **État 09/11** · **Cible**.

### P1 — Connexion, OTP, déconnexion (rôle collab)

| Scénario | ID UAT | Spec (état) | Preuve | Resp. | État 09/11 ⚠ (avant le 15/11, voir § 0.3) | Cible |
|---|---|---|---|---|---|---|
| Connexion e-mail + mot de passe + OTP, arrivée sur le tableau de bord du profil (rc.1 : code pré-rempli, non reçu, § 0.1) | SC-AUTH-01 | `auth.spec.ts` (réelle, `main`, 9 tests, dans `smoke`) ; `uat/auth-2fa.spec.ts` (réelle, worktree F) | e2e réel | F | `Constaté` : 4 tests auth verts au smoke 1 (passation Q 18:54) ; D5 corrigé par #41 fusionnée 19:06 ; **SMK-01** a11y connexion (`select-name` critical, `color-contrast`) et **SMK-02** a11y tableau de bord → F, PR #45 `fix/recette-smoke-1` | mer 11 |
| Connexion et tableau de bord sans violation axe `serious`/`critical` (`color-contrast`, `select-name` sur `#institution`) | SC-A11Y-01, SC-A11Y-02 | `a11y.spec.ts:30,35` (réelle, `smoke`, #39 : `fixme` SMK-01/02) | e2e réel | F | **À livrer** : PR F `fix/recette-smoke-2` (jeu de remplacement de `spec-a11y-contrast.md` § 2) ; `fixme` retirés dans la même PR ; si #45 lève déjà l'un des deux, l'état bascule à sa fusion (`Déduit`) | mer 11 |
| OTP erroné → message, pas de session | SC-AUTH-02 (**sens UAT juillet = refresh silencieux** : collision à acter, F a réutilisé l'ID pour « OTP erroné ») | `uat/auth-2fa.spec.ts` (réelle, 1 des 3 `fixme` ? `Déduit`) | e2e réel | F | `Vérifié` : spec écrite, run uat 1 lancé 19:29, résultat inconnu | mer 11 |
| Déconnexion → `/login`, jeton blacklisté (retour arrière bloqué) | SC-AUTH-03 | `uat/auth-2fa.spec.ts` | e2e réel + API (`GET /documents` avec l'ancien jeton → 401) | F | `Vérifié` : spec écrite ; backend `test_auth.py` (4) ne couvre pas le logout (audit ligne 9) | mer 11 |
| Rafraîchir la page : session conservée | — (critère P1 étape 5) | `uat/auth-2fa.spec.ts` (`Déduit`) | e2e réel | F | `Vérifié` : `sessionStorage` relu au chargement (`authStore.ts:147`) | mer 11 |

### P2 — Import d'un dossier et classement automatique (admin puis collab)

| Scénario | ID UAT | Spec (état) | Preuve | Resp. | État 09/11 ⚠ (avant le 15/11, voir § 0.3) | Cible |
|---|---|---|---|---|---|---|
| Règle active visible dans `/rules` avec priorité | SC-ADM-05 (partiel) | `rules-setup.spec.ts` (1 `skip` conditionnel, projet `authed-chromium`) | e2e réel | F | `Vérifié` : spec existe, `skip` si pré-requis absent | jeu 12 |
| Import du dossier de démo : compteurs importés / doublons / en attente | SC-ADM-08 | `ingestion.spec.ts` (**mock**, `main`) → `uat/directory-import.spec.ts` (réelle, 1 test) | e2e réel | F + Q (dossier monté dans le conteneur api : `/ingest-directory` lit un chemin **serveur**) | `Vérifié` : spec réelle écrite ; montage **tranché O 09/11** : `/data/ingest` en lecture seule dans les deux compose, `INGEST_ALLOWED_ROOTS=/data/ingest` (PR 2a Q + compose B, `spec-limite-upload.md` § 5) ; la spec doit viser ce chemin | jeu 12 |
| Import hors racine autorisée refusé (403 `INGEST_PATH_FORBIDDEN`), import dans `/data/ingest` accepté, chemin relatif résolu | SC-SEC-05 | pytest B (9 cas, `spec-ingest-racines-autorisees.md` § 5) ; rejeu Q sur P2 (chemin hors racine depuis l'UI) | API + manuel | B puis Q | **Livré** : #53 fusionnée le 10/11 (`INGEST_ALLOWED_ROOTS=/data/ingest` dans les deux compose, `Vérifié` `docker-compose.yml:136`, `docker-compose.e2e.yml:81`) ; rejeu Q sur P2 à faire | jeu 12 |
| Documents rangés dans l'arborescence attendue (`/spaces`) | SC-E2E-01 (chaîne import → classement) | `full-cycle.spec.ts` (réelle mais sens « cycle de validation », dans `smoke`) ; vérification dans `uat/directory-import.spec.ts` (`Déduit`) | e2e réel | F | `Constaté` : **SMK-09** `full-cycle` (`sessionStorage` avant navigation) clos, remplacé par `uat/validation-cycle.spec.ts` dans le `testMatch` `smoke` | ven 13 |
| Ré-import du même dossier → tous refusés comme doublons | — (candidat 12 intégré, étape 8) | aucune (`absente`) ; `bulk-upload.spec.ts` (2 `skip`, dépend d'un corpus local `CORPUS_ROOT`) | API (`test_imports.py` si présent : `À vérifier` B) sinon manuelle | B/F | `Déduit` : hash SHA-256 au stockage (`storage/local.py`), refus de doublon côté API non relu ce soir | ven 13 |
| Dépôt unitaire par le rédacteur | SC-RED-01 | `documents.spec.ts` (réelle, 15 tests, dans `smoke`) | e2e réel | F | `Constaté` smoke 2 : **SMK-04** upload collaborateur 403 et **SMK-05** soumission au visa (policy `standard` vs seed `collaborator`) → B, PR #47 `fix/authz-collaborator` ; **SMK-06/07** modale hors écran 1280×720 → F, PR #45 `fix/recette-smoke-1` ; **SMK-08** seed sans catégorie → Q, PR 2 seed ; **SMK-03** onglet historique clos (`6ddad06`) | mer 11 |

### P3 — Simuler une règle avant activation (admin)

| Scénario | ID UAT | Spec (état) | Preuve | Resp. | État 09/11 ⚠ (avant le 15/11, voir § 0.3) | Cible |
|---|---|---|---|---|---|---|
| Créer une règle (condition + action) | SC-ADM-05 | `rules.spec.ts` (3 `skip`, `main`) → `uat/rule-classification.spec.ts` (réelle, 1 test) | e2e réel | F | `Vérifié` : F confirme que l'UI appelle `/classification-rules/simulate` (passation F) | jeu 12 |
| Simuler : tableau avant / après, aucun déplacement tant que non activée | SC-ADM-06 (**sens UAT juillet = circuit de validation** : collision, à acter) | `classification-admin.spec.ts` (**mock**) → `uat/rule-classification.spec.ts` | e2e réel | F | `Vérifié` : spec réelle écrite | jeu 12 |
| Activer puis « Relancer le workflow » sur un document à revoir → nouvelle destination | — (P3 étape 7) | aucune spec dédiée (`absente`) | manuelle (ou ajout dans `manual-review`) | F | `Vérifié` : bouton dans `ClassificationReviewPage` | ven 20 (jeu de démo) |

### P4 — Espaces : parcourir, filtrer, paginer (manager) — Lot C9

| Scénario | ID UAT | Spec (état) | Preuve | Resp. | État 09/11 ⚠ (avant le 15/11, voir § 0.3) | Cible |
|---|---|---|---|---|---|---|
| Arbre service → domaine → activité → année, ouverture d'un document, téléchargement | SC-LEC-02, SC-VAL-03 (**sens UAT juillet = rejet avec motif** : collision) | `spaces.spec.ts` (**mock**) → `uat/spaces-filters.spec.ts` (réelle, 4 tests, ID **nouveau `SC-ESP-01`**) ; `reader-signed.spec.ts` (1 `skip` « aucun document accessible au lecteur ») | e2e réel | F | `Vérifié` : commit 34b4db2 « enable spaces server-side filter checks now that #38 is merged » | ven 13 (navigation) |
| Filtres serveur domaine / activité / année / statuts, compteur cohérent | — (critère CDC « arborescence », ordre 4) | `uat/spaces-filters.spec.ts` ; UI à brancher (`spec-espaces-filtres-ui.md`) | e2e réel + API (`test_spaces_filters.py`, 16 tests, #38 fusionnée) | B (fait) / F | **API `Vérifié` GO** ; UI absente jusqu'au 17/11. Précision F (09/11) : `uat/spaces-filters` teste aujourd'hui la **navigation** de la SpacesPage actuelle (arborescence, sous-service et retour, inclusion des sous-services, recherche `?q=` et bouton Effacer) et le **contrat C9 directement sur l'API** (`domain`/`activity`/`year`, `q` + `limit`/`offset` + `X-Total-Count`, `classification_status`, 422), **pas encore les filtres UI** : à compléter quand la PR UI du 17 arrive | mar 17 |
| Pagination serveur (une requête par page) | — (ordre 4, partie sacrifiable D2) | aucune (SPF-05 `Proposé` dans la spec UI) | e2e réel | F | `Proposé` ; API prête (`limit`/`offset`, `X-Total-Count`) | mar 17 ou **sacrifiée** |

### P5 — Recherche bornée au service, corbeille exclue, isolation tenant (collab puis reader)

| Scénario | ID UAT | Spec (état) | Preuve | Resp. | État 09/11 ⚠ (avant le 15/11, voir § 0.3) | Cible |
|---|---|---|---|---|---|---|
| Recherche plein texte, `took_ms` affiché, ouverture d'un résultat | SC-LEC-01, SC-RED-05 (**collision** : RED-05 juillet = « supprimer brouillon », e2e actuel = recherche) | `redacteur.spec.ts:137` (`skip` « champ de recherche absent ») ; **aucune spec réelle** | e2e réel | F | `Vérifié` : `Header.tsx` porte la recherche ; spec à créer (`search-scope.spec.ts`, parcours-demo) | ven 13 |
| Document mis en corbeille → absent des résultats | — (ordre 1) | absente | API (`test_search_scope.py`, **PR #42 ouverte**, checks en cours) + e2e réel | B / F | `Vérifié` : #42 contient `postgres_engine.py`, `test_search_scope.py` ; non fusionnée | mer 11 (B) / ven 13 (F) |
| Lecteur DSI : aucun document DAF dans les résultats | SC-SEC-01 (**collision** : e2e actuel = « rédacteur GET /authz/policies → 403 », `security-isolation.spec.ts:22`) | `security-isolation.spec.ts` (réelle, 4 tests, dans `smoke`, **mauvais sens**) | API (#42) + e2e réel | B / F | `Vérifié` : faille documentée (DEC-002 ordre 1) ; correctif dans #42 | ven 13 |
| Isolation tenant : terme MINESUP introuvable depuis MINFI | SC-SEC-02 (**collision** : e2e actuel = « lecteur sans upload ») | idem | API (#42, `test_search_scope.py`) | B | idem (SMK-10 déplacé sur la ligne SC-SEC-03/04 de P7 : il porte sur les droits du lecteur, pas sur l'isolation tenant) | ven 13 |

### P6 — Revue manuelle d'un document non classé (manager/admin)

| Scénario | ID UAT | Spec (état) | Preuve | Resp. | État 09/11 ⚠ (avant le 15/11, voir § 0.3) | Cible |
|---|---|---|---|---|---|---|
| Liste « à revoir » avec raison, choix service/domaine/activité/année, « Résoudre », document visible à destination | SC-ADM-07 (`SC-ADM-REVIEW` dans `needs-review.spec.ts` : à renommer) | `needs-review.spec.ts` (réelle, projet `authed-chromium`) ; `classification-reviews.spec.ts` (**mock**) → `uat/manual-review.spec.ts` (réelle, 1 test) | e2e réel | F | `Vérifié` : spec réelle écrite ; dépend des 2 fichiers hors règle importés en P2 (ordre d'exécution à déclarer) | jeu 12 |
| Compteur « à classer » décrémenté, entrée d'audit créée | — | couvert par `uat/manual-review` + `uat/audit-trail` (`Déduit`) | e2e réel | F | idem | jeu 12 |

### P7 — Journal d'audit (auditor)

| Scénario | ID UAT | Spec (état) | Preuve | Resp. | État 09/11 ⚠ (avant le 15/11, voir § 0.3) | Cible |
|---|---|---|---|---|---|---|
| `/audit` : filtrer par agent et par jour, retrouver revue et corbeille | SC-AUD-01 | `audit.spec.ts` (réelle, `main`, 3 tests ; **supprimée** dans le worktree F) → `uat/audit-trail.spec.ts` (réelle, 3 tests, 1 `fixme`) | e2e réel | F | `Vérifié` : spec écrite ; `fixme` = traces connexion/dépôt/import en attente du correctif B (D3, jeu 12) | jeu 12 (B) → ven 13 (F) |
| Connexion, dépôt, import tracés (D3) | SC-ADM-09 (ID utilisé par F dans `audit-trail`) | `uat/audit-trail.spec.ts` (`fixme`) | e2e réel | B puis F | `Vérifié` : B4 du point S1 | jeu 12 |
| Export du journal | SC-AUD-02 | `auditor-export.spec.ts` (`skip:24` « bouton Exporter absent » ; supprimée dans le worktree F) | — | — | ~~Aucune preuve possible : reporté V1.1 (D4, écart 8).~~ **17/11 : livré** (#80, #87), un utilisateur à la fois, `uat/audit-export.spec.ts` réelle (§ 0.3) | recette 20-23 |
| Auditeur : écriture refusée (403 visible) | SC-SEC-03/04 (sens e2e actuel) | `security-isolation.spec.ts` (réelle) | e2e réel | F | `Constaté` smoke 2 : **SMK-10** le reader voit « Nouveau Document », `GET /tenants/{id}` et `GET /categories/` en 403 font perdre les documents (`Promise.all`) → B (#47) et F (#45) ; garde de routes PR #46 (`GUARD-01..06`, critère C4) | mer 11 (SMK-10) / ven 13 |

### P8 — Cycle de validation (variante retenue le 09/11 : visa, rejet, retour ; manager MGR001)

DEC-2026-002 acceptée (passation F 18:08) : P8 = **cycle de validation**, les variantes corbeille/restauration et version/verrou de `parcours-demo.md` deviennent **API seule** (aucun bouton UI, `Vérifié` ce matin).

| Scénario | ID UAT | Spec (état) | Preuve | Resp. | État 09/11 ⚠ (avant le 15/11, voir § 0.3) | Cible |
|---|---|---|---|---|---|---|
| Soumettre → visa manager → signature (circuit `E2E-WF-VALID`) | SC-VAL-01, SC-VAL-02 | `validation.spec.ts` (supprimée), `workflow.spec.ts` (supprimée), `full-cycle.spec.ts` (supprimée, remplacée par `validation-cycle` dans le `smoke`), `workflow.page.ts` supprimé → **`uat/validation-cycle.spec.ts`** | e2e réel | Q (seed PR 2 : circuit + 3 tâches `E2E-VAL-*`) puis F | **`Absente`** ; dépend de la PR 2 seed de Q (engagement 18:10 ; repli : soumission via API dans la spec). **P8 non jouable à l'écran au 09/11** (3 défauts vérifiés F + O) : **VAL-D1** choix du manager via `GET /users` interdit au collaborateur → `GET /workflows/validators` (B) ; **VAL-D2 bloquant** `GET /workflows/pending` sans `current_version_id` → Viser/Rejeter 422, et `WorkflowTasks` envoie `approve` hors enum `ActionType` → champ ajouté côté B, front aligné. B mar 10 PR `fix/workflow-pending-validators` (0,25 j), F mer 11 PR `fix/validation-cycle-ui` (0,45 j), e2e jeu 12 ; **≈ 0,7 j-p non prévus** (budget du 24) | jeu 12 (e2e) / repli manuel si pas vert le 13 |
| Rejeter avec motif | SC-VAL-03 | idem | e2e réel | Q / F | idem ; **VAL-D3** : aucun motif saisissable au 09/11 → motif sur « Rejeter » dans `fix/validation-cycle-ui` | jeu 12 |
| Retour à l'écran du rédacteur, notification | SC-VAL-04 (+ `notifications.spec.ts`, 2 `skip`) | idem | e2e réel | F | idem ; **« Retourner pour correction » → V1.1** (VAL-D3, écart 17) : la ligne se réduit à « le rédacteur voit le statut Visé/Rejeté et le motif » | jeu 12 |
| Corbeille → restauration (ex-variante A) — **hors rc.1** à l'écran (§ 0.2) | SC-RED-05/06 (collision RED-05) | aucune | **API** (`test_documents.py` : `À vérifier` B) | B | `Vérifié` : routes `trash`/`restore` existent, UI absente → **annoncé** (écart « cycle de vie manuel », plan § 3 n° 9) | pytest existant |
| Nouvelle version + verrou (ex-variante B) | SC-RED-04 (collision : `redacteur.spec.ts:60` `skip` « bouton absent ») | aucune réelle | **API** | B | idem ; onglet « Historique des versions » existe en lecture (`document-detail.page.ts`, #39) | pytest existant |

## 3. Scénarios sans preuve possible avant le 24/11 (entrée de D2)

| Scénario | Pourquoi | Conséquence pour la démo | Proposition |
|---|---|---|---|
| ~~SC-AUD-02 export du journal~~ | **17/11 : livré** (#80, #87), ligne close | — | revient dans la matrice de verdict (§ 0.3) |
| Pagination P4 (**17/11 : UI livrée par #78**, ligne close ; preuve manuelle de la page 2) | UI non livrée avant le 17 ; **premier sacrifice prévu par D2** (après garde de routes et sauvegarde automatisée) | la démo montre les filtres sans page 2 ; corpus de démo < 200 documents par service suffit pour que « tout » tienne sans `limit` | décision le 14/11 : si F est à l'heure sur les 8 parcours, garder ; sinon sacrifier **sans** toucher au reste de P4 |
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

## 6. Lots V1.1 réouverts avant le gel (GO PO du 10/11, DEC-2026-002) — `Proposé`

Règle : un lot est **livré seulement s'il est fusionné le 19/11 à 18:00**, sinon il reste V1.1 (écart annoncé). Un scénario court par lot, `fixme` dans `frontend/e2e/specs/uat/v11-lots.spec.ts` jusqu'à la PR du lot ; le fixme est levé dans la PR de recette, pas dans celle du lot. Preuve attendue : e2e réel sur pile e2e, `--retries=0`.

⚠ Colonne « État » d'avant le 15/11. Au 17/11, les cinq lots sont fusionnés. SC-V11-02 est réelle. SC-V11-01, -03, -04 et -05 sont encore en `fixme` sur `main` : voir § 0.3.

| Lot | ID | Scénario (Given / When / Then) | Preuve | Resp. | État |
|---|---|---|---|---|---|
| Compteur doublons (écart 8) | SC-V11-01 | Doublon refusé à l'upload ou à l'import → le compteur « doublons détectés » du tableau de bord admin augmente de 1 | e2e réel + API `/documents/stats` | B + F | fixme, lot non livré |
| Export / import des règles (écart 7) | SC-V11-02 | Règles actives exportées puis importées sur base vide → mêmes règles (code, priorité, statut) ; second import = aucun doublon | e2e réel | B + F | fixme |
| Export journal d'audit + verrou OTP (écarts 8, 9) | SC-V11-03 | Journal exporté par l'auditeur = événements du filtre ; 3 OTP erronés puis un 4e essai → compte verrouillé, message explicite | e2e réel + API | B + F | fixme |
| Critères contenu OCR / date (écart 7) | SC-V11-04 | Règle « mots-clés OCR » ou « année » → document déposé (upload, worker OCR actif) classé à la destination attendue une fois son texte extrait ; un fichier sans année dans le nom échoue sur la règle « année » ; simulation visible avant activation | e2e réel (#92 B, #95 F) | B + F | fixme (à lever par Q à la fusion de #92) |
| Surveillance de dossier (écart 7) | SC-V11-05 | Fichier déposé dans le dossier surveillé → importé et classé sans action ; fichier déjà connu refusé comme doublon | e2e réel (volume `/data/ingest`) | B + Q | fixme |

Les mesures C2/C3 (`scripts/measure_c2.py`, `measure_c3.py`) restent la preuve des critères chiffrés ; ces cinq lignes ne les remplacent pas.
