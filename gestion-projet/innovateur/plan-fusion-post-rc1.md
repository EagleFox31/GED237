# Plan de fusion post-rc1 (`main` rouverte dès le 19/11)

- **Pour** : O (décideur), B, F, Q. Innovateur, 2026-11-17, sur `main` c216141, mis à jour le 17/11 sur `main` 33b2425 après la décision du PO (§ 8). Instruction seulement : O tranche chaque point marqué **Décision O**.
- **Sources** : PR ouvertes au 17/11 (`gh pr view`, base, fichiers, migrations, corps) ; règle du § 6 du plan de B (`gestion-projet/dev-backend/plan-post-rc1-dix-capacites.md`, branche `feat/post-rc1-l1-health-ready`) ; `release-demo.md` § 3 ; `checklist-demo.md` ; LESSON-2026-029. `Vérifié` = lu dans GitHub ou `main` ; `Déduit` = raisonnement.
- **Calendrier (17/11, après la décision du PO)** :
  - le 19 après la fusion de #104, O coupe `release/v1.0.0` sur `main`, et `main` rouvre aussitôt ;
  - la recette du 20 au 23, le tag `v1.0.0-rc.1` du 24, une rc.2 éventuelle et la démo du 30 se font tous sur `release/v1.0.0` ;
  - du 20 au 23, Q est pris par la recette.

> **Les § 0, 1, 4, 5 et 6 ci-dessous sont l'état d'avant la décision du PO. Le § 8 les remplace.** La linéarisation alembic (§ 2), les reciblages (§ 3) et les ajouts du § 7 restent valables.

## 0. Point bloquant : la rc.2 est taguée depuis `main` (remplacé par le § 8)

`Vérifié` : « `v1.0.0-rc.2` (si correctifs de recette après le 24) : au plus tard vendredi 27/11 matin … le tag monté sur les postes de démo est le dernier rc ». Toute PR post-rc1 fusionnée le 25 ou le 26 partirait donc dans la rc.2, et donc dans la démo.

| Option | Effet | Coût |
|---|---|---|
| **A (recommandée)** | Le 25 et le 26, `main` ne reçoit que les correctifs de recette et la documentation. Les fusions post-rc1 commencent le 27, après la pose de la rc.2 ou la décision « pas de rc.2 ». Si un correctif est nécessaire après le 27, la branche `release/v1.0.0` est créée depuis le dernier tag rc, et le correctif y est appliqué par cherry-pick. | La fenêtre de fusion passe de 5 à 3 jours. Les passes ciblées tournent quand même le 25 et le 26, sur les branches des PR. |
| B | La branche `release/v1.0.0` est créée dès le 24 depuis `v1.0.0-rc.1`. La rc.2 est taguée sur cette branche, et `main` est libre dès le 25. | Une procédure nouvelle la semaine de la démo, avec des cherry-picks à reporter dans les deux sens. |

**Décision O du 17/11** : option A (§ 6). **Remplacée le 17/11 par une variante de l'option B, sur décision du PO** : la coupure se fait le 19 et non le 24 (§ 8).

## 1. Ordre de fusion

Ordre de O, corrigé sur cinq points (`Vérifié` dans les corps et les bases des PR) :

1. **#191 est une issue**, pas une PR (« Rapports : suites de la relecture de #188 (V1.1) »). Je la retire de l'ordre ; c'est **#196** qui la traite (§ 7).
2. **#184 (annulation, écran)** utilise le contrat PATCH de #179, et son corps dit « Ne pas fusionner avant #152 ». Donc **#179 passe avant #184**, et non après la chaîne L2.
3. **#182 (5da2d38) contient les heads de #181 (ca54b13) et de #184 (70a49f5)**. En revanche, il ne contient ni le dernier commit de #152 (7fa8a3d) ni celui de #179 (cf4e434) (`Vérifié` : `git merge-base --is-ancestor` et `git cherry`, le 17/11). D'où trois règles :
   - #152 et #179 fusionnent d'abord.
   - L'auteur de #182 y intègre ensuite `main`.
   - **#184 fusionne juste avant #182, sans aucune autre fusion entre les deux.**

   Si O préfère ne pas fusionner #184 seule, elle se ferme par la fusion de #182. Il faut seulement qu'elle soit déjà reciblée sur `main` (§ 3) : GitHub la marque alors fusionnée quand son head entre dans `main`. Recommandé : la fusion explicite de #184, car elle garde sa propre relecture dans l'historique. Le même raisonnement vaut pour #181, contenue elle aussi dans #182.
4. **#190 (bannette, écran) est empilée sur la branche de #181** et inclut aussi #153. Elle dépend donc de #181 **et** de #153 : la chaîne L3 se fusionne après la chaîne L2.
5. **#193 (TOTP)** porte une migration et change le parcours de connexion : je la sépare de #154 et la place après le 30 (§ 5).

`Vérifié` : #181 modifie `frontend/package.json` d'une seule ligne, l'ajout du script `"test:unit"`. Ce n'est **pas** une dépendance, donc pas de conflit avec le gel des dépendances.

| Créneau | PR, dans l'ordre | Condition |
|---|---|---|
| avant le tag du 24 | #198 (correctif rc.1 du menu) | avant #121, qui reste la dernière fusion avant le tag (§ 7) |
| 25–26 | #166, #189 (docs) ; PR docs du scénario de démo | aucune (aucun effet à l'exécution) |
| 25–26 | **passes ciblées sur les branches des PR**, sans fusion : #168, #170, #172, #169 et #182 (§ 4) | Docker uniquement |
| 27 (après rc.2) | #147 (L1) | aucune passe (§ 6 de B) |
| 27 | #152 (L2) → #179 → #181 → #184 → #182 | passe #168 verte + #182 verte + accord PO écrit ; reciblages du § 3 faits avant ; `main` intégré dans #182 après #152 et #179 ; #184 juste avant #182, sans écart (ou close par #182, point 3) |
| 28 | #153 (L3) → #190 | passe #170 verte + accord PO écrit ; #190 après #181 et #153 |
| 28 | #154 (L4) ; #155 (L6) | passes #172 et #169 vertes + accord PO écrit |
| 29 | aucune fusion | marge ; `main` stable pour la veille |
| après le 30 | #161 → #197 → #162 → #180 → #183 → #194 ; #193 ; #186, #165, #192 ; #171 ; #196 ; PR brouillon de #195 | § 5 et § 7 |

**Les dates des créneaux sont remplacées par le § 8.2.** L'ordre des PR et les conditions d'enchaînement de ce tableau restent valables.

Les PR de passe (#168, #169, #170, #172) fusionnent juste après la PR qu'elles couvrent, dans le même créneau. Si une passe échoue, sa chaîne passe après le 30. Les autres chaînes ne bougent pas.

## 2. Linéarisation alembic

`Vérifié` : head de `main` = `a7c8d9e0f1b2`. #161, #165, #186, #192 et #193 partent toutes de ce head. #180 et #183 sont déjà empilées sur #161.

| Rang | PR | Révision | `down_revision` aujourd'hui | `down_revision` à poser |
|---|---|---|---|---|
| 1 | #161 | `eff6822a5320` | `a7c8d9e0f1b2` | inchangé |
| 2 | #180 | `b9d4e2f7a1c3` | `eff6822a5320` | inchangé |
| 3 | #183 | `c3e8a5d1f2b7` | `b9d4e2f7a1c3` | inchangé |
| 4 | #193 | `d4e8b2c6a1f3` | `a7c8d9e0f1b2` | **`c3e8a5d1f2b7`** |
| 5 | #186 | `d4f1b6c2e8a9` | `a7c8d9e0f1b2` | **`d4e8b2c6a1f3`** |
| 6 | #165 | `8aed3f3826d7` | `a7c8d9e0f1b2` | **`d4f1b6c2e8a9`** |
| 7 | #192 | `c9f2a7d4e1b6` | `a7c8d9e0f1b2` | **`8aed3f3826d7`** |

#197 n'ajoute aucune révision : elle porte la migration `eff6822a5320` de #161, qu'elle contient (§ 7). La chaîne ne change pas.

Head final : `c9f2a7d4e1b6`. **Attention : `d4e8…` (#193) et `d4f1…` (#186) se ressemblent. Il faut recopier les identifiants, pas les retaper.** Chaîne retenue telle quelle par O le 17/11.

Pour chaque PR rebasée, l'auteur fait les trois points suivants, dans Docker uniquement :

- Il met à jour `down_revision` **et** la ligne `Revises:` de la docstring.
- `alembic heads` doit renvoyer **une** ligne.
- Il lance `alembic upgrade head` sur `test_ged`, puis le downgrade d'un cran et l'upgrade.

Après chaque fusion, il lance `alembic upgrade head` sur `edossier` et `test_ged` (leçon « DB » des règles du projet). Si O change l'ordre, la chaîne se recalcule dans le nouvel ordre : chaque PR prend pour `down_revision` la révision de la PR fusionnée juste avant elle.

## 3. PR empilées à recibler sur `main` (LESSON-2026-029)

GitHub ferme une PR empilée quand la branche de base est supprimée à la fusion. Chaque reciblage se fait donc **avant** la fusion de la PR de base, par l'auteur, avec `gh pr edit N --base main`.

| PR empilée | Base actuelle (PR) | Recibler avant la fusion de |
|---|---|---|
| #181 | `feat/post-rc1-l2-trash` (#152) | #152 |
| #184 | `feat/post-rc1-trash-ui` (#181) | #181 |
| #190 | `feat/post-rc1-trash-ui` (#181) | #181 |
| #194 | `feat/post-rc1-l9-quality-alerts` (#183) | #183 |

Après le reciblage, le diff montre aussi les commits de la base jusqu'à sa fusion. C'est attendu : relire seulement le diff propre une fois la base fusionnée.

## 4. Passes ciblées et accord écrit du PO

Règle du § 6 de B (`Vérifié`) : entre le 24 et le 30, seule L1 fusionne sans passe ciblée. L2, L3, L4 et L6 exigent leur passe **et** un accord écrit du PO.

| Lot | PR | Ce qui change | Passe (PR) | Exécutant | Drapeau par défaut |
|---|---|---|---|---|---|
| L2 | #152, #181, #184 | DELETE envoie à la corbeille, la purge refuse un document actif | écran suppression + corbeille (#168) | Q + F | — |
| L3 | #153, #190 | service de bannette commun | chemin de validation de bout en bout (#170) | Q | `WORKFLOW_INBOX_ENABLED=false` |
| L4 | #154 | code OTP haché dans Redis | connexion complète, code faux, verrouillage (#172) | Q | `AUTH_OTP_CHANNEL=dev_response` |
| L6 | #155 | WebSocket refuse un jeton de rafraîchissement ou révoqué | cloche + WebSocket avant et après déconnexion (#169) | Q + F | `NOTIFICATIONS_BROADCAST_MODE=off` |
| hors § 6 | #179, #182, #184 | annulation et reclassement (issue #151) : touche le fil « classement » de la démo | #182 | Q | — |

**Décision O du 17/11** : #179 est traitée comme L2 (passe #182 et accord du PO).

Un drapeau éteint par défaut ne dispense pas de la passe : L4 change le stockage du code sans drapeau (`Déduit` du § 6).

Pour l'accord du PO, je propose un commentaire sur chaque PR de lot, de la forme « Accord PO du JJ/11 : fusion de #N avant le 30, passe #M verte (lien du run) ». O le recueille le 26. Sans accord, la chaîne passe après le 30.

## 5. Gel avant la démo : ne fusionne pas avant le 30

| PR | Lot | Motif |
|---|---|---|
| #161, #180, #183, #194 | L5b, L9 | table de B : L9 et le PDF de L5 après le 30 ; migrations |
| #197 | L5 (PDF) | table de B : PDF de L5 après le 30 ; nouvelle dépendance `reportlab==5.1.0`, or les dépendances sont gelées jusqu'au 30 |
| #196 | issue #191 | règle de portée des rapports (V1.1) ; PR brouillon |
| PR de #195 (à ouvrir) | issue #195 | portée de `unit_admin` en recherche et en liste (V1.1) ; accord du PO sur la portée d'abord |
| #162 | L8 | table de B : après le 30 |
| #165 | L7 | table de B : après le 30 ; migration |
| #193 | L4 (TOTP) | migration + parcours de connexion ; aucune passe dédiée (#172 ne couvre que le renvoi d'OTP) |
| #186 | L14 | migration ; prérequis de la mesure de charge, pas de la démo |
| #192 | L13 | migration ; planification de la sauvegarde, à prouver par une restauration (Q) |
| #171 | L11 | aucune passe définie ; touche les doublons montrés en démo |

**Le gel de ce § 5 est levé sur `main` depuis la coupure du 19 (§ 8.3).** Il ne vaut plus que pour `release/v1.0.0`.

Règle proposée à O (levée sur `main` le 17/11, § 8.3) : **aucune migration sur `main` avant le 30**. Avec l'option A, un correctif de dernière minute partirait de `release/v1.0.0` : le tag de démo resterait sans migration nouvelle, et la base de démo garderait sa révision.

## 6. Décisions de O du 17/11

Les points 1, 3 et 4 sont remplacés par le § 8. Les points 2, 5, 6 et 7 restent valables.

1. **Option A** (§ 0). Le 25 et le 26, `main` ne reçoit que la documentation et les correctifs de recette, et les passes ciblées tournent sur les branches des PR. Les fusions post-rc1 commencent le 27, après la rc.2 éventuelle. Un correctif tardif passe par la branche `release/v1.0.0`, créée depuis le dernier tag.
2. **#179 est traitée comme L2** : passe ciblée (#182) et accord du PO.
3. **Aucune migration sur `main` avant le 30** : règle retenue.
4. **#147 fusionne le 27**, comme les autres, sans exception.
5. **Chaîne #152 → #179 → #181 → #184 → #182**, avec une fusion explicite de #184 : retenue.
6. **Chaîne alembic du § 2** : retenue telle quelle.
7. Fiche d'accord du PO pour le 26 : `accord-po-fusions-26-11.md`.

## 7. Ajouts de O du 17/11 : #195 à #198

`Vérifié` le 17/11 (`gh pr view`, `git merge-base --is-ancestor`, diffs des branches).

- **#198, correctif rc.1 du menu** (retire l'entrée d'administration qui ouvrait la page introuvable) : fusion **avant le tag** du 24, et avant #121, qui reste la dernière fusion avant le tag. Pas de draft, base `main`.
- **#197, PDF du rapport officiel (L5)** : gelée jusqu'au 30, fusion **juste après #161**.
  - Sa base GitHub est `main`, mais sa branche **contient** #161 (head 80c3ea9, ancêtre de #197). Aucun reciblage n'est donc nécessaire. En revanche, tant que #161 n'est pas fusionnée, le diff de #197 montre aussi #161.
  - **#197 ne doit jamais fusionner avant #161** : elle ferait entrer #161 et sa migration sans sa propre relecture.
  - Elle n'ajoute pas de migration ; elle ajoute la dépendance `reportlab==5.1.0` (`requirements.txt`), d'où le gel.
- **#196 traite l'issue #191** (brouillon, base `main`). Elle passe la règle de portée des rapports en **défaut fermé** : seuls `tenant_admin` et `auditor` voient toute l'institution, tout autre rôle est limité à son unité et à ses sous-unités. #196 et #161 ne se touchent pas dans les mêmes fichiers, mais **la seconde fusionnée casse les tests de l'autre** :
  - `resolve_report_scope` prend désormais `db` en paramètre, alors que `tests/services/test_reports_scope.py` de #161 l'appelle sans.
  - Le test `test_user_without_role_is_not_restricted` de #161 attend l'ancien défaut ouvert.
  - Le test `test_scoped_role_on_another_unit_is_refused` de #161 est à relire : avec #196, une sous-unité est permise.

  Règle de O : **la PR fusionnée en second** adapte `tests/services/test_reports_scope.py` de #161 au défaut fermé, avant sa fusion. Si #196 fusionne après #161, c'est donc #196 qui le fait.
- **#195 est une issue** (portée de `unit_admin` en recherche et en liste des documents, alignée sur les rapports, V1.1). B ouvre une PR brouillon. Elle fusionne **après l'accord du PO sur la portée**, et donc après le 30.

## 8. Décision du PO du 17/11 : `release/v1.0.0` coupée le 19, `main` rouverte

Décision transmise par O : « go dès que possible ». Elle remplace l'option A (§ 0), les dates du § 1, le gel du § 5 sur `main` et les points 1, 3 et 4 du § 6.

### 8.1 Les deux lignes

| | `release/v1.0.0` | `main` |
|---|---|---|
| **Créée / ouverte** | Le 19, coupée par O sur `main` juste après la fusion de #104. | Rouverte dès la coupure, à toutes les PR post-rc1, migrations comprises. |
| **Ce qui y entre** | La PR des notes de B, les correctifs de recette ou de démo, puis #121, **en dernier**. | Les PR post-rc1, dans l'ordre du § 1, ainsi que la recopie des correctifs faits sur la release. |
| **Tags et usage** | Recette du 20 au 23, `v1.0.0-rc.1` le 24, rc.2 éventuelle, démo du 30. | Aucun tag avant le 30. Release Please après le 30 (`fiche-adopt-release-please-apres-30.md` § 9). |
| **Gel** | Ni migration, ni dépendance, ni fonctionnalité. | Aucun gel. |
| **Contrôle** | La check-list `checklist-tag-rc1-24-11.md` est mise à jour pour la release. | La règle du § 8.2 s'applique du 20 au 23. |

**Correctif de recette ou de démo** : une PR vers `release/v1.0.0`, puis sa recopie vers `main` :
- La recopie est une PR distincte, en `git cherry-pick -x` du commit de la release, ouverte le même jour par l'auteur du correctif.
- Si `main` a divergé (par exemple après la chaîne L2 sur la suppression), l'auteur adapte la recopie, et Q la relit comme une PR neuve.
- Un correctif qui demande une migration n'entre **pas** sur la release : il devient un écart annoncé, ou une décision O.

### 8.2 Créneaux de fusion sur `main`

Contrainte de O : du 20 au 23, Q est pris par la recette. **Pendant ces quatre jours, seules entrent sur `main` les PR déjà relues par Q.**
- Est « relue par Q » une PR qui porte un commentaire de relecture de Q avec un verdict.
- Toutes les PR post-rc1 sont encore en brouillon et n'ont aucune revue GitHub (`gh pr view`, le 17/11). Le compte est commun, donc la revue GitHub ne peut pas servir de preuve.
- Q donne la liste des PR relues le 19 avant 18:00, en une ligne.

| Créneau | PR, dans l'ordre du § 1 | Condition |
|---|---|---|
| 19, après la coupure | #166, #189 (docs) ; #147 (L1) | relues par Q ; CI Gate verte |
| 20–23 | La suite de l'ordre du § 1, **seulement les PR relues par Q avant le 20**. | Chaîne L2 et L3 : passes ciblées vertes (§ 4). Q les lance, donc en pratique seulement si elles sont faites avant le 20. |
| 24 (après le tag) → 30 | Chaînes L2 (#152 → #179 → #181 → #184 → #182), L3 (#153 → #190), L4 (#154), L6 (#155) | passes ciblées vertes ; reciblages du § 3 faits avant |
| dès que relue par Q (au plus tôt le 24, sauf si relue avant le 20) | Chaîne des migrations #161 → #197 → #162 → #180 → #183 → #194 ; puis #193, #186, #165, #192 | ordre alembic du § 2 ; #197 juste après #161 (§ 7) |
| après la réponse du PO du 23 | #171 (doublons) ; #196 et la PR de #195 (portée) | accord écrit du PO sur le fond (`dossier-decisions-po-23-11.md`) |

**Ordre détaillé : voir le § 8.6 (décision O du 17/11). Il prime sur les lignes « L2 » et « migrations » ci-dessus.**

Il n'y a plus de journée « sans fusion » le 29 : la démo ne dépend plus de `main`.

### 8.3 Règles levées, et celles qui restent

- **Levée sur `main`** : « aucune migration avant le 30 » (§ 5) et le gel des dépendances pour les PR post-rc1, dont #197 et `reportlab`. Les deux gels ne valent plus que pour `release/v1.0.0`.
- **Accord écrit du PO pour L2, L3, L4 et L6** (§ 4) : il protégeait la démo, qui est désormais sur la release. **Décision O du 17/11** : pas de nouvel accord du PO, son « go dès que possible » couvre L2 à L6 sur `main`. On garde seulement la passe ciblée verte. Les accords de fond du § 8.2 (doublons et portée) restent nécessaires.
- **PR Dependabot** (#29, #30, #110 à #113, #141) : la levée du gel les rend possibles sur `main`. **Décision O du 17/11** : après le 30.
- **Restent** : les passes ciblées (§ 4), la chaîne alembic (§ 2), les reciblages (§ 3) et « la PR fusionnée en second adapte les tests de portée » (§ 7).

### 8.4 Base de recette et base de développement (nouveau risque)

Dès le 19, `main` peut porter des migrations que la release n'a pas. Si une base passe à la tête de `main`, puis sert à faire tourner la release, le code de la release tourne sur un schéma qu'il ne connaît pas.
- **Règle** : les postes de recette et de démo, ainsi que la pile e2e de la release, ne tournent que depuis un worktree de `release/v1.0.0`, avec leur propre volume de base de données.
- On ne lance jamais `alembic upgrade head` depuis un checkout de `main` sur une base de recette ou de démo.
- Après chaque fusion de migration, l'`alembic upgrade head` du § 2 ne vise que les bases de développement (`edossier` et `test_ged` du poste de dev).

### 8.5 Points à régler avant le 20 (`Vérifié` le 17/11)

1. **La branche `release/v1.0.0` ne sera pas protégée.** Le seul ruleset du dépôt, « AppFactory default branch governance », ne vise que `~DEFAULT_BRANCH`. Sans autre règle, n'importe qui peut pousser directement sur la release, la réécrire ou la supprimer, et une PR vers elle n'exige aucun check.
   - **Décision O du 17/11** : O crée un ruleset `release/**` séparé de celui d'AppFactory, juste après la coupure du 19, puis le relit. Ses règles : `deletion`, `non_fast_forward`, `pull_request` (0 approbation, fils résolus) et CI Gate strict avec `do_not_enforce_on_create`. Le contrôle correspondant est l'étape E1 bis-2 de la check-list.
   - `ci_gate` doit de toute façon être vert avant chaque fusion sur la release.
2 bis. **Décision O** : O ne coupe pas la release tant que la PR `ci.yml` de Q (`release/**` dans `push` et `pull_request`) n'est pas fusionnée sur `main`.
2. **`ci.yml` ne se déclenche que sur `main` et `develop`** (`push` et `pull_request`). Q y ajoute `release/**` avant le gel, comme décidé par O, **dans les deux déclencheurs**. Cet ajout doit être fusionné sur `main` **avant la coupure** pour se retrouver sur la release.
3. **La recette nocturne planifiée ne tourne que sur la branche par défaut** (cron de `e2e-uat-nightly.yml`). Sur la release, elle se lance à la main par `gh workflow run e2e-uat-nightly.yml --ref release/v1.0.0` (check-list § 1, E3 bis, et § 2).
4. **#121 et la PR des notes de B ont `main` pour base** (`Vérifié` pour #121). Leurs auteurs les reciblent juste après la coupure, avec `gh pr edit <n> --base release/v1.0.0`, puis les rebasent sur la release.

### 8.6 Ordre de fusion sur `main` après la coupe (décision O du 17/11)

Chaque PR fusionne à deux conditions : elle est relue par Q et sa CI est verte. Q relit dans ce même ordre. La chaîne alembic commande. Cet ordre **remplace** celui des lignes « migrations » et « L2 » du § 8.2. Il est reporté dans la colonne « ordre » de `releve-prs-19-11.md`.

État : ordre accepté tel quel par O le 17/11 (1152a1a). #161 est fermée, remplacée par #197 (mêmes commits, même migration `eff6822a5320`) ; la chaîne commence par #197 → #162 → #180 (O, 17/11). La place de #179, #153, #155, #194, #190 et #196, ainsi que le passage de #203 à l'étape 5 (écart E), sont **proposés** par l'innovateur. O tranche.

| Étape | PR, dans l'ordre | Propriétaire | Condition propre |
|---|---|---|---|
| 1. Indépendantes, sans migration | #179, #153, #155 | B | #179 ouvre la voie à #184, #153 à #190. #155 n'a pas de suite |
| 2. Chaîne des migrations | #197 → #162 → #180 → #183 → #154 → #212 → #193 → #186 → #165 → #192 | B | règle de chaînage ci-dessous. #197 remplace #161 ; #162 (sans migration) avant #180, qui l'embarque ; #212 (sans migration, empilée sur #154) juste après #154 (O, 17/11) |
| 3. Interfaces empilées | #209 après #180 ; #194 après #183 ; #205 après #165 | F | reciblées sur `main` après la fusion de leur base |
| 4. Corbeille et validation | #152 → #181 → #184 → #211 → #182 → #190 | B (#152), F (#181, #184, #211, #190), Q (#182) | #179 fusionnée avant #184 ; #153 et #181 fusionnées avant #190. Passes ciblées vertes (§ 4) |
| 5. Après l'accord écrit du PO | #196 → #203 → #213 ; #171 → #199 | B (#196, #203, #213, #171), F (#199) | aucune ne fusionne avant l'accord, même relue et verte (décision D). #213 (correctif de sécurité #202) est empilée sur #203, sans migration. O pose la question manager/lecteur au PO dès le 17/11 : si elle est tranchée avant le 23, #196 → #203 → #213 peut remonter. #199 après #182 et #171 |

**Règle de chaînage des migrations (décision O du 17/11)** : quand la PR précédente de la chaîne est fusionnée, l'auteur de chaque PR à migration repose son `down_revision` sur la nouvelle tête de `main`. O ne met aucune PR à migration en file sans `alembic heads` à une seule tête, vérifié en CI ou par Q.

Garde-fou déjà en place sur `main` (vérifié le 17/11) :
- `backend/tests/services/test_schema_check.py` l. 34-35 : `assert len(HEADS) == 1, "multiple Alembic heads: add a merge migration"`. `HEADS` vient de `expected_heads()` (`backend/app/core/schema_check.py` l. 47-49), qui lit les scripts par `ScriptDirectory.get_heads()`.
- La gate backend l'exécute pour tout changement sous `backend/**` (`.github/appfactory-impact.json` l. 23-25). Une PR à migration touche `backend/alembic`, donc la gate tourne toujours.
- La règle de branche de `main` exige « CI Gate » avec `strict: true` : une PR doit être à jour avec `main` avant de fusionner. Le test tourne donc sur l'état combiné, et deux têtes font échouer la CI.
- La leçon 039 porte sur pg_dump et la restauration, pas sur les têtes. **Aucun test ne manque.**
- Limite : une CI verte sur un SHA antérieur à la dernière fusion ne prouve rien. Seule compte la CI du SHA à jour de `main`.

**Têtes alembic relevées le 17/11** (`git show` sur les têtes des branches, fichiers ajoutés par rapport à la base) :

| PR | Révision ajoutée | `down_revision` | Commentaire |
|---|---|---|---|
| `main` | tête `a7c8d9e0f1b2` | — | — |
| #161 (fermée le 17/11) | `eff6822a5320` | `a7c8d9e0f1b2` | remplacée par #197 |
| #197 | `eff6822a5320` | `a7c8d9e0f1b2` | OK (migration reprise de #161) |
| #180 | `b9d4e2f7a1c3` | `eff6822a5320` | OK (embarque la migration de #197) |
| #183 | `c3e8a5d1f2b7` | `b9d4e2f7a1c3` | OK (embarque les migrations de #161 et #180) |
| #154 | aucune | — | — |
| #193 (`f2cc377`) | `d4e8b2c6a1f3` | **`a7c8d9e0f1b2`** | à reposer sur `c3e8a5d1f2b7` (écart B) |
| #186 | `d4f1b6c2e8a9` | `a7c8d9e0f1b2` | à reposer sur `d4e8b2c6a1f3` au rebasage |
| #165 | `8aed3f3826d7` | `a7c8d9e0f1b2` | à reposer sur `d4f1b6c2e8a9` |
| #192 | `c9f2a7d4e1b6` | `a7c8d9e0f1b2` | à reposer sur `8aed3f3826d7` |
| #162, #212, #179, #153, #155, #152, #181, #184, #211, #182, #190, #194, #209, #205, #196, #203, #213, #171, #199 | aucune | — | — |

**Empilements vérifiés le 17/11** (`git merge-base --is-ancestor`, commit par commit) :
- #161 ⊂ #197 ; #162 (1 commit sur 2) ⊂ #180 ; #180 ⊂ #183 ⊂ #194 ; #180 ⊂ #209 ; #154 ⊂ #193 ; #165 ⊂ #205 ;
- #181 ⊂ #184, #182, #190 et #199 ; #184 ⊂ #182 ; #179 (1 commit sur 2) ⊂ #184 et #182 ; #153 ⊂ #190 ;
- #196 (2 commits sur 2) ⊂ #203 ⊂ #213 (6 sur 6) ; #171 (2 commits sur 4) ⊂ #199.

**Décisions de O sur les écarts (17/11)** :
- **A.** #197 embarque #161 : elle passait juste après #161. O a ensuite fermé #161 ; #197 ouvre la chaîne.
- **B.** `down_revision` : règle de chaînage ci-dessus. Elle vaut pour #193, #186, #165 et #192.
- **C.** PR absentes : insérées ci-dessus. O retient #197 → #162 → #180 ; le reste est une proposition, O tranche.
- **D.** L'accord du PO du 23 conditionne #171 **et** #199. Le comportement des doublons est une décision du PO : #171 sort de l'étape 1.

**Écart E (accepté par O le 17/11)** : #203 embarque les deux commits de #196. Sa description dit « Portée à confirmer par le PO avant fusion ». Le projet d'accord du § 4 de `dossier-decisions-po-23-11.md` dit « Fusion après #196 et après le 30 ». La question ajoutée au § 4 du dossier (rapports d'un manager ou d'un lecteur, soulevée par Q) touche aussi #196. Proposition : #196 → #203 passent à l'étape 5, comme #171.
