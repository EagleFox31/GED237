# File de fusion V1.1 : entrée prête à coller (après la coupe)

- **Pour** : O, file de fusion V1.1. Préparé par l'innovateur le 18/11 au soir, à partir de `plan-fusion-v1.1.md` (§ 2 à § 6 et § 9) et du relevé `gh pr list` des PR ouvertes du 18/11.
- **Aucune fusion V1.1 avant le 19/11 après 18:00** (O).
- **Fenêtre de fusion V1.1 jusqu’au samedi 05/12 à 18:00, gel le dimanche 06/12, tag le lundi 07/12** (O, 18/11, nuit ; `DEC-2026-008`). Le 06/12 : CI complète sur `main`, rejeu UAT, notes de version ; aucune fusion.
- **Liste du 19/11 à 18:00** : re-cibler #181 sur `main` avant de fusionner #152 (§ 3 ; O, 18/11).
- **Consignes aux auteurs (O, 18/11)** : #421 (convention `e2e/unit/`, OK de Q) est en file. Une PR qui ajoute une spec et entre en conflit sur `playwright.unit.config.ts` garde la configuration de #421 telle quelle et déplace sa spec dans `e2e/unit/` avec `git mv`.
- **Décision du PO (18/11) : « on repousse rien ».** #359, #155, #169, #370, #404, #355, la suite de #211 et la pagination du journal sont en V1.1. La règle « réserve de Q < 1 → sortie en V1.2 » est retirée.
- **Exclus de ORDER** : les branches `feat/v12-*` sauf #370, l’étiquette `v1.2` sauf #281 et #298 (revenues en V1.1, O, 18/11), et Dependabot (#111, #112, #141, #402, puis les versions majeures #113, #110, #29, #30, revenues en V1.1) : Dependabot passe en vague 6 hors ORDER, une à une (`plan-fusion` lignes 58 et 58 bis).
- **Hors file V1.1** : #104, #121, #408, #409, #412 et #415 suivent le chemin V1.0. Si l'une d'elles n'est pas fusionnée le 19, elle passe en tête de la vague 0, juste après #389 (`plan-fusion` § 7).
- **Capacités post-rc1 (§ 6)** : elles sont placées selon la recommandation du plan. Sans réponse du PO le 23/11, on applique cette recommandation (§ 4 ci-dessous).
- **Fusion par trains (PO, 19/11, 12:35 ; `DEC-2026-011`)** : à partir du 24/11, O monte des trains de PR prêtes, testés une fois ensemble ; procédure et ordre dans `procedure-trains-fusion.md`. L'ordre de ORDER reste l'ordre de fusion à l'intérieur d'un train.

## 1. ORDER

Une ligne par vague. L'ordre à l'intérieur d'une ligne est l'ordre de fusion.

```bash
# Vague 0 : socle (24/11 matin)
# Avant la file (ou en tête de la vague 0) : PR de convention de F pour playwright.unit.config.ts ; ensuite chaque PR ne fait que déplacer sa spec (simulation de Q, 18/11 : 109 PR, 61 en conflit avec main). C’est #421 (OK de Q, en file le 18/11).
# Tête de file (O, 19/11) : #464 (correctif 1.0 de /trash, OK de Q, fusionnée).
# Décision du PO (19/11, remplace celle du matin) : pas de coupe de release/v1.0.0 avant 95 % du CDC prouvés (30,5/32). Ni gel de main ni PR de report.
# La paire doublons (#152, #181, #171, #199) fusionne dans main avant toute autre PR. Ces PR sortent du brouillon sur décision d'O, par exception à la règle du 24/11. #104 (HORS_FILE) passe après #199. La coupe vient ensuite, dès 30,5/32 (DEC-2026-010, plan-fusion-v1.1.md § 1 bis et 1 quater).
# Décision du PO (19/11, via O) : la suppression définitive se fait dans un écran dédié du super-administrateur (choix de l'institution sur sa page corbeille), PR à part de F, à inscrire dès qu'elle a un numéro. Le tenant_admin reste sans purge.
# Écart signalé le 19/11 (B l'a confirmé) : l'import d'un dossier (ingest-directory, dossier surveillé) ne classe pas les DOCX, XLSX, TXT ni CSV. Issue et version (V1.0 ou V1.1) à décider par O.
# #467 (LEC-3, contrôle « Lessons register frozen », Q, brouillon) : fin de vague 0, avant toute PR qui ajoute une leçon (DEC-2026-009).
ORDER_V0="464 152 181 477 482 479 171 199 480 485 389 403 383 467"
# Vague 1 : petites PR sans migration (24 et 25/11) ; #433 (outils de pilotage, hook forbidden-words) en brouillon jusqu’à la coupe du 19/11, 18:00, puis relue par Q (O, 18/11)
ORDER_V1="222 227 224 234 237 394 405 240 243 245 253 281 235 238 248 267 268 433 431 435 468 429 437 449 448 454 438 466 465 444 440 455 439 442 419 447 434 424 428 443 486 487"
# Fin de vague 1 : #447 (issue #413), #434 (issue #414) et #424 (pagination du journal d’audit, GO du PO le 18/11) (O, 18/11 au soir)
# Vague 5, après 401 (et après 184) dès qu’elle a un numéro : suite de #211 (F, empilée sur #401 ; PO, 18/11)
# Vague 2 : lecture des documents, OCR (25 et 26/11)
ORDER_V2="184 462 301 179 262 302 372 370 284 311 384 386 387 388 404 355 290 338 426 436 488 445 457 463 453 456 458"
# Vague 3 : périmètre et audit, lot 11 (26/11)
ORDER_V3="241 213 261 263 308 296 266 221 361 282"
# Vague 4 : capacités post-rc1, selon le PO (30/11 au 02/12)
ORDER_V4="309 310 153 155 169 471 147 197 162 180 154 212 172 193 219 186 165 192 209 205 168 182 190 170"
# Vague 5 : fiche document, équipe, droits, confort (01 au 03/12)
ORDER_V5="283 293 295 285 297 342 294 303 347 298 362 407 401 400 391 396 392 351 354 371 373 366 367 377 398 395 359 344 353 399 416 446 417 441 484 450 459"
# Vague 6 : outils et documentation (03 au 05/12, 18:00)
ORDER_V6="335 312 189 166 451 452"
ORDER="$ORDER_V0 $ORDER_V1 $ORDER_V2 $ORDER_V3 $ORDER_V4 $ORDER_V5 $ORDER_V6"
# Hors file V1.1 (chemin V1.0, voir plus haut). #385 : bancs de mesure OCR, hors file par son titre. #313 : V1.2, empilée sur #295 (§ 3). Dependabot, branches feat/v12-* et étiquette v1.2 : exclues par règle. Contrôle : verif-file.sh
# #474 (jeton de type access exigé, aide-api, V1.0, base main) : HORS_FILE, à fusionner avant #155 et #471. #473 (mesure de l'item 8, 100 000 documents, aide-api, brouillon) : HORS_FILE.
# #475 (Q, hooks pre-commit dans un conteneur, réparation du hook, empilée sur #433 docs/outils-pilotage) : HORS_FILE, suit #433. #152 fusionnée le 19/11 (main = 6162d867).
# #474 fusionnée le 19/11 (main = da09df90). #477 (Q, import hors ligne des images sur overlay2, item 28 prouvé, OK de B et de Q) : dans ORDER_V0, série d'O une à une : #181, #477, #171, #199. Le SHA de référence de l'item 28 est celui de main après la fusion de #477 (DEC-2026-010).
# #478 (montée starlette 1.10, fastapi 0.165, pydantic 2.9 ; remplace #113 ; brouillon) : HORS_FILE, en vague 6 avec Dependabot, une à une. #113 se ferme quand #478 fusionne. #481 (Python 3.13, remplace #110, aide-api, brouillon) : même traitement ; #110 se ferme quand #481 fusionne.
# #480 (B, classement à l'import des fichiers que l'OCR ne lit pas, V1.0, base main, tête c6c13c7e) : dans ORDER_V0 après #199, sous réserve de l'OK de Q (O, 19/11). #479 (aide-api, la déconnexion révoque toute la session, V1.0, base main, relecture Q) : dans ORDER_V0 juste après #482 (série V1.0 d'O : #477, #482, #479, #171, #199, #480, puis la PR du ticket #483) ; OK de code de Q, OK final après les tests d'aide-api ; toujours avant #471.
# #482 (Q, ops/ : la sauvegarde s'arrête avant toute écriture si l'image d'aide manque ; après la relance d'api, nginx est relancé et /health vérifié ; base main, tête 0eb1eaca ; OK de B le 19/11, avec 2 remarques non bloquantes : COMPOSE_FILE de la pile TLS à documenter, valeur de BACKUP_HEALTH_TRIES non contrôlée) : juste après #477. Sa fusion donne le demi-point de l'item 31 (PO, 19/11).
# #477 fusionnée le 19/11 (main = 65d3eaaa, item 28 acquis, 29/32). #482 mise à jour sur main (c895018b), CI en cours. #485 : nouvelle tête 3a918eeb (doc seule, OK de Q). #199 est re-ciblée sur main par O.
# #482 fusionnée le 19/11 (main = 9542b4d5, item 31 acquis). Suite de la série V1.0 : #479, #171, #199, #480, #485. Essai 100 000 (item 8) : heure ferme visée 12:30, sur signal d'O.
# #486 (Q, nginx retrouve l'adresse de api après une sauvegarde ou une restauration ; brouillon V1.1, base main, tête 810b8ee6) : fin de la vague 1, après #443. Preuve de Q : 502 sur main, 200 en 24 s avec le correctif, sans relancer nginx (HTTP et HTTPS). Image nginx:1.30-alpine ; reprise d'environ 30 s documentée (installation.md § 9).
# #487 (B, doublon à la restauration, partie serveur ; brouillon V1.1, base main, tête b713486c) : la restauration réussit toujours, la réponse ajoute identical_document {id, title} ou null, rien n'est désigné hors du périmètre de lecture. Décision du PO du 19/11, 11:40. La PR écran de F suit, empilée sur #199 (à re-cibler sur main avant la fusion de #199) : à placer après #487.
# #488 (B, un 3e agent dans le service du jeu de démo, pour prouver la création et l'annulation d'une délégation avec #445 et #453 ; brouillon V1.1, base main, tête cbcfab77) : placée dans la vague 2 juste avant #445 et #453. #171 est fusionnée (main = d3f53564) : pour l'item 19 il reste #199.
# #485 (écran de revue du classement, ticket #483) est fusionnée (main = 32c6552b) : le point « revue incomplète » est retiré du § 6 de la checklist. #393 est fermée, remplacée par #362 (déjà en vague 5).
# #484 (Q, contrastes AA, lot 8 point 4 : liste des documents, fiche, parapheur ; brouillon V1.1, tête b5aafabe) : empilée sur #441 (base feat/v11-a11y-keyboard), à re-cibler sur main avant la fusion de #441 ; vague 5 juste après #441, DEP[484]=441. Pas encore jouée au navigateur : ajoutée par O aux contre-tests du prochain lot d'audit.
# Ticket #483 (défaut de l'écran de revue du classement, V1.0) : PR #485 de B (tête 79dd873c, relecture Q ; branche fix/review-sync-ingest-ocr, base main ; deux cas, plus un script de rattrapage lancé d'abord en plan, puis avec --apply, sans suppression), dans ORDER_V0 juste après #480 ; rattrapage ajouté à la checklist de recette (ligne 1.2 bis). #449 : tête 58d75f7b (brouillon V1.1). #199 a encore pour base feat/post-rc1-trash-ui (#181 fusionnée) : à re-cibler sur main avant sa fusion.
# #471 (0ec2b5dd, brouillon V1.1, empilée sur #155 : à re-cibler sur main avant la fusion de #155) : OK sécurité de B, contrôle final de Q en cours ; reste en vague 4, après #155 et #479 (DEP). #181 fusionnée le 19/11 (main = 2174cfd3). Suites de sécurité d'aide-api (une PR à venir, base main : ticket WebSocket lié à la session, sockets fermés à la déconnexion, vérification de l'Origine) : après #479 et #471.
# #476 (aide-api, n° 14 du tri de l'audit : total et page suivante dans « Mes Documents », V1.1, base main) : HORS_FILE (O, 19/11). Même fichier Documents.tsx que #440 : à rebaser après #440.
HORS_FILE="104 121 408 409 412 415 385 313 460 461 469 470 472 473 474 475 476 478 481"
```

Écarts avec `plan-fusion-v1.1.md` (validés par O le 18/11) :
- **Ajoutées** : ces PR étaient ouvertes mais absentes des vagues.
  - #394 et #405 (déblocage d'un compte, #135) : après #237, car elles touchent aussi `users.py`. #405 est empilée sur #394.
  - #398 : la partie écran de #377, juste après #377.
  - #399, #416 et #417 en fin de vague 5. #416 et #417 sont les deux XS du Lot 6 (lignes 57 quinquies et 57 sexies du plan).
  - #361 : en vague 3, après #221.
  - #431 (57 L14-1) et #435 (export de l’audit pour plusieurs acteurs) en fin de vague 1 ; #435 passe en vague 3 si elle n’est pas corrigée et recontrôlée par (G) le 24/11 au matin. #436 (57 L10-3, deux migrations) en fin de vague 2, après la chaîne OCR ; 57 L10-3 bis (`pg_trgm`) la suit (O, 18/11 au soir).
  - PR ouvertes le 18/11 au soir (O). En fin de vague 1 :
    - #429, une seule règle pour décider quelles étapes sont les tâches de l'utilisateur ; elle sert de base à #438 et à #445 ;
    - #437, garde de la route /audit (L13-5) ;
    - #438, motif de rejet et nouvelle soumission (L12-B), empilée sur #429 ;
    - #444, nom du valideur, empilée sur #438, juste après elle (OK de Q sur 531fec72, O, 18/11 au soir) ;
    - #440, filtre « À corriger » (L12-2), après #438 ;
    - #439, recherche sur tous les documents depuis le filtre d'une page (L14-2, B) ;
    - #442, pastille du menu Tâches (L13-3).
  - #445 (L4 côté serveur, délégation pendant une absence, aide-api) arrive en fin de vague 2, après #436. Elle est empilée sur #429 et porte la migration `7680f303299d`. Elle passe donc entre #436 et #197 dans la chaîne alembic (`plan-fusion` § 4). Si elle n'est pas prête à la fin de la vague 2, elle garde sa place dans la chaîne. #197 attend alors #445, ou O retire `DEP[197]="445"` et remet `DEP[197]="436"`.
  - #441, accès au clavier du Lot 8, va en fin de vague 5. Elle touche les cartes de documents, la zone de dépôt et les dialogues, qu'elle partage avec de nombreuses PR. La passer en dernier limite les conflits.
  - #424 (pagination du journal d’audit) en fin de vague 1 ; #426 (57 L10-1 : `/documents?q=` cherche aussi dans le texte OCR, aide-api) en vague 2, juste avant #436 ; #446 (accessibilité de la connexion et des tâches, F), empilée sur #416, juste après elle (O, 18/11 au soir).
  - Trouvées par le contrôle exhaustif (`verif-file.sh`, 18/11 au soir) : #448 (garde de /reports, empilée sur #437) juste après #437 ; en fin de vague 1, sans migration, #419 (commande « premier administrateur », issue #411, avant #447 selon l’ordre de travail de B), #428 (profils de démo masqués dans l’image de production, la petite PR de F après #423) et #443 (retrait de la page `NeedsReviewInbox` inutilisée). #385 (bancs OCR) et #313 (V1.2) vont dans `HORS_FILE`.
- **Mise à jour attendue après fusion** (simulation à blanc de Q sur 20 PR, O, 18/11 au soir) : dans chaque paire, la seconde fusionnée fusionne `main` et se met à jour, puis repasse chez Q si sa tête change. #438 puis #445 (`workflows.py`) ; #426 puis #436 (`documents.py`) ; #433 puis #436 (`lessons-learned.md`) ; #440 puis #441 (`Documents.tsx`) ; #442 puis #441 (`DocumentDetailModal.tsx`) ; #435 puis #445 et #449 puis #445 (`audit.py` : le filtre sur plusieurs `user_id` contre le `or_` sur `on_behalf_of`). La résolution est chez aide-api, et son test de filtre est à rejouer sur la tête fusionnée (OK final de Q sur #445 6003d93e, O, 18/11 dans la nuit) ; #454 puis #453 (`Sidebar.tsx` et `App.tsx` : #453 se met à jour en gardant les deux côtés) ; #448 puis #453 (`App.tsx`) et #453 puis #446 (`WorkflowTasks.tsx`), résolues en gardant les deux côtés (Q, O, 18/11 dans la nuit) ; #435 puis #453 et #449 puis #453 (`AuditLogs.tsx`, résolution chez F) ; #456 se met à jour après #435 et #449 (`audit.py`), #438 (`workflows.py`) et #442 (`DocumentDetailModal.tsx`), puis #441 après #456 (`DocumentDetailModal.tsx`). #456 ne partage aucun fichier avec #453 ni avec #455 (relevé `gh pr diff`, 19/11) ; #426 puis #457 (`documents.py`, seul fichier commun) : #457 se met à jour en gardant sa structure et en y ajoutant la branche OCR de #426 (résolution de Q, O, 19/11).
- **Ouvertes le 18/11 dans la nuit (O)** :
  - #449, L13-6 « Mes dernières actions » (B). Elle est empilée sur #435 et en conflit fonctionnel avec la garde /audit de #437, relevé par Q. Elle passe donc juste derrière #437, la plus tardive des deux, avec `DEP[449]="435 437"`. Il faut la re-cibler sur `main` avant la fusion de #435. Si #435 passe en vague 3, #449 la suit ;
  - #450, fenêtre d'ajout sur petit écran (F). Elle est empilée sur #441 et passe juste derrière elle, en fin de vague 5 ;
  - #451, tests backend plus rapides (aide-api, `tests/conftest.py` seul). Elle n'a pas de dépendance et va en vague 6, avec les outils ;
  - #452, scénario de démo, file V1.1, `verif-file.sh` et LESSON-2026-069 (I), en vague 6. Elle est en brouillon jusqu'à la coupe, et Q relit la tête finale ;
  - #453, écran des remplacements pendant une absence (L4, F, 3ddba884). Sa base est `main`, mais elle utilise l’API de #445 (son filtre « au nom de » passe par le paramètre serveur `on_behalf`) : elle passe juste derrière #445, en fin de vague 2, avec `DEP[453]="445"` ;
  - #454, menu Rapports pour tous les profils autorisés sur /reports (F, 3a6817b7). Elle est empilée sur #448 (garde de /reports) et passe juste derrière elle, avec `DEP[454]="448"`. Il faut la re-cibler sur `main` avant la fusion de #448 ;
  - #455, L13-2 accueil (B). Elle est empilée sur #438 et passe derrière #438 et #440, avec `DEP[455]="438 440"`. Il faut la re-cibler sur `main` avant la fusion de #438 ; Q a validé la tête ca6dcf41 (O, 19/11).
  - #456, 57 L12-5 « réassigner une tâche en cours » (B, 056e8842). Elle est empilée sur #445 et passe juste derrière #453, en fin de vague 2, avec `DEP[456]="445"`. Il faut la re-cibler sur `main` avant la fusion de #445 ;
  - #457, 57 L10-3 bis `pg_trgm` (aide-api, 12c4d6c6). Elle est empilée sur #445 et porte la migration `60e40a686375`, qui suit `7680f303299d`. Elle passe juste derrière #445, avec `DEP[457]="445"`, et `DEP[197]` passe de 445 à 457 (chaîne alembic, `plan-fusion` § 4). Il faut la re-cibler sur `main` avant la fusion de #445. Si elle n'est pas prête en fin de vague 2, remettre `DEP[197]="445"`. B, porteur de #197, devra alors repartir de `7680f303299d` au lieu de `60e40a686375`. Q a validé la tête 12c4d6c6 (O, 19/11).
  - #458, L3 « texte des fichiers Word et Excel lu au dépôt » (aide-api, base `main`, e70353d9, sans migration). Elle passe en fin de vague 2, derrière les PR de recherche, sans `DEP`. Simulation `git merge-tree` du 19/11 : aucun conflit avec #426, #457, #436, #445 ni #404. Elle partage `documents.py` et `classification_review_service.py` avec #184, #168, #182, #241, #213, #261 et #263, mais ces PR sont déjà en conflit avec `main` sur ces deux fichiers : elles se mettent à jour à leur tour, comme prévu.
  - #463, départage du tri de `/search` pour des pages stables (aide-api, brouillon, sans migration ni LESSON). Elle est empilée sur #457 (base `feat/v11-api-trigram`) et passe juste derrière #457 en vague 2, avec `DEP[463]="457"`. Il faut la re-cibler sur `main` avant la fusion de #457 (O, 19/11). Simulation du 19/11 : aucun conflit avec sa base ; contre `main`, aucun conflit en plus de celui de #457 (`lessons-learned.md`).
  - #459, Lot 11 points 4 et 5 « aperçu Excel allégé et progression des gros PDF » (F, base `main`, d169cefe, interface seule). Elle passe en fin de vague 5, derrière #401, sans `DEP`. Simulation `git merge-tree` du 19/11 : aucun fichier commun avec #458 (serveur seul) ni avec #450. Nouveaux conflits, absents face à `main` : `documents.api.ts` avec #181, #302, #182, #296, #361 et #401, et `client.ts` avec #401. Toutes ces PR fusionnent avant elle, donc #459 seule se met à jour, en gardant les deux côtés (résolution chez F).
  - Hors file, vers `main` avant le gel de 17:15 (O, 19/11) : #460 (F, ec2e9ae4) répare les 2 tests `search-highlight` cassés depuis 2d20a028 ; #461 (F, 46d7ff15) ajoute LESSON-2026-068 (heredoc). **Après la fusion de #460**, #438, #445 et #446 fusionnent `main` : sur `search-highlight.spec.ts`, `searchHighlight.ts` et `HighlightedExcerpt.tsx`, on prend la version de `main` (leurs versions étaient identiques à `main` avant #460). Simulation `git merge-tree` : #438 et #446 sans conflit ; #445 en conflit sur `lessons-learned.md` seulement, on garde les deux ajouts, ceux de `main` d'abord. **Numéros de LESSON** : #460 et #461 prennent 067 et 068 sur `main`. Il faut donc renuméroter les doublons : LESSON-2026-068 de #436 (Alembic, reprise par #445, #456 et #457) et LESSON-2026-067 de #433 (I). Les nouveaux numéros sont proposés à O le 19/11.
- **À ouvrir, hors des vagues tant que la PR n’existe pas** : la réparation du hook pre-commit (Q, 0,5 h-s), après #433.
- **#462** (F, #418, sélection multiple dans l’explorateur, brouillon) : empilée sur #184 (base `feat/post-rc1-undo-ui`), inscrite juste derrière #184 en vague 2, `DEP[462]="184"`. À re-cibler sur `main` avant la fusion de #184 (O, 19/11 ; F débloque #184 d’abord). Simulation du 19/11 : aucun conflit avec sa base ; contre `main`, elle hérite des trois conflits de #184 (`documents.py`, `docker-compose.yml`, `client.ts`) et en ajoute un, `frontend/e2e/unit/explorer-keys.spec.ts`, à traiter par F à la mise à jour.
- **« #152 après #401 » est levé** : c'était l'ordre de travail de B, pas une contrainte de fusion. **Mise à jour (O, 18/11)** : #152 seule passe en tête de la vague 2 (OK du PO, a47df85, OK de Q). Le reste du groupe corbeille (#181, #184, #168, #171, #190, #199, #301, #302) reste en vague 4 ; #181, empilée sur #152, est re-ciblée sur `main` avant la fusion de #152 (plan-fusion § 3).
- **#155 et #169 restent en V1.1** (PO, 18/11 : « on repousse rien »).
- **Choix par défaut d'O, en attendant F et B** :
  - #395 gardée, #349 fermée (F, 18/11) ;
  - #401 gardée, #211 fermée ; sa suite (corbeille groupée avec annulation, Ctrl+Espace) revient en V1.1, empilée sur #401, après #184 (PO, 18/11) ;
  - dans les deux cas, ce qui manque est porté avant la fermeture.
- **#370, #404 et #355 en V1.1** (PO, 18/11) : #370 (`feat/v12-ocr-robustesse`, brouillon) entre en vague 2 après #372 ; #404 la suit, puis #355. #284 passe après #370, car elle la recoupe (§ 9 de `plan-fusion`).
- **Paires de conflit de Q (O, 18/11 au soir ; `plan-fusion` § 10)** : #181, #184 et #301 suivent #152 en tête de la vague 2, puis #179, #262 et #302 (remontées de la vague 4, O, 18/11 au soir) ; `DEP[400]="401"`. Chaque auteur fusionne `main` juste avant d’entrer en file. #389 puis #403 confirmé par O (O re-cible #403 sur `main` avant la fusion de #389) ; « #404 avant #415 » est sans objet (#415 fusionnée). Contrôle relancé : 112 PR, aucune violation.

## 2. DEP

`DEP[n]="a b"` : la PR n attend la fusion de a et de b. Une seule clé par PR.

```bash
declare -a DEP
# Piles (la base doit être fusionnée)
DEP[403]="389"; DEP[401]="407"; DEP[405]="394"
# Après la chaîne OCR (O, 18/11 au soir)
DEP[436]="387"
# Piles et suites ouvertes le 18/11 au soir (O) ; #445 porte une migration (chaîne alembic, plan-fusion § 4)
DEP[438]="429"; DEP[466]="438"; DEP[448]="437"; DEP[444]="438"; DEP[446]="416"; DEP[440]="438"; DEP[445]="429 436"
# Ouvertes le 18/11 dans la nuit (O) : #449 empilée sur #435 et en conflit fonctionnel avec la garde /audit de #437 (Q) ; #450 empilée sur #441
DEP[449]="435 437"; DEP[450]="441"; DEP[453]="445"; DEP[454]="448"; DEP[455]="438 440"; DEP[456]="445"; DEP[457]="445"; DEP[463]="457"
DEP[386]="384"; DEP[387]="386"; DEP[311]="284"; DEP[238]="235"
DEP[267]="248"; DEP[268]="248 389"
DEP[213]="241"; DEP[221]="213"; DEP[261]="213"; DEP[263]="213"; DEP[308]="263"
DEP[262]="179"; DEP[310]="262"; DEP[309]="179 262"
DEP[293]="283"; DEP[295]="293"; DEP[297]="285"; DEP[303]="294 293"
DEP[181]="152"; DEP[184]="181"; DEP[462]="184"; DEP[301]="152 181"; DEP[302]="301 262"
DEP[190]="181 153"; DEP[199]="181 171"
DEP[212]="154"; DEP[219]="193"; DEP[209]="180"; DEP[205]="165"
# Chaîne alembic (une seule tête) : chaque auteur repose down_revision quand il fusionne main ; alembic heads = 1 tête vérifié avant chaque fusion (O, 18/11)
DEP[197]="457"; DEP[180]="197"; DEP[193]="180"; DEP[186]="193"; DEP[165]="186"; DEP[192]="165"
# Dépendances fonctionnelles (colonne « Dépend de » du plan)
DEP[383]="389"; DEP[222]="389"; DEP[245]="389"; DEP[253]="389"
DEP[227]="222"; DEP[237]="227"; DEP[285]="222"; DEP[234]="224"; DEP[394]="237"
DEP[284]="372 370"; DEP[290]="284"; DEP[338]="290"
DEP[404]="370 372"; DEP[355]="372 404"
DEP[296]="263"; DEP[347]="221"; DEP[342]="297"; DEP[294]="238"
DEP[351]="388"; DEP[344]="383"; DEP[398]="377"; DEP[400]="401"
DEP[168]="152"; DEP[171]="152"; DEP[182]="181"; DEP[170]="190"; DEP[172]="154"; DEP[169]="155"; DEP[471]="155 479"; DEP[484]="441"; DEP[468]="435"; DEP[283]="152"
```

Les contraintes « après X » du plan qui servent seulement à éviter un conflit de fichier (#407 après #293 et #362, #362 après #390, #354 après #351…) ne sont pas dans DEP : l'ORDER les respecte déjà.

## 3. Re-ciblage sur `main` AVANT la fusion de la base

| Avant de fusionner | Re-cibler d'abord sur `main` |
|---|---|
| #389 | #403 |
| #394 | #405 |
| #235 | #238 |
| #248 | #267, #268 |
| #384 | #386 ; puis, avant #386 : #387 |
| #284 | #311 |
| #241 | #213 ; puis, avant #213 : #221, #261, #263 ; puis, avant #263 : #308 et #315 (V1.2) |
| #179 | #262 ; puis, avant #262 : #310 |
| #283 | #293 ; puis, avant #293 : #295 ; puis, avant #295 : #313 (V1.2) |
| #285 | #343 (V1.2) |
| #297 | #333 (V1.2) |
| #294 | #303 ; puis, avant #303 : #352 (V1.2) |
| #407 | #401 : re-cibler #401 sur `main`, fusionner #407, puis #401 (O, 18/11) |
| #152 | #181 ; puis, avant #181 : #184, #190, #199, #301 ; puis, avant #301 : #302 (#211, sur #184, est fermée par défaut) |
| #154 | #212 |
| #193 | #219 |
| #180 | #209 |
| #165 | #205 |
| #429 | #438, #445 ; puis, avant #438 : #444, #455, #466 |
| #416 | #446 |
| #437 | #448 ; puis, avant #448 : #454 |
| #435 | #449 |
| #441 | #450 |
| #445 | #456, #457 ; puis, avant #457 : #463 |
| #184 | #462 |

Toutes ces bases ont été vérifiées sur le relevé `gh` du 18/11. Les PR V1.2 re-ciblées restent ouvertes, et aucune n’est fusionnée avant la fin de la fenêtre V1.1 (05/12, 18:00).

## 4. Avant la fusion : avis du PO ou delta relu par Q

**Avis du PO**
- **Capacités post-rc1 (§ 6)** : #147, #152, #153, #154, #162, #165, #168, #170, #171, #172, #179, #180, #181, #182, #184, #186, #190, #192, #193, #197, #199, #205, #209, #211, #212, #219. Sans réponse le 23/11, on applique la recommandation du plan. Les lignes « retravailler » (#184, #182, #190, #212, #193, #180, #205) attendent leur rebase.
- **Réponse du PO (18/11, par O) : « on repousse rien ».**
  - #155 et #169 restent en V1.1 (vague 4). Le jeton dans l'URL du WebSocket (écart à #148) reste à trancher par B et O avant la fusion de #155 (`plan-fusion` § 9). Réponse proposée le 19/11 : #471 (L13-4, aide-api, empilée sur #155). Elle reprend le ticket à usage unique de #323 (B) et fusionne juste après #155. Relecture sécurité par Q.
  - #359 entre en vague 5. #378 est fermée (F, 18/11) au profit de #422 (`LOGIN_DEMO_HINTS`, fusionnée) ; il reste à F une petite PR après #423 : `ARG VITE_LOGIN_DEMO_HINTS` dans l’image front de production, sans quoi un build de prod affiche encore les profils de démo.
  - #370, #404 et #355 entrent en vague 2 ; la suite de #211 en vague 5 ; la pagination du journal (#424) en fin de vague 1.
  - Lecture de l'innovateur, à confirmer par O : les capacités post-rc1 du § 6 marquées « retravailler » sont retravaillées, pas sorties.

**Arbitrages en cours**
- **#404 et #355 (réglé, 18/11)** : #404 dépend de #370 ; le PO fait entrer #370 en V1.1, donc les trois passent dans l’ordre #370, #404, #355.
- **#349 et #395, #211 et #401 (réglé, 18/11)** : #395 et #401 gardées ; #349 fermée par F, #211 à fermer.
- **Têtes envoyées à Q (B, 18/11)** : #401 en 650f7fb ; #152 en 987f08d (delta de DEC-2026-006), puis **a47df85 : OK de Q, OK du PO, en tête de la vague 2** (O, 18/11). L’OK de Q sur #401 est à noter quand il arrive.
- **Ordre de travail de B** : l'issue #411 (commande « premier administrateur »), puis les issues #413 et #414. #413 est devenue #447 (garde-fou `SECRET_KEY`, sans migration), en fin de vague 1 ; #414 est #434 (contrôles au rafraîchissement, sans migration, OK de Q sur ae0b0ecf), placée après #447 (O, 18/11 au soir).
- **#284** est peut-être obsolète, car elle recoupe #370 et #372 (§ 9). B confirme. Si elle est fermée : re-cibler #311 sur `main`, vérifier ce que #290 lit sur `/ocr`, et retirer #284 de l'ORDER et des DEP (#311, #290).

**Delta relu par Q** (règle : si la tête change, l'OK tombe ; toute PR CONFLICTING repasse donc chez Q après son rebase)
- **Deltas connus** :
  - #152 : DEC-2026-006 (ligne 59 de `policy.csv` retirée, tests 403, `tenant_id` pris en compte seulement avec `tenants manage`, test « tenant_admin + autre `tenant_id` », audit qui nomme le tenant visé) ;
  - #168 : 403 au lieu de 200 ;
  - #241 et #213 : réduites par B, nouvelle relecture ;
  - #238 ou #389 : la seconde fusionnée retire `AUTHZ_BACKEND` des exceptions de parité ;
  - #248 : changements demandés à relire sur 2d73db6 ;
  - #308 : rouge en 8a5c0e5 ;
  - #303 et #205 : diff à réduire ;
  - #180 : vérifier qu'il ne reste rien de #183 ;
  - #182 : ne garder que les tests ;
  - #361 et #266 : revue de recouvrement de B d'abord ;
  - #401 : re-relecture après le re-ciblage, avec le conflit #400/#401 ;
  - #391 et #396 : le conflit sur la ligne 65 de `document-detail.page.ts` (on garde la ligne commentée).
- **Sans OK de Q** : #253, #372, #370, #404, #355, #359, #284, #311, #384, #386, #387, #388, #290, #338, #282, #283, #285, #347, #362, #351, #354, #371, #373, #366, #367, #377, #398, ~~#378~~ (fermée), #342, #344, #353, #401, #400, #393, #394, #405, #399, #416, #309, #147, #155, #168, #170, #172, #212, #448, #419, #428, #443.
- **OK sur un code ancien, périmé ou sans SHA noté** : #235, #238, #267, #268, #261, #263, #266, #296, #221, #262, #310, #301, #302, #293, #295, #297, #294, #303, #179, #162, #193, #197, #180, #209, #165, #205, #186, #181, #184, #211, #190, #182, #199.
- **OK valides sur la tête au 18/11** : #152 (a47df85), #389 (3d3ad2e), #403 (4228d7a), #383 (c19e95b), #222 (99d3d09), #224 (0b8eb15), #237 (ae555e4), #240 (1798847), #407 (98d2317), #391 (9a943d3), #392 (fc71aad), #396 (93feb87), #153 (cbf28bc), #154 (720a30f), #171 (3198885), #192 (7c32940), #395 (OK de Q selon O, SHA à noter), #417 (24d86bf, OK de code de Q, O 18/11), #434 (ae0b0ecf, O 18/11 au soir), #447 (89ca0f11), #441 (7819235f), #424 (e949a0cb ; validée aussi dans le navigateur par (G) : 200 lignes en page 1, 80 en page 2), #446 (4b643f8c), #444 (531fec72, O 18/11 au soir ; l’OK tombe au re-ciblage si la tête change). Ceux de #227, #234, #243 et #245 tomberont au rebase (CONFLICTING).
