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
| 6 | **E23 à E25** | #229, corrigé par #233 (F, brouillon, c37353e) : « Gérer les permissions » sans action ; accents « A verifier » et « Parametres » ; pas d'entrée « Audit » pour l'auditeur. | ≈ 2,5 : F 1,5, Q 0,5, innovateur 0,5 (lignes du guide 70, 109, 146, 232 et 242) | Après #230, si E23 et E25 passent par les réglages. Réponse du PO (fiche, question 7 ; par défaut V1.1). |
| 7 | **Dependabot** | #112 (pytest 9), #141 (npm), #111 (python, 25 paquets), puis une à une : #113 (starlette 1.10), #29 (TypeScript 7), #30 (ESLint 10), #110 (Python 3.15) | ≈ 4 : B 2, F 1, Q 1 | Après le 30 (décision O du 17/11), et **après** les lots 1 à 6, pour ne pas faire rebaser 30 PR sur des fichiers de verrouillage changés. Les versions majeures passent une par une, CI complète à chaque fois. Pour #113 et #110, la compatibilité avec FastAPI et les roues de PyTorch est `À vérifier`. Sans roue disponible, #110 est fermée et reportée. |
| 8 | **Réglages à l'écran et écran des droits** (décision du PO du 17/11, question 12, option C) | #280, en deux lots. 8a, réglages : la durée des sessions, les essais de connexion, la taille maximale d'un envoi, les fonctions activées et le serveur e-mail passent à l'écran du super admin. 8b, écran des droits : rôles × actions à cocher, en français simple, à la place des règles brutes de « Gestion AuthZ ». Les mots de passe techniques restent sur le serveur. | `À chiffrer` par B et F. Ordre de grandeur `Déduit` : 8a ≈ 4 à 6, 8b ≈ 3 | 8a après #154 (serveur e-mail) et #230 (fonctions activées). 8b après le lot 3, qui touche aussi `policy.csv`. |

**Total ≈ 34 h-s** sans le lot 8 : B ≈ 13, F ≈ 6,5, Q ≈ 14,5, innovateur 0,5. Avec le lot 8 et les lots 9 à 14 du § « Mise à jour du 17/11 au soir », le total passe à ≈ 62 h-s.

**Ordre de passage** :
1. Dès le 24 : lots 5 et 4 (#222 → #227 → #224), sans migration, en parallèle de l'étape 1 du lot 1.
2. Lot 1 avec le lot 2 à sa place dans la chaîne.
3. Lot 3, puis lot 6, puis lot 8.
4. Lot 7 en dernier.

## Date de fin réaliste

**Plan initial (34 h-s) : toutes les fusions faites le vendredi 04/12, tag V1.1 possible le lundi 07/12**, après une recette nocturne verte et une restauration rejouée sur la tête de `main`. Revu le 17/11 au soir : voir le dernier §.

Hypothèses :
1. **Q est le goulot** (≈ 14,5 h-s). Du 24 au 30, la démo l'occupe : tag, essai d'installation sans réseau le 25, démo. Il ne donne qu'environ 2 h-s par jour à `main`, soit ≈ 10 h-s. Le reste (≈ 4,5 h-s) se fait les 1er et 2/12.
2. **Une session donne environ 6 h-s utiles par jour**. Les fusions passent une par une : la règle stricte de `main` impose une branche à jour, puis environ 11 min de CI par PR de code. Les ≈ 30 fusions prennent donc environ 6 h d'horloge, réparties sur plusieurs jours.
3. **Le PO répond aux questions de la fiche 209add1 avant le 23**, ou accepte les choix par défaut. Sinon, l'étape 5 et les lots 3 et 6 glissent d'autant, et la fin passe au 09/12.
4. **Tickets créés par O le 17/11** : #228 (lot 3), #229 (lot 6), #230 (lot 5, frontend). Ils restent à faire.
5. **Aucune reprise lourde** : ni conflit de migration hors de la règle de chaînage, ni version majeure de Dependabot qui casse la CI. J'ai prévu une marge d'environ 20 % (le 03 et le 04/12) pour une reprise de ce type.
6. **Hors périmètre** : l'essai sur 100 000 documents (décembre), #204 (suite TOTP) et les tickets ouverts hors lots (#201, #185, #149, #136, #135, #133, #145).

## Mise à jour du 17/11 au soir : nouveaux tickets, piles et contrôle de capacité

Demande de O, 17/11. Tickets et PR relevés par `gh` le 17/11 au soir. Les efforts sont `Déduit` (taille des PR, routes déjà présentes côté API). Les chiffres de B et F pour #274 à #278 et #280 sont demandés et remplaceront les miens.

### Nouveaux lots

| Lot | Contenu | Effort (h-s) | Dépendances |
|---|---|---|---|
| 9 | **Fiche document** : verrou (#274), nouvelle version (#275), texte reconnu (#276). Les routes existent, il ne manque que l'écran. | ≈ 3,25 : F 2,5, Q 0,75 | #275 après #274 (respect du verrou). Specs : `specs-fiche-document-274-276.md`. |
| 10 | **Écrans manager et utilisateurs** : chef et équipe d'un agent (#277), tableau de bord du manager et détail d'un modèle de règle (#278) | ≈ 3 : F 2,5, Q 0,5 | #277 après #222 ; #278 après #203 (périmètre). |
| 11 | **Périmètre et arbre des unités** : #241, #261 et #263 (404 hors périmètre), #221, #266 (arbre par `parent_id`), puis #265 (suppression de la table inutilisée), #254 (personne désignée, question 13), #264 (taille stockée en nombre), #262 (journal des renommages, #250). #213 et #220 sont déjà au lot 1. | ≈ 8 : B 3,5 (#254 ≈ 1,5 ; #265 ≈ 0,5 avec migration ; rebasages), F 0,25, Q 4,25 (#241 et #221 font plus de 590 lignes) | Piles : #203 → #241 → #213 → #261 et #263 ; #203 → #266 → #265 ; #179 → #262. #254 après #263. Si la réponse 13 a) est A (lecteur désigné hors circuit), ajouter ≈ 2 h-s (B 1, F 1) pour l'écran de désignation. |
| 12 | **Pile du VPS** : #248 → #267 (en-têtes de sécurité) et #268 (contrôle de la configuration en CI), puis la mesure de 1 h (question 14) | ≈ 1,75 : B 0,25, Q 1,5 | À fusionner tôt : la rc.1 est hébergée d'abord sur le VPS (question 9). |
| 13 | **Droits en base** : #235 → #238 (synchronisation des règles d'accès entre le fichier et la base) | ≈ 1 : B 0,25, Q 0,75 | Avant le lot 8b, qui lit ces règles. |
| 14 | **Petites PR hors lots** : #237, #240, #243, #245, #249, #253, #279 (abandon de `GET /documents/tree`) | ≈ 2 : B 0,5, Q 1,5 | Sans dépendance, à glisser entre les PR longues. |

Le lot 8 (#280) est compté à ≈ 8,5 h-s : B 4, F 3, Q 1,5. #271 (vue doublons) est déjà couverte par #171 → #199 (lot 1). #269, #272 et #273 relèvent de la rc.1 et sont hors V1.1. #270 (charge à 100 000 documents) reste une mesure de décembre, hors fusions.

### Contrôle de capacité

| | B | F | Q | I | Total |
|---|---|---|---|---|---|
| Plan initial (lots 1 à 7) | 13 | 6,5 | 14,5 | 0,5 | 34 |
| Lot 8 (#280) | 4 | 3 | 1,5 | — | 8,5 |
| Lots 9 à 14 | 4,5 | 5,25 | 9,25 | — | 19 |
| **Total** | **21,5** | **14,75** | **25,25** | **0,5** | **≈ 62** |

- **Q reste le goulot.** Capacité de Q du 24/11 au 04/12 (`Déduit`) : ≈ 10 h-s du 24 au 30, en partage avec le tag, l'essai du 25 et la démo, puis ≈ 6 h-s par jour du 01 au 04/12. Sans entamer la marge de 20 % (les 03 et 04), cela fait ≈ 22 h-s ; en l'entamant, ≈ 34 h-s.
- **Fusions** : ≈ 55 PR au lieu de ≈ 30. Elles passent une par une (branche à jour, puis ≈ 11 min de CI), soit ≈ 12 h d'horloge sur la période.
- **Chemin critique** : #280 dépend de #154, #230 et du lot 3, qui arrivent tard dans la chaîne. Le code de #274 à #278 et #280 n'existe pas encore.

**Verdict** : **le 04/12 ne tient pas avec une marge.** Les 25 h-s de Q dépassent les ≈ 22 h-s disponibles hors marge. La date ne tient qu'en consommant toute la marge, et seulement si les chiffres de B et F confirment les miens. Une reprise lourde ou un retard du PO repousse la fin au 08 ou au 09/12.

### Ce qu'on sort de la V1.1, si l'on garde le 04/12

Classé de la plus faible à la plus forte valeur pour les agents. On sort dans cet ordre jusqu'à retrouver la marge, soit ≈ 4 h-s de Q.

| Ordre | À sortir (vers V1.2) | Valeur pour les agents | Gain (h-s) |
|---|---|---|---|
| 1 | **Sorti vers V1.2 (O, 17/11).** Versions majeures de Dependabot : #29 (TypeScript 7), #30 (ESLint 10), #110 (Python 3.15), #113 (Starlette 1.x). On garde #111, #112 et #141. | aucune, visible ou non | ≈ 3 (Q 1) |
| 2 | **Sorti vers V1.2 (O, 17/11).** #265 (suppression de table) et #279 et #281 (abandon d'une route) | aucune : nettoyage technique | ≈ 1,25 (Q 0,5) |
| 3 | **En attente du PO (O, 17/11) :** fonction visible. Alertes de qualité : #183 et #194 (≈ 4 350 lignes) | faible : elles servent la direction, pas l'agent | ≈ 3,5 (Q 2,5) |
| 4 | #278 (tableau de bord du manager, détail d'un modèle) | moyenne-faible : managers seulement | ≈ 2 (Q 0,5) |
| 5 | Lot 8b (écran des droits) | faible pour l'agent : administrateur seulement. Mais **le PO l'a choisi** (question 12, C) : à sortir seulement avec son accord. | ≈ 3 (Q 0,5) |

Les sorties 1 à 3 rendent ≈ 7,75 h-s, dont 4 h-s de Q : la marge revient sans toucher à une décision du PO. On ne sort pas la fiche document (lot 9), le périmètre (lot 11), le code par e-mail (lot 2) ni la corbeille et l'annulation (lot 1) : c'est ce que les agents utilisent chaque jour.

**Recommandation** : sortir 1 à 3 dès maintenant, garder le 04/12, et revoir après les chiffres de B et F. S'ils dépassent les miens de plus de 2 h-s, sortir aussi 4, puis demander au PO pour 5.

### Décisions de O et chiffres de F (17/11 au soir)

- **Sortis vers la V1.2** : les sorties 1 et 2 (Dependabot majeurs ; #265, #279 et #281). Gain ≈ 4,25 h-s, dont Q 1,5.
- **En attente du PO** : la sortie 3 (#183 et #194), car c'est une fonction visible.
- **Chiffres de F** (code et e2e, sans la relecture de Q) :
  - #274 : 2. Le ticket comprend l'ajout de 3 champs facultatifs à la fiche côté API, validé par O, le renouvellement et la libération du verrou à la fermeture, et un e2e à deux utilisateurs ;
  - #275 : 1 ; #276 : 0,5 ; #277 : 1 ; #278 : 1,5 ;
  - #280 : 8a 1,5 et 8b 1,5, provisoires jusqu'à sa lecture du ticket.
  F passe de 14,75 à 15,75 h-s. Ordre prévu par F : #249 → #276 → #275 → #274.
- **Chiffres de B** : `En attente` (API de #280, #254).

Recalcul provisoire : total ≈ 58,75 h-s (B 20,25, F 15,75, Q 23,75). Q dépasse encore de ≈ 1,75 h-s les ≈ 22 h-s disponibles hors marge. **Si le PO accepte la sortie 3, Q tombe à ≈ 21,25 h-s et le 04/12 tient avec sa marge.** Sinon, le 04/12 tient en entamant ≈ 1,75 h-s de marge sur 6,8. Le recalcul définitif se fait aux chiffres de B.
