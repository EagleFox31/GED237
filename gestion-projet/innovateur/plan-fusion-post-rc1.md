# Plan de fusion post-rc1 (25–29/11)

- **Pour** : O (décideur), B, F, Q. Innovateur, 2026-11-17, sur `main` c216141. Instruction seulement : O tranche chaque point marqué **Décision O**.
- **Sources** : PR ouvertes au 17/11 (`gh pr view`, base, fichiers, migrations, corps) ; règle du § 6 du plan de B (`gestion-projet/dev-backend/plan-post-rc1-dix-capacites.md`, branche `feat/post-rc1-l1-health-ready`) ; `release-demo.md` § 3 ; `checklist-demo.md` ; LESSON-2026-029. `Vérifié` = lu dans GitHub ou `main` ; `Déduit` = raisonnement.
- **Calendrier** : tag `v1.0.0-rc.1` le mar. 24 ; rc.2 éventuel au plus tard le ven. 27 au matin (`release-demo.md` l. 37) ; démo le lun. 30. Le 28 et le 29 tombent un week-end.

## 0. Point bloquant : la rc.2 est taguée depuis `main`

`Vérifié` : « `v1.0.0-rc.2` (si correctifs de recette après le 24) : au plus tard vendredi 27/11 matin … le tag monté sur les postes de démo est le dernier rc ». Toute PR post-rc1 fusionnée le 25 ou le 26 partirait donc dans la rc.2, et donc dans la démo.

| Option | Effet | Coût |
|---|---|---|
| **A (recommandée)** | Le 25 et le 26, `main` ne reçoit que les correctifs de recette et la documentation. Les fusions post-rc1 commencent le 27, après la pose de la rc.2 ou la décision « pas de rc.2 ». Si un correctif est nécessaire après le 27, la branche `release/v1.0.0` est créée depuis le dernier tag rc, et le correctif y est appliqué par cherry-pick. | La fenêtre de fusion passe de 5 à 3 jours. Les passes ciblées tournent quand même le 25 et le 26, sur les branches des PR. |
| B | La branche `release/v1.0.0` est créée dès le 24 depuis `v1.0.0-rc.1`. La rc.2 est taguée sur cette branche, et `main` est libre dès le 25. | Une procédure nouvelle la semaine de la démo, avec des cherry-picks à reporter dans les deux sens. |

**Décision O du 17/11** : option A (§ 6).

## 1. Ordre de fusion

Ordre de O, corrigé sur cinq points (`Vérifié` dans les corps et les bases des PR) :

1. **#191 est une issue**, pas une PR (« Rapports : suites de la relecture de #188 (V1.1) »). Je la retire de l'ordre.
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
| 25–26 | #166, #189 (docs) ; PR docs du scénario de démo | aucune (aucun effet à l'exécution) |
| 25–26 | **passes ciblées sur les branches des PR**, sans fusion : #168, #170, #172, #169 et #182 (§ 4) | Docker uniquement |
| 27 (après rc.2) | #147 (L1) | aucune passe (§ 6 de B) |
| 27 | #152 (L2) → #179 → #181 → #184 → #182 | passe #168 verte + #182 verte + accord PO écrit ; reciblages du § 3 faits avant ; `main` intégré dans #182 après #152 et #179 ; #184 juste avant #182, sans écart (ou close par #182, point 3) |
| 28 | #153 (L3) → #190 | passe #170 verte + accord PO écrit ; #190 après #181 et #153 |
| 28 | #154 (L4) ; #155 (L6) | passes #172 et #169 vertes + accord PO écrit |
| 29 | aucune fusion | marge ; `main` stable pour la veille |
| après le 30 | #161 → #162 → #180 → #183 → #194 ; #193 ; #186, #165, #192 ; #171 | § 5 |

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
| #162 | L8 | table de B : après le 30 |
| #165 | L7 | table de B : après le 30 ; migration |
| #193 | L4 (TOTP) | migration + parcours de connexion ; aucune passe dédiée (#172 ne couvre que le renvoi d'OTP) |
| #186 | L14 | migration ; prérequis de la mesure de charge, pas de la démo |
| #192 | L13 | migration ; planification de la sauvegarde, à prouver par une restauration (Q) |
| #171 | L11 | aucune passe définie ; touche les doublons montrés en démo |

Règle proposée à O : **aucune migration sur `main` avant le 30**. Avec l'option A, un correctif de dernière minute partirait de `release/v1.0.0` : le tag de démo resterait sans migration nouvelle, et la base de démo garderait sa révision.

## 6. Décisions de O du 17/11

1. **Option A** (§ 0). Le 25 et le 26, `main` ne reçoit que la documentation et les correctifs de recette, et les passes ciblées tournent sur les branches des PR. Les fusions post-rc1 commencent le 27, après la rc.2 éventuelle. Un correctif tardif passe par la branche `release/v1.0.0`, créée depuis le dernier tag.
2. **#179 est traitée comme L2** : passe ciblée (#182) et accord du PO.
3. **Aucune migration sur `main` avant le 30** : règle retenue.
4. **#147 fusionne le 27**, comme les autres, sans exception.
5. **Chaîne #152 → #179 → #181 → #184 → #182**, avec une fusion explicite de #184 : retenue.
6. **Chaîne alembic du § 2** : retenue telle quelle.
7. Fiche d'accord du PO pour le 26 : `accord-po-fusions-26-11.md`.
