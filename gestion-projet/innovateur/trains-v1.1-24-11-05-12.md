# Trains de fusion V1.1 : du 24/11 au 05/12

Une page pour O. Relevé `gh` du 19/11 vers 16:35, à partir de `file-v1.1.md` (ORDER_V0 à V6, DEP, § 3). Règles de DEC-2026-011 : un train à la fois, testé une fois, puis fusionné par une PR ordinaire vers `main`. Cette page remplace la liste des trains de `procedure-trains-fusion.md`, dont la méthode reste valable.

- **156 PR ouvertes** (dont #503, #504 et #505, ajoutées le 19/11) dans la file. Les 10 autres de la vague 0 sont déjà fusionnées : #464, #152, #181, #477, #482, #479, #171, #199, #480, #485.
- **27 trains de 4 à 6 PR**, 3 par jour ouvré (4 le 24/11, avec TR-03 bis), du mar 24/11 au ven 04/12. Le sam 05/12 jusqu'à 18:00 reste libre pour un train rouge à rejouer.
- Dans un train, la base passe toujours avant sa pile. Une PR n'entre que si ses dépendances (DEP et branche de base) sont fusionnées avant ou plus tôt dans le même train.

**Légende** : ✖ aucun OK de Q trouvé ; ◐ OK du code seul ou réserve, preuve à faire ; ↻ PR empilée, à re-cibler sur `main` avant la fusion de sa base ; ⛓ dépend d'une PR hors file. ⛁ apporte une migration alembic (§ Migrations). Le statut de Q vient d'une lecture automatique de `PASSATION-ci-qa.md` et de `PASSATION.md` : Q le confirme avant chaque train.

| Jour | Train | Vague | PR, dans l'ordre de fusion |
|---|---|---|---|
| mar 24/11 | TR-01 | V0/1 | 389 403↻ 383 467✖ 222 227 |
| mar 24/11 | TR-02 | V1 | 224 234 237 394 405✖↻ |
| mar 24/11 | TR-03 | V1 | 240 243 245 253 |
| mar 24/11 | TR-03 bis | V1 | 281 235 238↻ 503↻ (PR de Q, e2e avec le moteur de droits sql ; 7a5ffd1c relue par B : OK sans réserve, prête) |
| mer 25/11 | TR-04 | V1 | 248 267↻ 268↻ 433 431 435 |
| mer 25/11 | TR-05 | V1 | 468◐↻ 429◐ 437 449◐↻ 448◐↻ 454◐↻ |
| mer 25/11 | TR-06 | V1 | 438↻ 466◐↻ 465 444◐↻ 440 455↻ |
| jeu 26/11 | TR-07 | V1 | 502◐↻ 439 419 447 434 424 |
| jeu 26/11 | TR-08 | V1 | 428 443✖ 486 487 493✖ 494◐ |
| jeu 26/11 | TR-09 | V1/2 | 495✖ 184 462◐↻ 301 179 262✖↻ |
| ven 27/11 | TR-10 | V2 | 302◐↻ 372 370 284 311↻ 384 |
| ven 27/11 | TR-11 | V2 | 386↻ 387↻ 388 404 355 290 |
| ven 27/11 | TR-12 | V2 | 338 426 436⛁ 488 445⛁↻ 457⛁↻ — **migration : `alembic upgrade head` sur edossier et test_ged après fusion** |
| lun 30/11 | TR-13 | V2/3 | 463↻ 453 456↻ 458◐ 241 213↻ |
| lun 30/11 | TR-14 | V3 | 261↻ 263↻ 308↻ 296◐ 266✖ 221↻ |
| lun 30/11 | TR-15 | V3/4 | 361 282 309✖ 310✖↻ 153 155 |
| mar 01/12 | TR-16 | V4 | 169 471↻ 147✖ 197⛁◐ 162✖ 180⛁ — **migration : `alembic upgrade head` sur edossier et test_ged après fusion** |
| mar 01/12 | TR-17 | V4 | 154 212✖↻ 172 193⛁ 219↻ 186⛁ — **migration : `alembic upgrade head` sur edossier et test_ged après fusion** |
| mar 01/12 | TR-18 | V4 | 165⛁ 192⛁ 209↻ 205↻ 168✖ 182 — **migration : `alembic upgrade head` sur edossier et test_ged après fusion** |
| mer 02/12 | TR-19 | V4/5 | 190 170 283 293↻ 295✖↻ 285 |
| mer 02/12 | TR-20 | V5 | 297✖ 342✖ 294✖ 303◐↻ 347 298✖ |
| mer 02/12 | TR-21 | V5 | 329 504✖↻ 362 407◐ 401↻ 400 |
| jeu 03/12 | TR-22 | V5 | 391 396◐ 392◐ 351 354 371 |
| jeu 03/12 | TR-23 | V5 | 373 366 367 377 398◐ 395 |
| jeu 03/12 | TR-24 | V5 | 359 344✖ 353 399✖ 416◐ 446◐↻ |
| ven 04/12 | TR-25 | V5/6 | 417 484✖↻⛓ 459◐ 476✖ 335✖ 312 |
| ven 04/12 | TR-26 | V6 | 505✖ 189✖ 166✖ 451◐ 452 (#505 avant #478, hors file : fusionner main dans #478 ensuite) |

#504 (visas donnés, B, brouillon, f3578334) suit #329 dans TR-21, d'après DEC-2026-014. Pour garder 6 PR par train, la dernière PR de TR-21 à TR-24 (#391, #373, #359, #417) ouvre le train suivant, sans dépendance rompue.

## Re-ciblages d'O, avant le train qui fusionne la base

- **Les quatre cités** :
  - **#190** est déjà sur `main` (relevé de 16:35). Il reste seulement son rebase (« retravailler », § 4 de la file).
  - **#471** (base : branche de #155) est re-ciblée sur `main` avant TR-15, qui fusionne #155.
  - **#484** (base : branche de #441) est re-ciblée avant la fusion de #441 (DEC-2026-013, avant le 24/11).
  - **#502** (base : branche de #438) est re-ciblée avant TR-06.
- **Avant TR-01** : #403. **TR-02** : #405. **TR-03 bis** : #238, puis #503 (base : branche de #238). **TR-04** : #267, #268, puis #468 et #449 (base #435).
- **Avant TR-05** : #448, puis #454 ; #438 et #445 (base #429). **TR-06** : #466, #444, #455, #502.
- **Dès maintenant** : #184 et #301, dont la base (`feat/post-rc1-trash-ui`, #181) est déjà fusionnée. Re-ciblage seul, sans fusion, donc compatible avec le gel (carte des piles d'aide-api, 19/11).
- **Avant TR-09** : #462 ; #262 ; #310 (base #262) ; #302 (base #301). **TR-10** : #311, #386, puis #387.
- **Avant TR-12** : #457, #456, puis #463. **TR-13** : #213, puis #261, #263, #221 ; #308, plus #315 (V1.2, OK final de Q sur 9f322eaa) avant #263.
- **Avant TR-16** : #209 (base #180). **TR-17** : #212, #219. **TR-18** : #205.
- **Avant TR-19** : #293, #295, plus #313 et #343 (V1.2). **TR-20** : #303, plus #333 et #352 (V1.2). **TR-21** : #504 (base : branche de #329), re-ciblée sur `main` avant la fusion de #329 ; #401, fusionnée après #407. **TR-24** : #446.
- **Hors tableau** : #429 remise en brouillon par O (19/11). Les avis du PO du § 4 de la file (capacités post-rc1) restent requis avant leur train.
- **Contrôle croisé avec la carte des piles d'aide-api (19/11, 17:10)** : ses « absentes » sont bien placées. #184 et #301 sont dans TR-09 (numéros écrits sans #). #450 est hors file (DEC-2026-013). #194, #306, #320 et #322 sont en V1.2 (étiquette ou branche `feat/v12-*`), exclues par règle. Les piles à 3 niveaux (#308, #315, #463, #313) suivent l'ordre de re-ciblage ci-dessus, du bas de la pile vers le haut.

## PR sans relecture ni preuve de Q à ce jour (lecture automatique, à confirmer par Q)

- **Aucun OK trouvé (27)** : 467, 405, 443, 493, 495, 262, 266, 309, 310, 147, 162, 212, 168, 295, 297, 342, 294, 298, 344, 399, 484, 476, 335, 189, 166, 504, 505.
### Les 27 sans OK, par risque : Q commence la nuit par le haut

Le classement vient des fichiers modifiés de chaque PR (relevé `gh` du 19/11 vers 16:50), pas d'une relecture du code. À risque égal, Q prend d'abord le train le plus proche.

| Risque | PR (train) | Ce qui est touché |
|---|---|---|
| 1. Migration | aucune | aucune des 27 ne touche `alembic/versions` |
| 2. Droits | #168 (TR-18) | règles d'accès (`policy.csv`, `authz`) |
| | #294 (TR-20) | grille des droits, `casbin_enforcer` |
| | #266 (TR-14) | périmètre par unité : rapports, statistiques, recherche, imports (17 fichiers) |
| | #262 (TR-09) | audit des modifications de documents |
| | #162 (TR-16) | nouvel accès « qualité » et son périmètre |
| | #399 (TR-24) | compteurs du tableau de bord du manager, périmètre |
| 3. Sécurité | #212 (TR-17) | refus de démarrer en production, `auth_service`, compose |
| | #484 (TR-25) | diff actuel de 90 fichiers (dont `authz` et `security.py`), mesuré contre la branche de #441 ; à mesurer de nouveau après re-ciblage sur `main` |
| 3 bis. Après droits et sécurité (O) | #504 (TR-21) | courbe « visas que j'ai donnés » (portée « mine »), `analytics/trends.py` et son test ; 16 tests passés chez B dans Docker, preuve de Q à faire |
| 4. Serveur, sans droits | #505 (TR-26 ; en-tête WWW-Authenticate des réponses d'erreur, `core/errors/handlers.py`), #476 (TR-25), #147 (TR-16), #344 (TR-24), #495 (TR-09), #335 (TR-25) | pagination des documents, sonde `/health/ready`, recherche dans l'audit, tests en `TRUNCATE` et CI, script de test |
| 5. Écran seul | #297 (TR-20), #295 (TR-19), #298 (TR-20), #493 (TR-08), #405 (TR-02), #342 (TR-20), #309 (TR-15), #443 (TR-08), #310 (TR-15) | #297 en tête : actualisation du profil dans `authStore` (15 fichiers) |
| 6. Docs et CI | #467 (TR-01), #189 (TR-26), #166 (TR-26) | #467 change la CI : avant TR-01 |

#467 et #405 sont dans les trains du 24/11 : malgré leur faible risque, elles passent avant TR-01 et TR-02.

- **OK du code seul ou réserve (23)** : 468, 429, 449, 448, 454, 466, 444, 494, 462, 302, 458, 296, 197, 303, 407, 396, 392, 398, 416, 446, 459, 451 (code) ; 502 (réserve).
- **OK de Q du 19/11** (relecture des fusions de `main` par B, rien de `main` perdu) : #153, #154, #165, #169, #170, #172, et #475 hors file. #169, #170 et #172 sortent donc de la liste sans OK.

## Migrations alembic : une seule tête

Relevé du 19/11 vers 16:50 : `revision` et `down_revision` lus à la tête de chaque PR ouverte. Tête unique de `main` (f890b3cb) : `a7c8d9e0f1b2`. Neuf PR des trains apportent une migration, plus #183, hors trains. L'ordre est déjà fixé par les DEP de la file (chaîne alembic, 18/11).

| Ordre | PR (train) | Migration ajoutée | `down_revision` aujourd'hui | `down_revision` attendue à la fusion |
|---|---|---|---|---|
| 1 | #436 (TR-12) | `0f6f64260460` | `a7c8d9e0f1b2` | inchangée |
| 2 | #445 (TR-12) | `7680f303299d` (porte aussi `0f6f64260460`, même contenu que #436) | `0f6f64260460` | inchangée |
| 3 | #457 (TR-12) | `60e40a686375` | `7680f303299d` | inchangée |
| 4 | #197 (TR-16) | `eff6822a5320` | `a7c8d9e0f1b2` | **`60e40a686375`** |
| 5 | #180 (TR-16) | `b9d4e2f7a1c3` (porte aussi `eff6822a5320`, même contenu que #197) | `eff6822a5320` | inchangée |
| 6 | #193 (TR-17) | `d4e8b2c6a1f3` | `a7c8d9e0f1b2` | **`b9d4e2f7a1c3`** |
| 7 | #186 (TR-17) | `d4f1b6c2e8a9` | `a7c8d9e0f1b2` | **`d4e8b2c6a1f3`** |
| 8 | #165 (TR-18), 14151ddd | `8aed3f3826d7` | `a7c8d9e0f1b2` | **`d4f1b6c2e8a9`** |
| 9 | #192 (TR-18) | `c9f2a7d4e1b6` | `a7c8d9e0f1b2` | **`8aed3f3826d7`** |
| suit #180 | #209 (TR-18), 3af5934f, empilée sur #180 | aucune révision propre : elle porte `eff6822a5320` et `b9d4e2f7a1c3`, identiques octet pour octet à celles de #180 | — | rien à changer : après re-ciblage sur `main` (une fois #180 fusionnée), son diff ne touche plus `alembic/versions`. Dans la simulation de Q (17:00), le nombre de têtes ne bouge pas à son étape (5 avant, 5 après) |
| hors trains | #183 | `c3e8a5d1f2b7` (porte aussi `eff6822a5320` et `b9d4e2f7a1c3`) | `b9d4e2f7a1c3` | la tête de `main` au moment de sa fusion |

- **Le risque est réel.** Six révisions descendent aujourd'hui de `a7c8d9e0f1b2` : celles de #436, #197 (donc aussi #180 et #183), #193, #186, #165 et #192. Fusionnées telles quelles, la deuxième crée une seconde tête.
- **Correction** : avant son train, l'auteur de chaque PR en gras fusionne `main` et change seulement la ligne `down_revision`, sans changer l'identifiant `revision`. Si une PR de la chaîne n'est pas prête, la suivante repart de la dernière révision fusionnée.
- **Contrôle de Q avant chaque fusion de ces PR** : `alembic heads` renvoie une seule ligne sur la tête fusionnée, dans un conteneur. Après la fusion de #436, le test `backend/tests/test_alembic_revisions.py`, qu'elle ajoute, échoue en cas de seconde tête (`test_single_head_without_cycle`) : toute PR qui fusionne `main` sans reposer sa `down_revision` devient rouge en CI.
- **Après TR-12, TR-16, TR-17 et TR-18** : `alembic upgrade head` sur edossier et test_ged.
- **À confirmer par B** : aucune base partagée n'a reçu l'une de ces révisions depuis une branche. Si c'est le cas, on ajoute une révision de fusion, comme `e1f2a3b4c5d6` sur `main`, au lieu de changer `down_revision`.
- **Fichiers de conflit récurrents** : `docker-compose.yml`, `backend/.env.example`, `core/config.py`, `workers/celery_app.py` et `tasks.py` (#180, #183, #192). O met la branche à jour au moment de la fusion ; l'auteur résout. La même simulation montre aussi `.env.example` et `config.py` pour #193, #165 et #190, et `docker-compose.yml` pour #155 et #165.

## Capacité de Q

Avec une preuve à la fois, les jours chargés dépassent la capacité de Q : les trois preuves de train plus 7 à 9 preuves de PR par jour (25/11, 26/11, 01/12, 02/12, 03/12 et 04/12). Q fait donc ces preuves de PR en avance, dès maintenant et la nuit, dans l'ordre des trains.
