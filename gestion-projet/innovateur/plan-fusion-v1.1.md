# Plan de fusion V1.1 (24/11 au 04/12)

- **Auteur** : innovateur (I), à la demande de O (18/11). Échéance : 21/11 18:00.
- **Relevé** : 18/11 vers 17:00, 133 PR ouvertes (#368 fusionnée depuis, en 9b32c30). Ce plan doit être mis à jour le 21 sur la tête de `main` après le tag.
- **Complète** `plan-v1.1.md` (lots et charges) et `plan-fusion-post-rc1.md` (§ 2 et § 8.6 : ordre et chaîne alembic). En cas d'écart sur une charge, `plan-v1.1.md` fait foi. Pour l'ordre de fusion, c'est ce fichier qui fait foi.

## 0. Méthode et lecture des colonnes

Relevé reproductible, en lecture seule :

```bash
gh pr list --state open --limit 300 \
  --json number,author,isDraft,baseRefName,headRefName,labels,mergeable,title \
  -q '.[] | [.number, .author.login, .isDraft, .baseRefName, .headRefName,
             ([.labels[].name] | join(",")), .mergeable, .title] | @tsv'
gh pr view <n> --json files -q '.files[].path'      # fichiers par PR
gh pr view <n> --json headRefOid -q .headRefOid     # tête, à comparer à l'OK de Q
```

- **Auteur** : les 126 PR non Dependabot sont publiées par le même compte. Le rôle (B, F, Q, I) est déduit des fichiers et de la branche.
- **Base / pile** : « main », ou « sur #n » pour une PR empilée.
- **Conflit probable** : les fichiers que la PR partage avec au moins trois autres PR ouvertes. Une pile n'est comptée qu'une fois. Les fichiers les plus partagés sont listés au § 5.
- **OK de Q** : relevé dans `PASSATION-ci-qa.md`, car Q ne commente pas sur GitHub. On lit :
  - **oui** si l'OK a été donné sur la tête actuelle ;
  - **périmé** s'il a été donné sur un SHA plus ancien : Q relit seulement le delta ;
  - **code** si l'OK porte sur le code, mais attend encore le tag, la CI ou l'e2e ;
  - **non** s'il n'y a pas d'OK.
  Un OK ne vaut que si son SHA est la tête de la PR. Sans SHA noté, Q le reconfirme sur la tête avant la fusion.
- **État GitHub** : 29 PR sont en conflit avec `main` (CONFLICTING) et 30 sont encore en calcul (UNKNOWN). Après le tag, toute PR rebasée repasse la CI.

## 1. Règles de la fenêtre

1. **Une fusion à la fois.** Avec la règle `strict`, chaque fusion oblige les suivantes à se remettre à jour. On fusionne donc dans l'ordre du § 2, sans lot parallèle sur les fichiers chauds du § 5.
2. **#389 (parité des réglages) passe en premier.** Toute PR qui ajoute une variable doit ensuite passer ce contrôle. Elle doit déclarer la variable dans `config.py`, `docker-compose.yml` et `.env.example`. PR concernées : #383, #378, #245, #222, #212, #193, #192, #190, #183, #180, #165, #154, #153 et #152.
3. **Piles** : avant de fusionner la base d'une pile, re-cibler sur `main` les PR qui en dépendent (§ 3). Ne jamais fusionner une base tant qu'une PR empilée pointe encore sur sa branche.
4. **Migrations** : une seule tête alembic. On suit l'ordre du § 4 et on repose `down_revision` à chaque fusion. Après chaque fusion, B lance `alembic upgrade head` sur `edossier` et `test_ged`.
5. **Conditions de fusion** : OK de Q sur la tête, CI Gate verte et, pour une PR empilée, base déjà fusionnée.
6. **Dependabot en dernier** (lot 7) : #111, #112 et #141. Les versions majeures #29, #30, #110 et #113 sont sorties vers la V1.2 (O, 17/11).
7. **Démo du 30/11** : si elle tourne sur `main` et non sur le tag, aucune fusion du 27 à 18:00 au 30 au soir. **Par défaut (O, 18/11) : la démo tourne sur le tag rc.1 (`release/v1.0.0`) et `main` n'est pas gelé.** Le § 8a est encore en discussion avec le PO. L'ordre ci-dessous en tient compte : rien de lourd n'est prévu le 27.
8. **Règle « pas d'ajout sans sortie »** (`plan-v1.1.md`) : 25 PR V1.1 n'étaient rattachées à aucun lot chiffré (§ 2, colonne Lot « — »). **Tranché par le PO le 18/11 : toutes en V1.1.** La charge est recalculée dans `plan-v1.1.md`, § « Mise à jour du 18/11, soir » : Q + 5,1 h-s pris sur sa réserve (relectures de #362, #394, #399 et #404 comprises), il en reste ≈ 1,7. Ordre de sortie si besoin : #359, #338, #371.

## 2. Ordre de fusion proposé (PR V1.1, hors section PO)

Les PR post-rc1 qui sont des capacités nouvelles sont traitées au § 6, sur décision du PO. Leur place dans la chaîne est réservée en vague 4.

### Vague 0 : 24/11 matin, socle

| Ordre | PR | Rôle | Base / pile | Dépend de | Conflit probable | OK de Q | Lot |
|---|---|---|---|---|---|---|---|
| 1 | #389 ci : parité réglages, compose et `.env.example` | Q | main | — | `.env.example`, `docker-compose.yml`, `ci.yml`, `appfactory-impact.json` | **oui (3d3ad2e)** | — |
| 1 bis | #403 suites UX du lot 5 (droits, plafonds, erreurs) | F | sur #389 : **re-cibler sur `main` avant de fusionner #389** | #389 | `ci.yml`, `appfactory-impact.json`, `App.tsx`, `Dashboard.tsx` | **oui (4228d7a)** | — |
| 2 | #383 audit : plafond de l'export CSV (#136) | B | main | #389 | `config.py`, `.env.example`, `docker-compose.yml`, `audit.py` | oui (c19e95b) | — |

### Vague 1 : 24 et 25/11, petites PR sans migration

| Ordre | PR | Rôle | Base / pile | Dépend de | Conflit probable | OK de Q | Lot |
|---|---|---|---|---|---|---|---|
| 4 | #222 profil modifiable, trois constats B6 (#216) | B | main | #389 | `users.py`, `test_users.py`, `policy.csv`, `config.py` | oui (99d3d09) | 5 |
| 5 | #227 audit de `PATCH /users` (#225) | Q | main | #222 (rebase) | `users.py`, `test_users.py` | oui (0b21202), CONFLICTING | 4 |
| 6 | #224 `GET /config/features` (#214) | B | main | — | `router.py` | oui (0b8eb15) | 5 |
| 7 | #234 l'interface lit les réglages (#230) | F | main | #224 | `App.tsx`, `playwright.unit.config.ts` | oui (d6bd746), CONFLICTING | 5 |
| 8 | #237 422 et non 500 sur un rôle nul | B | main | après #227 | `users.py`, `test_users.py` | oui (ae555e4) | 14 |
| 9 | #240 explorateur lisible au lecteur d'écran | F | main | — | `SpacesPage.tsx` | oui (1798847) | 14 |
| 10 | #243 e2e : aide inutilisée retirée | Q | main | — | `uat.fixture.ts` | oui (eb252c1), CONFLICTING | 14 |
| 11 | #245 hôtes acceptés par Vite (#145) | F | main | #389 | `.env.example`, `docker-compose.yml` | oui (23a0af2), CONFLICTING | 14 |
| 12 | #253 test de `tag_preflight.sh` en CI | Q | main | #389 | `ci.yml`, `appfactory-impact.json` | non | 14 |
| 13 | #235 synchronisation additive des droits CSV vers SQL | B | main | — | `casbin_enforcer.py` | code (SHA non noté) | 13 |
| 14 | #238 règles écrites ligne par ligne (si elle passe après #389 : retirer `AUTHZ_BACKEND` des exceptions de parité, § 9) | B | sur #235 | #235 | `casbin_enforcer.py`, `docker-compose.yml`, `installation.md` | code (SHA non noté) | 13 |
| 15 | #248 compose réduit pour le VPS | doc | main | — | `installation.md` | changements demandés (15b6e99, tête 2d73db6) | 12 |
| 16 | #267 en-têtes de sécurité du proxy | doc | sur #248 | #248 | — | code (81ca7a3) | 12 |
| 17 | #268 contrôle de la configuration du VPS en CI | Q | sur #248 | #248, #389 | `ci.yml`, `appfactory-impact.json` | code (3afe892) | 12 |

- **#248 en tête du lot 12** : la rc.1 est hébergée d'abord sur le VPS (`plan-v1.1.md`, lot 12). Mais les changements demandés par Q doivent être relus sur 2d73db6. Si ce n'est pas fait le 24, le lot 12 passe en fin de vague 1, sans rien bloquer d'autre.

### Vague 2 : 25 et 26/11, lecture des documents (OCR)

| Ordre | PR | Rôle | Base / pile | Dépend de | Conflit probable | OK de Q | Lot |
|---|---|---|---|---|---|---|---|
| 18 | #372 `ocr_status` exposé en lecture | B | main | — | `documents.py`, `schemas/document.py` | non | — |
| 19 | #284 état failed et `low_confidence` sur `/ocr` (#276) | B | main | #372 | `documents.py`, `schemas/document.py`, `tasks.py` | non | 9 |
| 20 | #311 jeu e2e : une lecture en échec, une peu sûre | Q | sur #284 | #284 | — | non | 9 |
| 21 | #384 moteur réellement utilisé enregistré (#381) | B | main | — | `tasks.py` | non | — |
| 22 | #386 pages scannées d'un PDF mixte (#380) | B | sur #384 | #384 | `strategy.py` (pile OCR) | non | — |
| 23 | #387 pages d'un PDF rendues une à une (#379) | B | sur #386 | #386 | `strategy.py` (pile OCR) | non | — |
| 24 | #388 filtre par catégorie sur la liste | B | main | — | `documents.py` | non | — |
| 25 | #355 « Lecture en échec » et relance à l'écran | F | main | #372 | `Documents.tsx`, `DocumentDetailModal.tsx`, `documents.api.ts`, `services/index.ts` | non, CONFLICTING | — |
| 26 | #290 texte reconnu dans la fiche (#276) | F | main | #284 | `DocumentDetailModal.tsx`, `documents.api.ts`, `services/index.ts` | non, CONFLICTING | 9 |
| 27 | #338 aperçu intégré dans la fiche | F | main | après #290 | `DocumentDetailModal.tsx` | non | — |

- **#372 passe avant tout lecteur de `ocr_status`** : #355 lit le champ dans la liste et dans la fiche. #284 et #311 partent de son état failed, et #290 lit la route `/ocr`.
- **#388 passe avant le point 5 du Lot 5 bis** (filtre de la liste, côté interface), qui n'a pas encore de PR. #351 (filtre gardé dans l'URL) se place après #388, en vague 5.
- **Palier 1 de l'OCR adaptatif (#382, lot 1)** : V1.2. B code après #284 ; spécification : `spec-ocr-adaptatif-lot1.md` (décision D1 prise : correction de la confiance dans le lot).
- **#385 (bancs de mesure OCR)** : marquée « hors file » par son titre. On ne la fusionne pas, elle reste un outil en brouillon. Elle peut être fermée une fois les mesures reportées dans la décision OCR.
- **#355 et #376** : #376 est fermée au profit de #355 (même état de lecture).

### Vague 3 : 26/11, périmètre et audit (lot 11)

Avant tout, **une revue de recouvrement par B** (≈ 0,25 h-s). #203, #358 et #360, fusionnées le 18/11, touchent déjà une grande partie des fichiers de ces PR :

| PR | Fichiers déjà touchés par #203, #358 et #360 | Proposition |
|---|---|---|
| #241 unit_admin borné sur les revues et circuits (#215) | 17 sur 19 | **Réduite par B (18/11) à ce que #358 ne couvre pas.** Base de la pile `main` ← #241 ← #213 ← #221, #261, #263. À mettre à jour sur `main` après la coupe, puis nouvelle relecture de Q (les changements demandés en 9a534da portaient sur l'ancien diff). |
| #213 unit_admin par id (#202) | 6 sur 6 | **Réduite par B (18/11) à ce que #203 ne couvre pas.** Empilée sur #241. Base de #221, #261 et #263, qui restent dessus. Relecture de Q sur la nouvelle tête (l'ancien avis était en e9271c8). |
| #361 périmètre unit_admin côté interface | 20 sur 25 | Écrite sur #358. Rebaser sur `main` et ne garder que l'écran. |
| #266 arbre des unités par `parent_id` (#201) | 13 sur 17 | Garder (#201 est encore ouvert), puis rebaser. |

| Ordre | PR | Rôle | Base / pile | Dépend de | Conflit probable | OK de Q | Lot |
|---|---|---|---|---|---|---|---|
| 28 | #261 cible de la revue vérifiée dans le tenant (#242) | B | sur #213 (pile #241) | — | `documents.py` | code (3da37c7) | 11 |
| 29 | #263 404 hors périmètre sur toute route de document (#247) | B | sur #213 (pile #241) | — | `documents.py`, `workflows.py` | oui (SHA non noté) | 11 |
| 30 | #308 e2e : 404 hors périmètre | Q | sur #263 | #263 | — | **rouge** (8a5c0e5) | 11 |
| 31 | #296 message clair si le lien d'un document est hors périmètre | F | main | #263 | `Documents.tsx`, `documents.api.ts` | code, périmé (dcc04a1, tête a117f44), CONFLICTING | 11 |
| 32 | #266 arbre par `parent_id` (#201) | B | main | revue de recouvrement | `analytics.py`, `documents.py`, `imports.py`, `reports.py` | code (SHA non noté), CONFLICTING | 11 |
| 33 | ~~#220 l'analytique ne compte plus la corbeille~~ | B | **fermée le 18/11** : couverte par `main` | — | — | — | 11 |
| 34 | #221 tableau de bord du service (#213) | F | sur #213 (pile #241) | #213 | `ci.yml`, `e2e-uat-nightly.yml`, `users.py` | code, périmé (e52ae5d, tête 2bfc18b), CONFLICTING | 11 |
| 35 | #282 volumes de stockage en nombres (#264) | B | main | — | — | non, CONFLICTING | 11 |

- **#220 et #159 sont fermées (O, 18/11)** : `main` les couvre déjà.
- **Pile `main` ← #241 ← #213 ← #221, #261, #263** : on fusionne de bas en haut. B met #241 à jour sur `main` après la coupe. Chaque étage est ensuite mis à jour sur le précédent, puis relu par Q sur sa nouvelle tête. On ne fusionne pas #213 avant #241.

### Vague 4 : 30/11 au 02/12, capacités post-rc1 (selon la décision du PO, § 6)

Ordre fixé par `plan-fusion-post-rc1.md` § 2 et § 8.6. On en retire les PR que le PO aura fermées, puis on repose `down_revision` (§ 4).

1. #179 → #262 → #309, puis #310 (re-ciblée sur `main` avant #262). #262 et #309 sont des correctifs V1.1 qui dépendent de #179.
2. #153, #155, #147.
3. #197 → #162 → #180 → #154 → #212 → #193 → #219 → #186 → #165 → #192.
4. #209 et #205.
5. #152 → #181 → #184 → #211 → #301 → #302, puis #182 et #190 ; #171 → #199.

| PR hors section PO dans cette vague | Rôle | Base / pile | Dépend de | OK de Q | Lot |
|---|---|---|---|---|---|
| #262 audit de `PATCH /documents` (#250) | B | sur #179 | #179 | code (SHA non noté) | 11 |
| #309 libellés de la frise de revue | F | main | #179, #262 | non | correctif accepté (O, 18/11) |
| #310 e2e : libellés de l'audit | Q | sur #262 | #262 | oui (SHA non noté) | 11 |
| #301 Suppr envoie à la corbeille (#151) | F | sur #181 | #152, #181 | code (SHA non noté) | #151 |
| #302 F2 renomme (#151) | F | sur #301 | #301, #262 | code (SHA non noté) | #151 |

### Vague 5 : 01 au 03/12, fiche document, équipe, droits et confort

| Ordre | PR | Rôle | Base / pile | Dépend de | Conflit probable | OK de Q | Lot |
|---|---|---|---|---|---|---|---|
| 36 | #283 champs de verrou et de corbeille dans `DocumentRead` (#274) | B | main | après #152 si elle est gardée | `documents.py`, `schemas/document.py` | non | 9 |
| 37 | #293 verrou dans l'en-tête de la fiche (#274) | F | sur #283 | #283 | `DocumentDetailModal.tsx`, `reviewLabels.ts`, `AuthzAdmin.tsx` | code (SHA non noté) | 9 |
| 38 | #295 nouvelle version depuis l'historique (#275) | F | sur #293 | #293 | `DocumentDetailModal.tsx`, `documents.api.ts` | code, en attente (tag, CI, e2e) | 9 |
| 39 | #285 « Mon équipe » côté serveur (#277) | B | main | #222 | `users.py`, `test_users.py` | non | 10 |
| 40 | #297 « Mon équipe » à l'écran (#277) | F | main | #285 | `App.tsx`, `Header.tsx`, `AgentsListTab.tsx`, `services/index.ts` | code, en attente (tag, CI, e2e), CONFLICTING | 10 |
| 41 | #294 grille des droits en lecture (#280) | B | main | lot 13 | `audit.py`, `authz.py`, `casbin_enforcer.py` | code (SHA non noté) | 8b |
| 42 | #303 écran de la grille des droits (#280) | F | sur #294 | #294, #293 (`reviewLabels.ts`) | 36 fichiers ; voir la note | code (SHA non noté) | 8b |
| 43 | #347 cartes du tableau de bord cliquables (audit UX, Lot 3) | F | main | après #221 | `Header.tsx` | non | — |
| 44 | #362 réduire les tâches répétitives (audit UX, Lot 4) | F | main | après #390 | 23 fichiers, dont `DocumentDetailModal.tsx` et `services/index.ts` | non | lot 4 UX (hors capacité, décision du PO) |
| 45 | #351 filtre de catégorie gardé dans l'URL | F | main | #388 | `Documents.tsx` | non, CONFLICTING | — |
| 46 | #354 dernière catégorie retenue au dépôt | F | main | après #351 | `Documents.tsx` | non, CONFLICTING | — |
| 47 | #371 liste vide expliquée selon le périmètre | F | main | après #354 | `Documents.tsx` | non | — |
| 48 | #373 erreurs d'import lisibles | F | main | — | `playwright.unit.config.ts` | non | — |
| 49 | #366 erreurs du simulateur de règles affichées | F | main | — | `playwright.unit.config.ts` | non | — |
| 50 | #367 onglet des règles gardé dans l'URL | F | main | après #366 | `playwright.unit.config.ts` | non | — |
| 51 | #377 simuler une règle inactive (#210) | B | main | — | `classification.py`, `classification_rule_engine.py` | non | — |
| 52 | #349 motifs de rejet fréquents en un clic | F | main | — | `playwright.unit.config.ts` | non, CONFLICTING | — |
| 53 | #359 reconnexion plus rapide | F | main | — | `playwright.unit.config.ts` | non, CONFLICTING | — |
| 54 | #378 profils de démonstration de la connexion derrière un réglage | F | main | #389 | `.env.example`, `docker-compose.yml` | non, CONFLICTING | — |
| 55 | #342 échappement de la liste des agents | F | main | après #297 | `AgentsListTab.tsx` | non | — |
| 56 | #344 recherche dans le journal d'audit | B | main | après #383 | `audit.py` | non | — |
| 57 | #353 test : propriétaire distinct de l'assigné | Q | main | — | — | non | — |
| 57 bis | #407 « Archiver » depuis l'aperçu de l'explorateur des espaces (écart 9), puis une variante de l'étape 8 du scénario e2e par ce chemin (suite de #356) | F | main ; **#401 empilée dessus** : re-cibler #401 sur `main` avant de fusionner #407 | après #293 et #362 (fiche document) | aperçu de l'explorateur, `demo-scenario-30-11.spec.ts` | **oui (98d2317)** | — |
| 57 ter | #401 sélection multiple et actions groupées dans l'explorateur (#150) | B | sur #407 | **après #407** | explorateur des espaces ; **conflit avec #400** | non | — |
| 57 quater | #400 accessibilité de l'explorateur (`aria-labelledby`, #167) | à confirmer | main | — | **conflit avec #401** : la PR fusionnée en second le résout | non | — |
| 57 quinquies | **à ouvrir** : audit UX Lot 6, « Validation… » sur Valider et Rejeter (XS) | F | main | — | écran des tâches | non | lot 6 UX |
| 57 sexies | **à ouvrir** : audit UX Lot 6, une seule erreur hors ligne au dépôt (XS) | F | main | — | fenêtre de dépôt | non | lot 6 UX |
| 57 septies | **à ouvrir** : audit UX Lot 6, orientation du premier jour et aide sur le code à la connexion (S) ; V1.2 proposée (`plan-v1.1.md`, § « nuit du 18/11 ») | F | main | — | `LoginPage.tsx`, tableau de bord du collaborateur | non | lot 6 UX |
| 57 octies | **à ouvrir** : audit UX Lot 6, saisie gardée à travers la reconnexion (M) ; V1.2 proposée avec #359 | F | main | avec #359 (même code de session) | `services/http/client.ts`, `session.ts` | non | lot 6 UX |

- **#303** : 36 fichiers, dont 29 en commun avec #220. Sa branche contient sans doute une autre pile. Il faut la re-cibler sur `main` après #294, puis vérifier que le diff ne contient plus que l'écran des droits.
- **57 bis** (O, 18/11) : pour la démo, l'étape 8 passe par la recherche du bandeau (`/documents?open=<id>`, #258), testée par #356 et validée par Q en recette du 20 au 23/11. L'aperçu de l'explorateur n'a pas encore « Archiver » : c'est la suite V1.1 de F, en PR #407 (brouillon). La charge de Q ne change pas : la relecture entre dans le temps déjà prévu pour la vague 5.
- **Audit UX Lot 6** (O, 18/11) : le point (a), pas de déconnexion sur une coupure réseau pendant le renouvellement de session et message « Votre session a expiré… » sur un 401, vise la V1.0 (relecture de Q le 19/11 à 14:00, go/no-go à 15:30). S'il n'est pas retenu, il devient une ligne de cette vague, juste avant 57 octies. Le point (c), la barre d'actions fixe en bas de la fenêtre de dépôt, va en V1.2 (§ 7). Charge : `plan-v1.1.md`, § « Mise à jour du 18/11, nuit ».
- **`playwright.unit.config.ts`** : 33 PR l'éditent, chacune pour y ajouter son fichier de test. Ce sont des conflits d'une ligne : un rebase les règle, sans risque fonctionnel.

### Vague 6 : 03 et 04/12

| Ordre | PR | Rôle | Note |
|---|---|---|---|
| 58 | #111, #112, #141 (Dependabot, lot 7) | Q | Une à une, CI complète entre chaque. |
| 59 | #335 générateur d'export de test sans faux repli | B | Outil de test, CONFLICTING ; à rebaser. Gardée (B, 18/11) : sans elle, faux PDF de 140 octets. |
| 60 | #312 garde d'espace disque avant une charge | doc | Script local ; sans risque. |
| 61 | #189 leçon 038, #166 carnet de la suite | doc | « Hors chaîne » dans le lot 1. Les fermer si leur contenu est déjà sur `main`. |

## 3. Piles : re-ciblage avant de fusionner la base

| Base | PR empilées dessus | À faire avant de fusionner la base |
|---|---|---|
| #384 | #386 → #387 | Re-cibler #386 sur `main` ; #387 suit. |
| #389 | #403 | Re-cibler #403 sur `main` **avant** de fusionner #389 ; puis fusionner #389, puis #403 (O, 18/11). |
| #407 | #401 | Re-cibler #401 sur `main` **avant** de fusionner #407 ; puis fusionner #407, puis #401 (O, 18/11). |
| #235 | #238 | Re-cibler #238. |
| #248 | #267, #268 | Re-cibler les deux. |
| #284 | #311 | Re-cibler #311. |
| #241 → #213 | #221, #261, #263 | Pile gardée (#241 et #213 réduites par B, 18/11). Mise à jour de #241 sur `main` après la coupe, puis étage par étage. |
| #263 | #308 (V1.1), #315 (V1.2) | Re-cibler les deux. |
| #179 | #262 → #310 | Re-cibler #262, puis #310. |
| #283 → #293 → #295 | #313 (V1.2) sur #295 | Re-cibler à chaque étage. |
| #285 | #343 (V1.2) | Re-cibler #343. |
| #297 | #333 (V1.2) | Re-cibler #333. |
| #294 | #303 → #352 (V1.2) | Re-cibler #303, puis #352. |
| #152 → #181 | #184 → #211 ; #190 ; #199 ; #301 → #302 | Re-cibler à chaque étage (§ 6). |
| #154 | #212 | Re-cibler #212. |
| #193 | #219 | Re-cibler #219. |
| #180 | #209 | Re-cibler #209. |
| #165 | #205 | Re-cibler #205. |
| #298 (V1.2) | #322 (V1.2) | Hors fenêtre. |
| #304 (V1.2) | #320 (V1.2) | Hors fenêtre. |
| #305 (V1.2) | #306 (V1.2) | Hors fenêtre. |
| #183 (V1.2) | #194 (V1.2) | Hors fenêtre. |

## 4. Chaîne alembic

Tête de `main` le 18/11 : `a7c8d9e0f1b2`. Seules les PR post-rc1 portent des migrations ; aucune PR V1.1 des vagues 0 à 3 n'en ajoute.

| Ordre | PR | Révision | `down_revision` à poser |
|---|---|---|---|
| 1 | #197 | eff6822a5320 | `a7c8d9e0f1b2` |
| 2 | #180 | b9d4e2f7a1c3 | eff6822a5320, à retirer du diff de #180 s'il y est copié |
| 3 | #193 | d4e8b2c6a1f3 | tête précédente |
| 4 | #186 | d4f1b6c2e8a9 | tête précédente |
| 5 | #165 | 8aed3f3826d7 | tête précédente |
| 6 | #192 | c9f2a7d4e1b6 | tête précédente |
| hors fenêtre | #183 (V1.2) | c3e8a5d1f2b7 | après la V1.1 |

Si le PO ferme une de ces PR, on la retire et la suivante prend la tête précédente. **Contrôle après chaque fusion** : `alembic heads` doit afficher une seule ligne.

## 5. Fichiers chauds (partagés par 8 PR ou plus)

| Fichier | PR | Risque |
|---|---|---|
| `frontend/playwright.unit.config.ts` | 33 | Ajout d'une ligne par PR : rebase mécanique. |
| `DOCS/engineering/lessons-learned.md` | 21 | Les numéros de leçon se chevauchent. **Renuméroter au rebase** ; ne jamais garder deux leçons au même numéro. |
| `backend/app/core/config.py` | 20 | Réglages ; contrôle de parité de #389. |
| `docker-compose.yml` | 17 | Idem. |
| `backend/app/api/v1/endpoints/documents.py` | 17 | Fichier central : passer après #372 et #388, puis une PR à la fois. |
| `frontend/services/index.ts` | 15 | Exports : conflits d'une ligne. |
| `backend/.env.example` | 13 | Parité. |
| `frontend/components/Documents.tsx` | 10 | #355, #351, #354, #371, #296 : dans cet ordre. |
| `backend/app/workers/tasks.py` | 9 | Pile OCR (#384, #284) avant le palier 1 de #382. |
| `backend/app/schemas/document.py` | 9 | #372, #284, #283. |
| `frontend/services/resources/documents.api.ts` | 9 | Vagues 2 et 5. |
| `frontend/playwright.config.ts` | 9 | Passes e2e post-rc1. |
| `frontend/components/DocumentDetailModal.tsx` | 8 | #355, #290, #338, #293, #295, #362. |
| `reports.py`, `workflows.py`, `users.py`, `SpacesPage.tsx`, `router.py`, `main.py` | 8 chacun | Voir les vagues 1, 3 et 4. |

## 6. À décider par le PO : capacités post-rc1

- **Ce qui est dedans** : 47 PR portent l'étiquette `post-rc1`. Cette section regroupe les **capacités nouvelles** (lots L1 à L14), leurs écrans et leurs passes e2e.
- **Ce qui reste dans les vagues 1 à 5** : les correctifs, tests et CI étiquetés `post-rc1`, déjà placés par O dans les lots 11 à 14 : #222, #235, #237, #238, #240, #241, #243, #245, #248, #261, #262, #263, #266, #267, #268, #282, #283, #284, #285 et #294. O peut en déplacer.
- **Charge** : ces capacités sont déjà comptées dans le lot 1 de `plan-v1.1.md` (≈ 17 h-s, dont Q 10). Chaque PR fermée libère sa part.
- **Déjà décidées par le PO** : #183 et #194 sont en V1.2.

**Décision demandée au PO** : pour chaque ligne, fusionner, retravailler ou fermer. Sans réponse le 23/11, on applique la recommandation.

| PR | Capacité | Rôle | Base / pile | OK de Q | État | Recommandation |
|---|---|---|---|---|---|---|
| #147 | Sonde de disponibilité `/health/ready` (L1) | B | main | non | 5 fichiers | **Fusionner** : petite, utile à la supervision du VPS. |
| #152 | Corbeille : supprimer envoie à la corbeille, puis restaurer ou purger (L2) | B | main | périmé (5547c0d, tête 6788562) | 16 fichiers | **Fusionner** après relecture du delta. Elle porte #181, #184, #211 et #301 (Suppr de #151, déjà décidé en V1.1). |
| #181 | Écran Corbeille | F | sur #152 | code, en attente (tag, CI, e2e) | 24 fichiers | **Fusionner** avec #152. |
| #184 | Annuler la dernière mise à la corbeille ou le dernier déplacement | F | sur #181 | code (726b8b7) | CONFLICTING | **Retravailler** : rebase après #181. |
| #211 | Sélection multiple dans l'explorateur | F | sur #184 | code (974afd3) | 4 fichiers | **Fusionner** après #184. |
| #168 | Passe e2e L2 (corbeille) | B/Q | main | non | 16 fichiers | **Fusionner** juste après #152 : garde de non-régression. |
| #182 | Passe e2e L4 (annuler) | F/Q | main | code (50b684c) | 39 fichiers, 18 en commun avec #181 | **Retravailler** : rebase sur `main` après #181, pour ne garder que les tests. |
| #153 | File de validation unifiée (L3) | B | main | oui (cbf28bc) | 6 fichiers | **Fusionner** : sert directement les agents. |
| #190 | Écran de la file de validation à onglets | F | sur #181 | code (f23db8c) | CONFLICTING | **Retravailler** : elle dépend de #153. Si elle n'utilise rien de #181, la re-cibler sur `main` (à vérifier par F). |
| #170 | Passe e2e L3 | B/Q | main | non | 7 fichiers | **Fusionner** après #190. |
| #154 | Canal d'envoi du code de connexion (L4), avec SMTP | B | main | oui (720a30f) | 13 fichiers | **Fusionner** : lot 2, déjà planifié. |
| #212 | Refus de démarrer en production sans canal ni clé | B | sur #154 | non | CONFLICTING | **Retravailler** : rebase après #154. |
| #172 | Passe e2e L4 (renvoi du code) | B | main | non | 10 fichiers | **Fusionner** après #154. |
| #193 | Application d'authentification (TOTP), obligatoire pour les administrateurs | B | main | périmé (61c2dd0, tête 8de284a) | 23 fichiers, CONFLICTING, migration | **Retravailler**, puis fusionner : sécurité des comptes administrateurs. Le PO confirme que la saisie devient obligatoire. |
| #219 | Écrans de l'application d'authentification | F | sur #193 | code (5f2f6c2) | 16 fichiers | **Fusionner** avec #193. |
| #155 | Notifications en temps réel sur plusieurs processus (L6) | B | main | non | 7 fichiers | **Retravailler** seulement si l'API tourne avec plusieurs processus en V1.1. Sinon, V1.2. |
| #169 | Passe e2e L6 (authentification du WebSocket) | B | main | non | 10 fichiers | Suit #155. |
| ~~#159~~ | Une seule règle de périmètre pour les rapports (L5a) | B | — | — | — | **Fermée le 18/11** : couverte par `main` (#358). |
| #197 | Rapport officiel en PDF (L5) | B | main | code (l. 864, ancien) | 11 fichiers, migration | **Fusionner** : tête de la chaîne alembic, sur une relecture à jour. |
| #162 | Qualité documentaire : indicateurs et liste (L8) | B | main | code (SHA non noté) | 6 fichiers | **Fusionner**. |
| #180 | Rapports officiels programmés (L9) | B | main | périmé (feb9c4e, tête 2297058) | 27 fichiers, 26 en commun avec #183 (V1.2), migration | **Retravailler** : vérifier que rien de #183 n'est resté dans le diff. Valeur : la direction plus que les agents. |
| #209 | Écran de copie du rapport officiel | F | sur #180 | périmé (3a704fc, tête 3af5934) | 9 fichiers | Suit #180. |
| #165 | Favoris, récents, partagés (L7) | B | main | périmé (d89f86f, tête d274d25) | 15 fichiers, migration | **Fusionner** après relecture du delta : confort quotidien des agents. |
| #205 | Écran favoris, récents, partagés | Q/F | sur #165 | périmé (2ae6e23, tête 09ae640) | 38 fichiers | **Retravailler** : rebase après #165, diff à réduire. |
| #171 | Vue des doublons : garder un document et mettre l'autre à la corbeille | B | main | oui (3198885) | 5 fichiers | **Fusionner** ; elle dépend de la corbeille (#152). |
| #199 | Écran des doublons | F | sur #181 | code (cce7390) | 12 fichiers | **Fusionner** après #171 et #181. |
| #179 | Annuler un déplacement | B | main | code (SHA non noté) | 3 fichiers | **Fusionner** : #262, #309 et #310 (V1.1), ainsi que le glisser-déposer (V1.2), en dépendent. |
| #186 | Reprise d'un import interrompu (L14) | B | main | code (l. 954, ancien) | 9 fichiers, migration | **Fusionner** : gros imports du lancement. |
| #192 | Sauvegarde planifiée chaque nuit, avec rétention | B | main | oui (7c32940) | 16 fichiers, migration | **Fusionner** : protège les données dès la mise en service. |

**Si le PO ne veut garder que l'essentiel** : #152 et #181 (corbeille, déjà promise par Suppr), #153, #154, #179, #192 et #193 avec #219. Tout le reste passe en V1.2. Gain à chiffrer par O. Sur les 6 PR de plus de 1 500 lignes qui font l'essentiel des 10 h-s de Q du lot 1, quatre sortiraient : #180, #182, #197 et #205. #183 est déjà sortie.

## 7. Hors fenêtre

- **Chemin V1.0 (18 et 19/11)** : #104, #121, #375, #390 et #356. #368 est fusionnée le 18/11 (9b32c30), #356 aussi (dd232f6), et #390 est corrigée en 4be742b, en file après #375. Si l'une d'elles n'est pas fusionnée le 19, elle passe en vague 0, juste après #389.
- **V1.2** :
  - branches `feat/v12-*` : #370, #357, #352, #343, #333, #332, #331, #330, #329, #323, #322, #320, #318, #315 ;
  - étiquette `v1.2` : #306, #305, #304, #281, #183, #194 ;
  - autres : #313 (élément 8 de la V1.2) et #298 (#278, sortie par O le 18/11) ;
  - audit UX Lot 6, point (c) : barre d'actions fixe en bas de la fenêtre de dépôt à 1366×768 et zoom 125 % (F, à ouvrir).
  Les PR V1.2 empilées sur une base V1.1 sont re-ciblées au § 3. Aucune n'est fusionnée avant le 04/12.
- **Dependabot, versions majeures** (V1.2) : #29, #30, #110 et #113.
- **#385** : outil de mesure, jamais fusionné.

## 8. Points ouverts pour O

1. Démo du 30/11 sur `main` ou sur le tag ? Cela décide du gel du 27 au 30 (règle 7). **Par défaut : sur le tag, sans gel de `main`** (O, 18/11). La réponse du PO est attendue.
2. **Tranché (PO, 18/11) : toutes en V1.1**, avec la charge dans `plan-v1.1.md`. Les 25 PR marquées « — » : #389, #383, #372, #384, #386, #387, #388, #355, #338, #347, #351, #354, #371, #373, #366, #367, #377, #349, #359, #378, #342, #344, #353, #335 et #312.
3. Revue de recouvrement par B face à #203, #358 et #360. **Faite le 18/11** pour #220 et #159 (fermées), et pour #241 et #213 (réduites). Restent #361 et #266, avant le 26/11.
4. Relecture de Q sur la tête pour toutes les PR marquées « périmé » ou « SHA non noté ».

## 9. État des PR backend post-rc1 (relevé de B, 18/11 au soir)

Relevé transmis par O. Il ne change ni l'ordre des vagues ni la charge. Il dit ce que chaque PR demande avant la relecture de Q.

| État | PR | Ce qu'il faut avant la relecture |
|---|---|---|
| À jour avec `main` | #205, #213, #238, #261, #262, #263 ; #152 (e27e01c), #155 (ab97a73) | Rien : relecture de Q sur la tête. Pour #152 et #155, voir plus bas. |
| Propres mais anciennes | #147, #162, #171, #179, #186, #197, #222, #235, #237, #281, #283, #285, #294 ; #199 en partie | Mise à jour de la branche par B, puis CI verte, puis relecture de Q sur la nouvelle tête. |
| En conflit | #153, #154, #165, #180, #183, #192, #193, #212, #241, #266, #282 ; #181, #184 et #190 en partie | Rebase par B dans l'ordre des vagues, jamais en avance sur la base d'une pile (§ 3). |
| Probablement obsolète | #284 (recouvrement avec #370 et #372) | B confirme, puis O ferme. Avant de la fermer, re-cibler #311 et vérifier ce que #290 lit sur `/ocr`. |
| Fermées le 18/11 | #220, #159 | Couvertes par `main`. |
| Réduites le 18/11 | #241, #213 | Pile `main` ← #241 ← #213 ← #221, #261, #263 ; #241 mise à jour après la coupe (§ 2, vague 3). |
| À garder malgré tout | #282, #335 | #282 est à rebaser ; #335 reste en vague 6. |

- **#152 (corbeille)** touche un test déjà sur `main` (droits de DELETE). Il faut une relecture du delta de ce test par Q et un avis du PO avant la fusion, car elle change un comportement que la rc.1 garantit.
- **#155 (notifications en temps réel)** garde le jeton dans l'URL du WebSocket, ce qui s'écarte de #148. À trancher avant la fusion : soit B aligne sur #148, soit O note l'écart comme accepté. Sinon elle reste en V1.2, comme prévu au § 6.
- **Point 3 du § 8** : il ne reste que #361 et #266.

### Contraintes d'après la coupe (O, 18/11)

1. **OK de Q** : #389 en 3d3ad2e et #403 en 4228d7a. Si la tête change, l'OK tombe et Q relit la nouvelle tête.
2. **Ordre de fusion** : #403 est empilée sur #389. On re-cible d'abord #403 sur `main`, puis on fusionne #389, puis #403. Sinon, la fusion de #389 laisse #403 sans base.
3. **#238 et #389** : la PR fusionnée en second retire `AUTHZ_BACKEND` des exceptions du contrôle de parité des réglages. Le contrôle doit rester vert sans cette exception.
4. **#407 puis #401** : OK de Q pour #407 en 98d2317. B empile #401 sur #407. On re-cible d'abord #401 sur `main`, puis on fusionne #407, puis #401.
5. **#400 et #401** : elles sont en conflit. La PR fusionnée en second résout le conflit.
