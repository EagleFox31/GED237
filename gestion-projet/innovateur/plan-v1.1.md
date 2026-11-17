# Plan V1.1, à partir du tag du 24/11

Une page, pour O. Innovateur, 17/11/2026, sur `main` b43e95f. Les PR et les tickets sont relevés par `gh` le 17/11. L'ordre détaillé des fusions reste celui de `plan-fusion-post-rc1.md` § 8.6. Ce plan ne fait qu'y placer les lots.

## Lots

Les efforts sont en heures de session (h-s) : B pour le backend, F pour le frontend, Q pour la relecture et les passes ciblées. Ils comprennent le rebasage, la relecture et la CI. Une CI complète dure environ 11 min sur `main` (relevé du 17/11).

| Ordre | Lot | PR et tickets | Effort (h-s) | Dépendances |
|---|---|---|---|---|
| 1 | **Reste de la file post-rc1** | Étape 1 : #179, #153, #155. Étape 2 : #197 → #162 → #180 → #183 → (lot 2) → #193 → #219 → #186 → #165 → #192. Étape 3 : #209, #194, #205. Étape 4 : #152 → #181 → #184 → #211 → #182 → #190. Étape 5 : #196 → #203 → #213 → #220 ; #171 → #199. Hors chaîne : #147, #166, #189, si elles ne sont pas fusionnées le 19. | ≈ 17 : B 5 (4 `down_revision` à reposer, rebasages), F 2, Q 10 (6 PR de plus de 1 500 lignes : #193, #183, #180, #182, #205, #197) | Chaîne alembic à une seule tête (§ 8.6). Pour l'étape 5, l'accord du PO (fiche 209add1, questions 2 à 6). #219 est empilée sur #193, et #220 sur #213. |
| 2 | **#154 avec SMTP, et la garde de démarrage** | #154 (canal du code et renvoi), puis #212 (refus de démarrer en production sans canal), empilée sur #154 | ≈ 4 : B 3 (transport SMTP à côté de Resend ≈ 2,5, d'après la veille dca4c87 ; la garde de #212 accepte le canal SMTP ≈ 0,5), Q 1 | Le transport SMTP doit être dans #154 **avant** son tour dans la chaîne, entre #183 et #193. #212 vient juste après #154. |
| 3 | **Archivage et documents à revoir pour l'administrateur d'institution** | #228. Aujourd'hui, archiver (`PATCH` du statut) et `GET /documents/needs-review` exigent `documents, manage`, que seul `super_admin` a (`policy.csv` l. 37). | ≈ 2,5 : B 1,5 (deux actions dédiées, par exemple `documents, archive` et `documents, review`, données à `tenant_admin`, avec un test par rôle), F 0,5 (afficher les boutons), Q 0,5 | Après #222, qui touche aussi `policy.csv`. Après l'étape 5, qui fixe la portée. Accord du PO (fiche, question 10 ; par défaut V1.1). Ne pas donner `documents, manage`, qui ouvre aussi la purge et le reclassement. |
| 4 | **Audit des modifications d'utilisateur** | #225, corrigé par #227 (déjà ouverte, +164 lignes) | ≈ 0,75 : B 0,25, Q 0,5 | Après #222 : les deux touchent `users.py`, la seconde se rebase. Sans migration. |
| 5 | **Profil modifiable par soi-même, et réglages lus par l'application** | #222 (#216) ; #224 (#214), backend seul ; #230, frontend, sans PR à ce jour | ≈ 3 : B 0,5, F 1,5 (#230 : l'application lit `GET /config/features` et cache les fonctions désactivées), Q 1 | #222 : liste blanche par défaut (fiche, question 8). Les deux sont sans migration et indépendantes de la chaîne : elles peuvent fusionner dès le 24. |
| 6 | **E23 à E25** | #229 : « Gérer les permissions » sans action ; accents « A verifier » et « Parametres » ; pas d'entrée « Audit » pour l'auditeur. | ≈ 2,5 : F 1,5, Q 0,5, innovateur 0,5 (lignes du guide 70, 109, 146, 232 et 242) | Après #230, si E23 et E25 passent par les réglages. Réponse du PO (fiche, question 7 ; par défaut V1.1). |
| 7 | **Dependabot** | #112 (pytest 9), #141 (npm), #111 (python, 25 paquets), puis une à une : #113 (starlette 1.10), #29 (TypeScript 7), #30 (ESLint 10), #110 (Python 3.15) | ≈ 4 : B 2, F 1, Q 1 | Après le 30 (décision O du 17/11), et **après** les lots 1 à 6, pour ne pas faire rebaser 30 PR sur des fichiers de verrouillage changés. Les versions majeures passent une par une, CI complète à chaque fois. Pour #113 et #110, la compatibilité avec FastAPI et les roues de PyTorch est `À vérifier`. Sans roue disponible, #110 est fermée et reportée. |

**Total ≈ 34 h-s** : B ≈ 13, F ≈ 6,5, Q ≈ 14,5, innovateur 0,5.

**Ordre de passage** :
1. Dès le 24 : lots 5 et 4 (#222 → #227 → #224), sans migration, en parallèle de l'étape 1 du lot 1.
2. Lot 1 avec le lot 2 à sa place dans la chaîne.
3. Lot 3, puis lot 6.
4. Lot 7 en dernier.

## Date de fin réaliste

**Toutes les fusions faites le vendredi 04/12. Tag V1.1 possible le lundi 07/12**, après une recette nocturne verte et une restauration rejouée sur la tête de `main`.

Hypothèses :
1. **Q est le goulot** (≈ 14,5 h-s). Du 24 au 30, la démo l'occupe : tag, poste prêté le 25 ou le 26, démo. Il ne donne qu'environ 2 h-s par jour à `main`, soit ≈ 10 h-s. Le reste (≈ 4,5 h-s) se fait les 1er et 2/12.
2. **Une session donne environ 6 h-s utiles par jour**. Les fusions passent une par une : la règle stricte de `main` impose une branche à jour, puis environ 11 min de CI par PR de code. Les ≈ 30 fusions prennent donc environ 6 h d'horloge, réparties sur plusieurs jours.
3. **Le PO répond aux questions de la fiche 209add1 avant le 23**, ou accepte les choix par défaut. Sinon, l'étape 5 et les lots 3 et 6 glissent d'autant, et la fin passe au 09/12.
4. **Tickets créés par O le 17/11** : #228 (lot 3), #229 (lot 6), #230 (lot 5, frontend). Ils restent à faire.
5. **Aucune reprise lourde** : ni conflit de migration hors de la règle de chaînage, ni version majeure de Dependabot qui casse la CI. J'ai prévu une marge d'environ 20 % (le 03 et le 04/12) pour une reprise de ce type.
6. **Hors périmètre** : l'essai sur 100 000 documents (décembre), #204 (suite TOTP) et les tickets ouverts hors lots (#201, #185, #149, #136, #135, #133, #145).
