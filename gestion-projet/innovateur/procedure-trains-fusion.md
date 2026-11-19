# Fusion par « trains » : procédure et ordre pour le 24/11 (V1.1)

Décisions du PO du 19/11, 12:27 (via O) : voir `DEC-2026-011`. Préparé par l'innovateur le 19/11. L'ordre des trains est une **proposition** : O la valide et la change.

## Procédure (O monte et fusionne ; Q et B vérifient)

1. **Qui** : O seul monte et fusionne un train. Il travaille dans un worktree dédié, jamais dans le checkout partagé.
2. **Nom** : `train/v11-NN`, `NN` = le numéro du tableau ci-dessous (`train/v11-01`…). Une branche par train, créée depuis `origin/main` à jour.
3. **Entrée** : une PR ne monte que si elle est hors brouillon, avec CI verte, OK de Q, base `main` (re-cibler les PR empilées avant) et tête notée. Aucune poussée sur la PR entre l'assemblage et la fusion : sinon sa tête change et elle sort du train.
4. **Assemblage** : `git merge --no-ff` des PR dans l'ordre de la ligne du tableau. Les conflits sur les fichiers « additifs » (liste plus bas) sont résolus par O sur la branche du train ; tout autre conflit sort la PR du train, et l'auteur la remet à jour sur `main`.
5. **Test unique** : la suite complète tourne **une fois**, sur la tête du train. La règle « branche à jour » reste vraie : le train part de `main` à jour, et un train ne se monte que sur le `main` du moment.
6. **Train rouge** : O retire la PR fautive (en cas de doute, il relance sans la dernière PR montée, puis sans la suivante), recrée la branche et relance. La PR retirée repasse dans un train suivant, après correction de son auteur.
7. **Fusion** : le train entre dans `main` par une **PR ordinaire** (branche du train vers `main`), fusionnée par `gh pr merge --merge`, jamais par push direct (O, 19/11, 12:50) ; la protection de `main` ne change pas. Pas de squash ni de rebase : GitHub ne marquerait pas les PR du train comme fusionnées. `main` reçoit ainsi la tête **exacte** testée.
8. **Contrôle « fusionnée »** : pour chaque PR du train, `gh pr view N --json state,mergedAt -q '.state'` doit répondre `MERGED`, et `git merge-base --is-ancestor <tête notée> origin/main` doit réussir. Une PR encore ouverte après la fusion n'est fermée à la main qu'après ce contrôle, avec un renvoi vers le commit du train.
9. **Tests non refaits sur `main`** (2e décision) : si l'empreinte de contenu de la tête de `main` est celle du train déjà testé (`git rev-parse <tête>^{tree}`), la CI de `main` ne rejoue pas la suite. Q prépare la PR, B la relit. **#489 est fusionnée (19/11, 12:57, `main` = cbd5b4b9), mais elle ne couvre pas encore les trains : un train passe toujours en complet sur `main` tant que Q n'a pas étendu la dispense (chiffrage demandé par O, avant le 24).**
10. **Trace** : O note dans la file le numéro du train, les PR retirées et le SHA de `main` après chaque train (file-v1.1.md, passation).

## Fichiers « additifs » : conflit toléré, résolu à l'assemblage

`DOCS/engineering/lessons-learned.md` (le contrôle `LEC-3` de #467 s'applique), `frontend/playwright.unit.config.ts` (garder la configuration de #421), `docker-compose.yml`, `backend/app/core/config.py`, `backend/.env.example`, `.env.example`, `frontend/services/index.ts`, `frontend/App.tsx`, `DOCS/exploitation/installation.md`. Ces fichiers sont modifiés par 9 à 26 PR chacun : les exiger sans recoupement donnerait un train par PR.

## Ordre des trains V1.1 (vagues 1 à 6, à partir du 24/11)

- **Vague 0** (14 PR, #464 … #467) : série V1.0 d'O, **une PR à la fois**, hors trains.
- Les PR d'un même train sont montées dans l'ordre de la ligne (c'est l'ordre de `file-v1.1.md`). Deux PR en conflit simulé ne sont jamais dans le même train, et l'ordre relatif de la file est conservé entre elles. Les dépendances `DEP` sont respectées. Un train compte au plus 8 PR.
- Les vagues ne se mélangent pas : un train n'a que des PR d'une même vague.

| Train | Vague | PR, dans l'ordre de montage |
|---|---|---|
| TR-01 | V1 | 222 224 234 240 243 245 253 281 |
| TR-02 | V1 | 227 235 238 248 267 268 433 431 |
| TR-03 | V1 | 237 394 405 435 468 429 437 449 |
| TR-04 | V1 | 448 454 438 466 465 444 440 455 |
| TR-05 | V1 | 439 442 419 447 434 424 428 443 |
| TR-06 | V1 | 486 487 |
| TR-07 | V2 | 184 462 301 179 262 302 372 370 |
| TR-08 | V2 | 284 311 384 386 387 388 290 426 |
| TR-09 | V2 | 404 355 436 488 445 457 463 453 |
| TR-10 | V2 | 338 456 458 |
| TR-11 | V3 | 241 213 261 263 308 296 266 221 |
| TR-12 | V3 | 361 282 |
| TR-13 | V4 | 309 310 153 155 471 147 197 154 |
| TR-14 | V4 | 169 162 212 172 168 182 190 170 |
| TR-15 | V4 | 180 193 219 186 209 |
| TR-16 | V4 | 165 205 |
| TR-17 | V4 | 192 |
| TR-18 | V5 | 283 293 295 285 297 342 294 303 |
| TR-19 | V5 | 347 298 362 407 401 400 391 392 |
| TR-20 | V5 | 396 373 366 367 377 395 359 344 |
| TR-21 | V5 | 351 398 353 399 416 446 417 459 |
| TR-22 | V5 | 354 371 |
| TR-23 | V5 | 441 484 450 |
| TR-24 | V6 | 335 312 189 166 451 452 |

**24 trains pour 146 PR.** Sur la fenêtre du 24/11 au 05/12 (DEC-2026-008), cela fait environ 2 trains par jour ouvré. La vague 4 (TR-13 à TR-17) est la plus longue, à cause de la chaîne #197 → #180 → #193 → #186 → #165 → #192 sur `documents.py`.
n**Cadence avec une CI d'environ 7 minutes (au lieu de 17)** : un train se fait en série, car chacun part du `main` laissé par le précédent. Un cycle dure environ 7 min de CI, plus 10 à 15 min d'assemblage, de contrôle « fusionnée » et de PR (O), soit **20 à 25 min**. Avec 17 min de CI, c'était 30 à 35 min. Capacité théorique : 2 à 3 trains par heure, contre 1,5 avant. Capacité tenable pour O : **6 à 8 trains par jour**, car le goulot passe à la préparation des PR (OK de Q, sortie de brouillon) et aux trains rouges. Les 24 trains tiennent donc en 3 à 4 jours ouvrés au lieu de 5 à 6, largement dans la fenêtre du 24/11 au 05/12. On garde 8 PR par train : un train plus gros ne gagne rien et rend les trains rouges plus coûteux à débusquer.

**#476** (tri n° 14, inscrite dans ORDER_V5 par O le 19/11) : placée **en fin de TR-23**, après #441, #484 et #450. Elle est en conflit simulé avec #487, #471, #459, #440, #401, #371, #361, #351, #296, #168 et #165, tous placés plus tôt. Avec #484, git ne signale aucun conflit, mais les deux modifient le pied de liste de `Documents.tsx` : à relire à la main, l'ordre #484 puis #476 convient.

## Conflits simulés entre deux PR (base `main`, tête du 19/11)

Méthode : pour chaque couple de PR de la file qui modifient le même fichier (hors fichiers additifs), `git merge-tree --write-tree` sur les deux têtes, dans un dépôt jetable. 488 couples simulés, **106 en conflit**, 5 où git a planté (comptés comme conflits par prudence : #162/#180, #179/#182, #197/#162, #199/#182, #487/#182). Les couples avec une PR empilée (base autre que `main`) ne sont pas simulés : l'ordre `DEP` les couvre. À lire : « #155 : #165 #169 » = #155 est en conflit avec #165 et #169, qui viennent après elle.

- #155: #165 #169 #180 #193
- #165: #192
- #168: #283
- #179: #168
- #180: #165
- #182: #283 #351 #354 #362 #371 #391 #392 #396 #400 #407
- #222: #227
- #227: #237
- #235: #182
- #240: #400
- #241: #165 #168 #170 #193
- #243: #297
- #284: #168 #182 #404
- #290: #338
- #296: #351 #371 #459
- #338: #182 #362 #391 #407 #441
- #351: #354 #371 #441
- #355: #182 #338 #351 #354 #371 #391 #392 #396 #407
- #361: #168 #170 #182 #459
- #366: #398
- #370: #168 #182 #192 #458
- #371: #441
- #372: #165 #168 #182 #284
- #384: #168 #182 #192
- #388: #165 #168 #182
- #391: #396
- #392: #351 #354
- #394: #172
- #396: #351
- #404: #165 #168 #182 #192 #458
- #424: #453
- #426: #165 #168
- #429: #170
- #434: #154 #172 #193
- #435: #424 #453
- #436: #165 #168 #192
- #440: #351 #371
- #442: #338
- #453: #297
- #458: #165 #168 #180 #192
- #465: #165 #168
- #487: #165 #168 #361

## Limites

- Les conflits sont simulés **deux à deux**, sur les têtes du 19/11. Trois PR peuvent s'accorder deux à deux et se heurter ensemble : l'assemblage du train le dira. Les têtes bougent : relancer la simulation avant chaque train (script : `merge-tree` sur `refs/pr/N`).
- Un conflit **sémantique** sans conflit de texte (deux PR qui changent le même comportement) n'est pas vu. La suite complète sur la tête du train le voit.
- Les fichiers additifs ne sont pas simulés : leurs conflits sont attendus et se résolvent à l'assemblage.
