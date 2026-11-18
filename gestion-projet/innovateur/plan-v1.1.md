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
| 7 | **Dependabot** | #112 (pytest 9), #141 (npm), #111 (python, 25 paquets), puis une à une : #113 (starlette 1.10), #29 (TypeScript 7), #30 (ESLint 10), #110 (Python 3.15) ; **ces quatre versions majeures sont sorties vers la V1.2, voir la sortie 1 (l. 78)** | ≈ 4 : B 2, F 1, Q 1 | Après le 30 (décision O du 17/11), et **après** les lots 1 à 6, pour ne pas faire rebaser 30 PR sur des fichiers de verrouillage changés. Les versions majeures passent une par une, CI complète à chaque fois. Pour #113 et #110, la compatibilité avec FastAPI et les roues de PyTorch est `À vérifier`. Sans roue disponible, #110 est fermée et reportée. |
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

Recalcul provisoire : total ≈ 58,75 h-s (B 18,75, F 15,75, Q 23,75, I 0,5 ; B corrigé le 17/11, voir § suivant). Q dépasse encore de ≈ 1,75 h-s les ≈ 22 h-s disponibles hors marge. **Si le PO accepte la sortie 3, Q tombe à ≈ 21,25 h-s et le 04/12 tient avec sa marge.** Sinon, le 04/12 tient en entamant ≈ 1,75 h-s de marge sur 6,8. Le recalcul définitif se fait aux chiffres de B.

### Chiffres de B et recalcul définitif (17/11 au soir)

**Correction** : le recalcul provisoire affichait B 20,25. C'était une erreur de report : après les sorties 1 et 2, B était à 18,75. Le total de 58,75 était juste.

Chiffres de B, en h-s, vérifiés sur `main` f8f1d75 :
- **Lot 8a** (réglages en base) : 3,5 au lieu de 3. Fonctions activées et serveur e-mail (0,5) branchés seulement après la fusion de #230 et #154. Le mot de passe du serveur e-mail reste sur le serveur.
- **Lot 8b** (grille rôles × actions) : 1,5 au lieu de 1. Il s'appuie sur la table `casbin_rule` et `/authz/policies`, après #228 (lot 3).
- **#274 à #278** : les routes existent. Seule exception, #274 : `DocumentRead` n'expose pas `locked_by_user_id`, `locked_at` ni `lock_expires_at`, et il faut aussi le nom de la personne (0,5). F compte déjà ces champs dans ses 2 h-s. **On ne les compte qu'une fois.** O désigne qui les fait.
- **#254**, si le PO répond A et A à la question 13 (choix par défaut) : 3 au lieu de 1,5.
  - 1,5 : l'étape de workflow assignée ouvre la lecture, et l'accès reste après la fin de l'étape.
  - 1,5 : lecteur désigné hors circuit, avec une nouvelle table et sa migration.
  - L'écran de désignation (F ≈ 1) et la relecture de la migration (Q ≈ 0,5) sont `Déduit`. F doit confirmer son chiffre.

| | B | F | Q | I | Total |
|---|---|---|---|---|---|
| Provisoire (après sorties 1 et 2, chiffres de F) | 18,75 | 15,75 | 23,75 | 0,5 | 58,75 |
| Lot 8, chiffres de B | + 1 | — | — | — | + 1 |
| #254 avec A et A | + 1,5 | + 1 | + 0,5 | — | + 3 |
| **Total** | **21,25** | **16,75** | **24,25** | **0,5** | **≈ 62,75** |

B et F tiennent sans peine du 24/11 au 04/12. **Q reste le goulot** : 24,25 h-s pour ≈ 22 h-s disponibles hors marge.

**Verdict** :
- **Si le PO accepte la sortie 3** (#183 et #194, Q − 2,5), Q tombe à ≈ 21,75 h-s. Le 04/12 tient, mais avec une marge très faible, ≈ 0,25 h-s.
- **Sinon**, le 04/12 ne tient qu'en entamant ≈ 2,25 h-s de la marge de Q.
- **Chemin critique inchangé** : le lot 8a attend #154 et #230, le lot 8b attend #228, et #278 attend #203.

**Recommandation** : présenter au PO les deux choix ensemble.
1. Accepter la sortie 3.
2. Pour la question 13 a), décaler le lecteur désigné hors circuit en V1.2 (gain ≈ 3 h-s, dont Q 0,5). On garde en V1.1 l'accès par l'étape de workflow, qui règle le cas « accès refusé » de la question 6.

Avec 1 et 2, Q tombe à ≈ 21,25 h-s, et le 04/12 retrouve une marge d'environ 0,75 h-s.

**Décision de O sur #274 (17/11 au soir)** : B ajoute les champs de verrou à `DocumentRead`, pour 0,5 h-s. F ne fait que l'écran, et son chiffre pour #274 passe de 2 à 1,5. Les totaux deviennent B 21,75 et F 16,25. Q et le total ne changent pas, le verdict non plus. O pose au PO les deux choix : la sortie 3, et la question 13 a) en V1.2.

**Mise à jour du 17/11, 22 h** (O) :
- B ajoute l'état OCR `failed` avec `ocr_error`, plus `low_confidence` (#276, ≈ 1 h-s).
- B expose aussi `deleted_at`, `deleted_by` et le nom de la personne pour la corbeille (#181, 0,25 h-s, ou 0,15 avec #274).
- B passe à **22,75 h-s**, chiffre fixé par O. Q ne change pas, le verdict non plus.
- O a validé l'ajout de `deleted_at`, `deleted_by` et du nom dans la PR de #274 (0,15 h-s). Ces 0,15 h-s ne figuraient pas dans les 22,75 : **B passe à ≈ 22,9 h-s**.

**« Mon équipe » (#277, décision de O du 17/11)** : le manager voit sa chaîne et ses N-1, comme le PO l'attend. Coût : 1,0 h-s, soit B 0,5, F 0,25 et Q 0,25, pile au seuil de O. **Pris en V1.1.** Nouveaux totaux : B ≈ 23,4, F ≈ 16,5, Q ≈ 24,5.

Si le PO reporte 13 a), le gain de ≈ 3 h-s (dont Q 0,5) couvre largement ce coût. Si le PO garde 13 a), Q passe de 24,25 à 24,5. Le verdict ne change pas : avec la sortie 3, le 04/12 tient de justesse (marge de Q nulle) ; sans elle, on entame ≈ 2,5 h-s de marge.

### Réponse du PO et charge finale (17/11, tard)

Le PO a répondu « 1 V1.2, 2 V1.2, 15 oui » (transmis par O) :
- **Sortie 3 en V1.2** : les alertes de qualité #183 et #194. Gain ≈ 3,5 h-s, soit Q 2,5 et B 1 (rebasages, `Déduit`).
- **13 a) en V1.2** : le lecteur désigné hors circuit (#254, nouvelle table et sa migration). Gain ≈ 3 h-s : B 1,5, F 1 (écran de désignation), Q 0,5. **Reste en V1.1** : l'accès par l'étape de circuit (#254, B 1,5), qui règle le cas « accès refusé » de la question 6.
- **15** : l'essai d'installation sans Internet du 25/11 vaut preuve pour l'item 28.
- Étiquette `v1.2` posée par O sur #183, #194, #254 (partie 13 a), #265, #279, #281 et les versions majeures de Dependabot.

| | B | F | Q | I | Total |
|---|---|---|---|---|---|
| Avant la réponse (avec « Mon équipe ») | 23,4 | 16,5 | 24,5 | 0,5 | ≈ 64,9 |
| Sortie 3 (#183, #194) | − 1 | — | − 2,5 | — | − 3,5 |
| 13 a) (lecteur hors circuit) | − 1,5 | − 1 | − 0,5 | — | − 3 |
| **Total V1.1** | **≈ 20,9** | **≈ 15,5** | **≈ 21,5** | **0,5** | **≈ 58,4** |

**Verdict** :
- Q : 21,5 h-s pour ≈ 22 h-s disponibles hors marge. Il reste ≈ 0,5 h-s avant d'entamer la marge de 6,8 h-s, qui reste entière. **Le 04/12 tient.**
- B et F gardent une marge large, de ≈ 4 à 5 h-s chacun sur la période.
- **Ce qui reste fragile** :
  - le chemin critique (8a attend #154 et #230 ; 8b attend #228 et le lot 13, puis le passage en `sql`) ;
  - la relecture par Q des grosses PR de la chaîne.
  Un dépassement de plus de 0,5 h-s chez Q entame la marge. On n'ajoute plus rien en V1.1 sans en sortir autant.
- **Prochaine sortie si besoin** : #278 (sortie 4, Q 0,5). Le lot 8b ne sort qu'avec l'accord du PO.

**Mise à jour du 17/11, fin de soirée (chiffres de B, décision de O)** :
- **8b passe de 1,5 à 2,0 h-s (B)** : l'audit des changements de droits, avec 2 libellés en français, et la lecture de `GET /authz/policies` par l'administrateur d'institution. L'écriture reste au super admin, avec des tests dans les deux sens. O l'accepte : c'est une exigence de sécurité.
- **Lot 13 (B)** : le rebasage de #235 et #238, plus le passage en `sql` (compose et doc), ne figuraient pas dans le total de B. **+0,5 h-s**. La synchronisation idempotente de #235 sert de migration.
- **B : + 1 h-s, soit ≈ 21,9.** Le 1 h-s de B sur la sortie 3 est `Déduit` et en cours de confirmation. S'il n'avait pas été compté, B est à ≈ 22,9, ce qui reste dans sa capacité.
- **Q : + 0,25 h-s (`Déduit`), soit ≈ 21,75.**
  - Passage en `sql` : Q rejoue la suite des droits (security-isolation, route-guard, authz) sur une pile en `sql` (+ 0,25).
  - Audit de 8b : B écrit les tests ; la relecture tient dans les 0,5 de Q déjà comptés pour 8b.
  - Q reste sous 22 : **#278 reste en V1.1**. Il ne reste que ≈ 0,25 h-s avant d'entamer la marge de 6,8.
- **Totaux** : B ≈ 21,9, F ≈ 15,5, Q ≈ 21,75, I 0,5, soit ≈ 59,65 h-s.
- **Règle adoptée par O** : aucun ajout en V1.1 sans une sortie équivalente. Au prochain dépassement de Q, #278 sort (Q 0,5).
- **Confirmé par B (17/11)** : le 1 h-s de la sortie 3 vient en entier de #183 (rebasage, corrections et CI). #194 relève de F. B reste à ≈ 21,9.

## Mise à jour du 17/11, 22:30 : mise en service sur le VPS (#288)

Décision de O, prise selon la règle « aucun ajout sans une sortie équivalente ». Détail dans `deploiement-vps.md` (§ 0 et § 7).

- **Ajout en V1.1 : la phase 1 de #288** (accès par VPN). Elle comprend l'installation, la tâche cron de sauvegarde et une restauration sur un poste. **B + 0,75, Q + 0,25.** Le lot 12 couvre déjà #248, #267, #268 et l'heure de mesure.
- **Sortie : la phase 2 de #288** (accès public en HTTPS) passe en V1.2 (B 0,5, Q 0,25). Elle revient en V1.1 seulement si #154 et #212 sont fusionnés avant le 01/12.
- **Sortie : le serveur e-mail à l'écran** (lot 8a) passe en V1.2 (B − 0,5). Le réglage reste dans le fichier d'environnement.
- **Q passe à ≈ 22,0** : il atteint 22 sans le dépasser. **#278 reste en V1.1**, mais la marge avant les 6,8 de réserve est nulle. Au prochain ajout pour Q, #278 sort (Q − 0,5).

| | B | F | Q | I | Total |
|---|---|---|---|---|---|
| Avant (§ précédent) | 21,9 | 15,5 | 21,75 | 0,5 | 59,65 |
| Phase 1 de #288 | + 0,75 | — | + 0,25 | — | + 1 |
| Serveur e-mail à l'écran, sorti en V1.2 | − 0,5 | — | — | — | − 0,5 |
| **Total V1.1** | **≈ 22,15** | **≈ 15,5** | **≈ 22** | **0,5** | **≈ 60,15** |

- Si #154 et #212 sont fusionnés avant le 01/12 et que la phase 2 revient en V1.1 : B ≈ 22,65, et Q ≈ 22,25. Dans ce cas, #278 sort, et Q revient à ≈ 21,75.

**Ajout du 17/11, 22:45 (décision de O)** : le lot 8b passe à 2,25 h-s, soit + 0,25 pour B. En mode `csv`, `GET /authz/policies` répond aujourd'hui 409 : B le fait lire `policy.csv` par l'enforcer, et ajoute un test qui vérifie que `csv` et `sql` donnent la même réponse. Sans cela, la grille en lecture seule de `specs-reglages-droits-280.md` ne pourrait pas s'afficher. B passe à ≈ 22,4 et reste dans sa capacité : O accepte l'ajout sans sortie. Q n'est pas touché. **Total V1.1 ≈ 60,4 h-s.**

## Mise à jour du 18/11 : découpage de #151 et nouvelles PR (décisions de O, nuit du 17 au 18)

### #151 (réflexes Windows dans l'explorateur) en trois parties

| Partie | Où | Qui | Effort (h-s) | Ordre |
|---|---|---|---|---|
| Suppr met le document à la corbeille, jamais de suppression définitive | V1.1, PR #301 (+43 lignes, déjà écrite) | F | F 0,25 (rebasage, re-ciblage sur `main`) | après #152 et #181 ; #301 est empilée sur #181 |
| F2 renomme le document | V1.1, PR #302 (brouillon) | F | F 0,5 (`Déduit` : saisie dans l'arbre, `PATCH` du titre, messages 403 et verrou) | après #262 (`document_updated` trace aussi le titre) |
| Glisser-déposer = reclassement par la boîte « Classer » | **V1.2** (#299, élément 18 de `plan-v1.2.md`) | F, Q | F 1, Q 0,5 | après #179 et #262 |
| #300 : audit du `PATCH` | **fermée par B (18/11)** : doublon de #179 (reclassement) et de #262 (`document_updated`, titre compris) | B | 0 | — |

Relecture de Q (`Déduit`) : Suppr et F2, 0,25 en une seule passe sur l’explorateur. **Q + 0,25.**

### Rattachement des nouvelles PR

- Lot 9 (fiche document) : #293 (#274, verrou à l'écran, empilée sur la PR des champs de verrou), #295 (#275, nouvelle version, empilée sur #293).
- Lot 10 (manager et utilisateurs) : #297 (#277, « Mon équipe »), #298 (#278, tableau de bord du manager) ; #298 est maintenant en V1.2, élément 19 (sortie du 18/11 ci-dessous).
- Lot 11 (périmètre) : #296 (message clair quand un lien de document est hors périmètre, suite de #263), dans les F 0,25 déjà comptés.
- Lot 8b (écran des droits) : #294 (grille en lecture, audit des changements de droits).
- Lot 13 (droits en base) : #235, puis #238, empilée sur #235.
- #151 : #301 (Suppr, F), puis #302 (F2, F), après #262. #300 est fermée (doublon de #179 et #262).

Ces PR sont déjà comptées dans leurs lots, sauf #301 et #302.

### Règle « pas d'ajout sans sortie »

- **Le glisser-déposer ne compense rien** : #151 n'a jamais été chiffré en V1.1 (le ticket dit « Non chiffré », et aucun lot ne le comptait). Le sortir libère 0 h-s dans les totaux. Les trois ajouts (#300, Suppr, F2) sont donc des ajouts nets : B + 0,5, F + 0,75, Q + 0,5.
- **Q passerait à ≈ 22,5**, au-dessus de 22. Il faut une sortie d'au moins 0,5 h-s de Q.
- **Sortie proposée : #278** (sortie 4, PR #298), comme le prévoit la règle de O : « au prochain ajout pour Q, #278 sort ». Q − 0,5. La PR est déjà écrite (+424 lignes), donc F ne gagne que ce qui reste à faire, ≈ 0,5 (`Déduit`). #278 irait en tête de la V1.2, avant l'élément 10 qui en dépend.
- **Autre choix** : garder #278 et prendre 0,5 h-s sur la réserve de Q (6,8). Sortir seulement F2 ne suffit pas (Q − 0,25).
- **Décision de O (18/11)** : #278 sort de la V1.1 et passe en tête de la V1.2, avant l'élément 10. La réserve de Q n'est pas touchée. Code écrit, PR #298 conservée en brouillon, à relire en début de V1.2. **V1.1 ≈ 61,15 h-s : B 22,9, F 15,75, Q 22,0, I 0,5.**

| | B | F | Q | I | Total |
|---|---|---|---|---|---|
| Avant (§ précédent) | 22,4 | 15,5 | 22,0 | 0,5 | 60,4 |
| #300 (audit du `PATCH`) | + 0,5 | — | + 0,25 | — | + 0,75 |
| Suppr (#301) et F2 | — | + 0,75 | + 0,25 | — | + 1 |
| Glisser-déposer, sorti en V1.2 (jamais compté) | — | — | — | — | 0 |
| **Total sans sortie** | **≈ 22,9** | **≈ 16,25** | **≈ 22,5** | **0,5** | **≈ 62,15** |
| Sortie proposée : #278 (PR #298) | — | − 0,5 | − 0,5 | — | − 1 |
| **Total avec la sortie de #278** | **≈ 22,9** | **≈ 15,75** | **≈ 22,0** | **0,5** | **≈ 61,15** |

B et F restent dans leur capacité. Avec la sortie de #278, Q revient à 22,0, sans marge avant la réserve.

**Ajout du 18/11 (décision de O) : #300 fermée.** B ferme #300 : c'est un doublon de #179 (trace du reclassement) et de #262 (`document_updated`, qui trace aussi le titre). F2 est en PR #302 (brouillon) et passe après #262 ; Suppr reste en PR #301. Le glisser-déposer (V1.2) dépend désormais de #179 et #262.

| | B | F | Q | I | Total |
|---|---|---|---|---|---|
| Avec la sortie de #278 (ci-dessus) | 22,9 | 15,75 | 22,0 | 0,5 | 61,15 |
| #300 retirée | − 0,5 | — | − 0,25 | — | − 0,75 |
| **Total V1.1** | **≈ 22,4** | **≈ 15,75** | **≈ 21,75** | **0,5** | **≈ 60,4** |

- Q a ≈ 0,25 h-s devant lui avant d'atteindre 22.
- **#278 reste en V1.2** : le faire revenir coûterait Q + 0,5, soit ≈ 22,25, au-dessus de 22.

**Transfert du 18/11 (décision de O) : 1,5 h-s passent de Q à F.** Q garde les verdicts ; F écrit et fait tourner les tests suivants :

| Tâche transférée | h-s |
|---|---|
| Spec e2e du 404 hors périmètre (#263) | 0,5 |
| E2e de l'audit (#262 et #179) | 0,4 |
| Jeu de documents OCR (#284) | 0,3 |
| Mesure à l'écran de l'import, sur la version compilée (réserve du scénario de démo, § 10) | 0,3 |
| **Total** | **1,5** |

| | B | F | Q | I | Total |
|---|---|---|---|---|---|
| Après le retrait de #300 | 22,4 | 15,75 | 21,75 | 0,5 | 60,4 |
| Transfert de Q vers F | — | + 1,5 | − 1,5 | — | 0 |
| **Total V1.1** | **≈ 22,4** | **≈ 17,25** | **≈ 20,25** | **0,5** | **≈ 60,4** |

Q retrouve ≈ 1,75 h-s de marge avant 22. F reste dans sa capacité.
- **Décision de O (18/11)** : #278 reste en V1.2. Les ≈ 1,75 h-s de marge de Q sont réservés aux relances d'e2e et au dépilage des PR empilées après le tag ; on n'y prend rien.

**Correctif du 18/11, lot #151 et audit (décision de O) : #309.** La frise de revue affichait « Autre action » pour les deux actions d'audit de #179 et #262. C'est la spec #310 qui a révélé le défaut. Comme ce n'est pas une fonction nouvelle, O l'accepte sans sortie.
- Coût : F 0,25 (déjà fait), Q 0,1, pris sur la marge de Q, qui passe à ≈ 1,65.
- Ordre de fusion : #179 → #262 → #309. #310 est empilée sur #262 ; elle est re-ciblée sur `main` avant la fusion de #262.

| | B | F | Q | I | Total |
|---|---|---|---|---|---|
| Après le transfert de Q vers F | 22,4 | 17,25 | 20,25 | 0,5 | 60,4 |
| #309 (correctif de la frise de revue) | — | + 0,25 | + 0,1 | — | + 0,35 |
| **Total V1.1** | **≈ 22,4** | **≈ 17,5** | **≈ 20,35** | **0,5** | **≈ 60,75** |

## Mise à jour du 18/11 : lot 4 « confort et tâches répétitives » (7 frictions, classées V1.1 par O)

Audit UX du 18/11 (`gestion-projet/walkthrough/`, lot 4). Le PO a demandé que le lot entier soit codé tout de suite, en dehors de la capacité de B, F et Q. Si le serveur doit changer, ce travail revient à B. Pour les points 3 et 4, `main` (dabeeb2) suffit : **aucun changement backend**.

| # | Friction | Fichier |
|---|---|---|
| 1 | Le dernier valideur choisi est oublié à chaque soumission : il faut le pré-sélectionner s'il est toujours dans la liste | `frontend/profiles/collaborator/pages/DraftWorkspace.tsx` |
| 2 | Les brouillons à soumettre et les rejets sont mélangés aux dossiers validés : il faut des puces « À soumettre », « Rejetés », « Tous », avec leur compteur, gardées dans l'URL | `frontend/profiles/collaborator/pages/DraftWorkspace.tsx` |
| 3 | Les prises de connaissance (`read_ack`) se traitent une par une, avec deux clics chacune : il faut un filtre par type d'action et un traitement groupé des seuls `read_ack` | `frontend/profiles/manager/pages/ValidationHub.tsx`, `frontend/components/WorkflowTasks.tsx` |
| 4 | Pour viser après lecture, il faut fermer la fiche et retrouver la carte : il faut des boutons Viser et Rejeter dans la fiche ouverte depuis le parapheur | `frontend/components/workflow/ViewDocumentButton.tsx`, `frontend/components/DocumentDetailModal.tsx` |
| 5 | Les étapes bloquées se débloquent une par une, et l'agent choisi est oublié à chaque fois : il faut passer seul à l'étape suivante, garder l'agent et pouvoir filtrer la liste des utilisateurs | `frontend/profiles/tenant-admin/pages/PendingAssignmentsInbox.tsx` |
| 6 | Le dossier de destination est vidé à chaque pièce à revoir : il faut garder le dernier dossier choisi | `frontend/profiles/tenant-admin/pages/NeedsReviewInbox.tsx` |
| 7 | La bibliothèque du lecteur n'a ni recherche ni filtre : il faut une recherche locale (titre, type, date) et un filtre par format | `frontend/profiles/reader/pages/LibraryView.tsx` |

### Points 3 et 4 : faits vérifiés sur `main`

Ces deux points touchent le circuit de visa. Les faits suivants sont `Vérifié` sur dabeeb2 :
- `GET /workflows/pending` ne renvoie que les étapes assignées à l'utilisateur et encore « current ».
- `POST /workflows/step/{id}/actions` verrouille l'étape (`with_for_update`). Il refuse :
  - une étape qui n'est plus « current » ;
  - un type d'action différent de `expected_action_type` ;
  - une version qui n'est plus la version courante du document.
- Chaque acte enregistre une ligne `WorkflowAction` : auteur, type, résultat, version et commentaire. Cette ligne est visible dans l'historique du document. Elle n'écrit rien dans `audit_logs`.
- `buildWorkflowDecision` (`workflows.api.ts`) envoie `acknowledged` pour un `read_ack` et prend la version dans `task.document`.

**Point 3, prise de connaissance groupée.**
- **Risque.**
  - Traçabilité : un accusé groupé ressemble exactement à un accusé individuel. Après coup, on ne peut pas savoir que quinze notes ont été « lues » en un clic sans avoir été ouvertes.
  - Visa par erreur : un visa ou une signature resté coché partirait avec le lot.
- **Recommandation.** Le faire, mais seulement pour les `read_ack`, puisqu'un accusé de lecture n'engage pas sur le fond. Deux conditions :
  - marquer chaque appel du lot avec le commentaire fixe « Prise de connaissance groupée » ;
  - ne jamais faire disparaître un échec sans le montrer.
- **Backend** : aucun changement. Si l'on veut un jour un vrai champ « canal » (individuel ou groupé), c'est à B, en V1.2.

**Point 4, Viser et Rejeter dans la fiche.**
- **Risque.** Viser sans avoir lu :
  - si le passage automatique au dossier suivant est retenu, un double clic vise un dossier que l'on n'a pas ouvert ;
  - si les boutons apparaissent aussi depuis la recherche ou l'explorateur, on contourne le parapheur.
- **Version envoyée.** Elle doit être celle de la pièce lue. Or `ViewDocumentButton` recharge le document, alors que la carte peut avoir une version périmée.
- **Recommandation.** Le faire : le visa depuis la fiche se donne **après** lecture, c'est plus sûr que depuis la carte. Conditions :
  - pas de passage automatique au suivant dans ce lot ;
  - boutons limités au parapheur ;
  - même confirmation que sur la carte ;
  - rejet seulement par `RejectReasonDialog`.
- **Backend** : aucun changement.

### Grille de relecture de la PR (points 3 et 4)

Garde-fous de O, avec ceux de l'innovateur marqués (I).

| # | Contrôle | Comment vérifier |
|---|---|---|
| G1 | Le traitement groupé ne propose que les `read_ack`, avec un filtre actif | Lecture du code et e2e : un `visa` ne peut pas être sélectionné |
| G2 | (I) Le lot envoyé est l'intersection de la sélection et de `expected_action_type === 'read_ack'`, calculée au moment de l'envoi | Test unitaire : sélection mixte, seuls les `read_ack` partent |
| G3 | Une confirmation indique le nombre de documents | e2e : texte « N documents » avant l'envoi |
| G4 | Un appel `POST /workflows/step/{id}/actions` par tâche, par la route existante, envoyé un par un, sans route nouvelle | Lecture du code ; e2e : N requêtes dans le réseau, donc N lignes `WorkflowAction` |
| G5 | (I) Chaque appel du lot porte le commentaire fixe « Prise de connaissance groupée » | Test unitaire du payload ; e2e : visible dans l'historique du document |
| G6 | (I) En cas d'échec partiel, le bilan « N faits, M refusés » s'affiche, les refusés restent dans la liste et la liste est rechargée | Test unitaire avec un refus 400 simulé |
| G7 | Dans la fiche, les boutons appellent les mêmes gestionnaires et passent par la même confirmation que sur la carte ; le rejet se fait seulement par `RejectReasonDialog` (motif obligatoire) | Lecture du code et e2e (viser, puis rejeter sans motif : refusé) |
| G8 | (I) Les boutons n'existent que si la fiche est ouverte depuis le parapheur avec une tâche (prop optionnelle) ; rien ne change dans la recherche ni dans l'explorateur | e2e : la fiche ouverte depuis la recherche n'a pas les boutons |
| G9 | (I) La version envoyée depuis la fiche est celle de la fiche affichée, pas celle de la carte | Test unitaire de `buildWorkflowDecision` avec le document de la fiche |
| G10 | (I) Pas de passage automatique au dossier suivant ; boutons désactivés pendant l'envoi | Lecture du code ; e2e avec double clic : une seule requête |
| G11 | Aucun fichier `backend/` modifié | `git diff --stat origin/main` |

**Coût** (`Déduit`) : la relecture par Q coûte ≈ 0,5 h-s, et les quick wins 1, 2, 5, 6 et 7 se relisent dans la même passe. **Décision de O (18/11)** : la PR est en V1.1, et Q la relit après le tag du 24, dans la fenêtre qui court jusqu'au 04/12. Rien n'est pris sur la marge de Q d'ici le 24.

## Mise à jour du 18/11 : tâche OCR tuée = tâche perdue (pas d'`acks_late`)

**Contexte.** Au rejeu de Q du 18/11, le repli EasyOCR a fait tuer le worker 363 fois (SIGKILL, limite `mem_limit: 2g`, `--concurrency=1`). Aucune photo n'a été indexée et rien ne l'a signalé à l'écran. #365 (B, V1.0) désactive ce repli par défaut et porte la leçon LESSON-2026-058. Le défaut de fond reste : une tâche tuée est perdue.

**Constat sur `main` (17498b5).**
- `backend/app/workers/celery_app.py` ne règle ni `task_acks_late` ni `task_reject_on_worker_lost`. Le message est donc acquitté dès sa réception, et un worker tué en cours de tâche le perd.
- `process_document_ocr` (`backend/app/workers/tasks.py`) n'a ni relance ni borne de tentatives.
- L'état `failed` de #284 (#276) est écrit dans un `except` Python. Un SIGKILL ne passe pas par là : le document reste « en cours » sans fin.

| Ticket | Contenu | Coût (`Déduit`) | Dépendance |
|---|---|---|---|
| OCR-1 (#370, brouillon de B) | **Tâche OCR tuée = tâche perdue.** (a) `task_acks_late=True` et `task_reject_on_worker_lost=True`, pour la seule tâche OCR ou pour toute l'application selon la relecture de B. (b) Borne de tentatives : au-delà de N essais, le document passe à `failed` avec une raison lisible, sinon un document trop lourd tue le worker en boucle. (c) `process_document_ocr` doit pouvoir être rejouée sans effet en double (même `document_id`, même résultat). (d) Balayage périodique, avec le beat déjà lancé par `-B` : un document « en cours » depuis plus de X minutes passe à `failed`. | ≈ 1,25 : B 0,75, Q 0,5 | Après #284 (état `failed`) et #365 |

**Preuve attendue (Q).** Un `kill -9` du worker pendant une lecture : après redémarrage, la tâche est relue une seule fois et le document finit `indexed` ou `failed`, jamais « en cours ». Un document qui fait tomber le worker à chaque essai finit `failed` après N essais. Un test unitaire vérifie la configuration Celery.

**Capacité.** C'est un ajout net (B + 0,75, Q + 0,5). Q est déjà à 22,0, donc la règle « pas d'ajout sans sortie » s'applique.

**Décision de O (18/11).** OCR-1 passe **en tête de la V1.2**, pas en V1.1. Avec #365, le repli lourd est coupé par défaut, et RapidOCR vise moins de 800 Mo : le risque de SIGKILL devient faible. Q est déjà saturé en V1.1. Les totaux de la V1.1 ne changent pas.

**Condition de remontée.** Si un SIGKILL du worker est observé pendant la recette (du 20 au 23/11) ou pendant l'essai hors ligne du 25/11, OCR-1 remonte en V1.1. O choisit alors ce qui en sort. Le constat se lit dans les journaux du worker (`signal 9` ou `SIGKILL`), et on note l'heure et le document.

**Contournement manuel en attendant** (fiche UAT, anomalies connues) : un document reste « en cours » plus de 10 min → noter le nom, relancer l'import. Le même fichier redéposé est refusé comme doublon (contrôle par empreinte), et aucun écran ne supprime un document en rc.1 : la relance se fait côté serveur, par Q.

## Mise à jour du 18/11, soir : les 25 PR hors lot entrent en V1.1 (décision du PO, § 8b)

Le PO décide « toutes en V1.1 » pour les 25 PR que `plan-fusion-v1.1.md` (§ 8, point 2) marquait sans lot. Leur code est déjà écrit. La charge restante comprend donc trois choses : la remise à jour de chaque branche par son auteur, la relecture de Q et le suivi de la CI.

**Barème** (`Déduit`, à confirmer par B, F et Q) :
- remise à jour par l'auteur : 0,1 h-s, ou 0,25 si la PR était CONFLICTING au relevé du 18/11 ;
- relecture de Q selon la taille du diff : 0,05 pour moins de 30 lignes, 0,1 jusqu'à 80, 0,15 jusqu'à 150, 0,25 jusqu'à 400, 0,5 au-delà.

Tailles relevées le 18/11 (`gh pr view --json additions,deletions`) ; toutes les PR sont en brouillon.

| PR | Rôle | Diff | Auteur | Q |
|---|---|---|---|---|
| #389 parité des réglages | Q | +463/−1 | — | 0,3 (CI, contrôle sur toutes les PR suivantes) |
| #383 plafond de l'export CSV | B | +43/−6 | 0,1 | 0,05 (OK sur c19e95b, à reconfirmer) |
| #372 `ocr_status` en lecture | B | +113/−11 | 0,1 | 0,15 |
| #384 moteur réellement utilisé | B | +83/−6 | 0,1 | 0,15 |
| #386 PDF mixte | B | +98/−18 | 0,1 | 0,15 |
| #387 pages rendues une à une | B | +56/−20 | 0,1 | 0,15 |
| #388 filtre par catégorie | B | +113/−0 | 0,1 | 0,15 |
| #355 lecture en échec à l'écran | F | +234/−4 | 0,25 | 0,25 |
| #338 aperçu intégré | F | +356/−2 | 0,1 | 0,25 |
| #347 cartes cliquables | F | +114/−35 | 0,1 | 0,15 |
| #351 filtre gardé dans l'URL | F | +113/−15 | 0,25 | 0,15 |
| #354 dernière catégorie retenue | F | +319/−40 | 0,25 | 0,25 |
| #371 liste vide expliquée | F | +41/−2 | 0,1 | 0,1 |
| #373 erreurs d'import lisibles | F | +111/−5 | 0,1 | 0,15 |
| #366 erreurs du simulateur | F | +83/−17 | 0,1 | 0,15 |
| #367 onglet des règles dans l'URL | F | +109/−3 | 0,1 | 0,15 |
| #377 simuler une règle inactive | B | +103/−6 | 0,1 | 0,15 |
| #349 motifs de rejet en un clic | F | +67/−4 | 0,25 | 0,1 |
| #359 reconnexion plus rapide | F | +468/−8 | 0,25 | 0,5 (touche la connexion) |
| #378 profils de démo derrière un réglage | F | +46/−2 | 0,25 | 0,15 (touche la connexion) |
| #342 échappement de la liste des agents | F | +2/−2 | 0,1 | 0,05 |
| #344 recherche dans le journal d'audit | B | +206/−2 | 0,1 | 0,25 |
| #353 test propriétaire / assigné | Q | +25/−2 | — | 0,1 |
| #335 générateur d'export de test | B | +23/−1 | 0,25 | 0,05 |
| #312 garde d'espace disque | doc | +88/−0 | — | 0,05 |
| **Total** | | | **B 0,9 (barème de B ; 1,05 au barème Déduit), F 2,3** | **Q ≈ 4,1** |

| | B | F | Q | I | Total |
|---|---|---|---|---|---|
| Avant (§ « #309 ») | 22,4 | 17,5 | 20,35 | 0,5 | 60,75 |
| 25 PR hors lot (décision du PO), barème de B corrigé | + 0,9 | + 2,3 | + 4,1 | — | + 7,3 |
| #335 conservée : renumérotation de la leçon 054 (B) | + 0,1 | — | — | — | + 0,1 |
| Relecture de Q pour #394, #399 et #404, non comptée jusqu'ici | — | — | + 0,5 | — | + 0,5 |
| Relecture de Q pour #362 (lot 4 UX, après le tag) | — | — | + 0,5 | — | + 0,5 |
| **Total V1.1** | **≈ 23,4** | **≈ 19,8** | **≈ 25,45** | **0,5** | **≈ 69,15** |

Correction du 18/11, soir, après le retour de B transmis par O : le barème de B passe de 1,05 à 0,9 h-s, #335 reste, et deux relectures de Q sont ajoutées.

**Verdict** :
- **B et F tiennent, F de justesse.** Ils avaient ≈ 4 à 5 h-s de marge chacun quand F était à 15,5. Il reste ≈ 2 h-s à B et ≈ 0,5 à F (`Déduit`).
- **Q dépasse les ≈ 22 h-s hors réserve.** O réserve les ≈ 1,65 h-s restants aux relances d'e2e et au dépilage des piles. Les 5,1 h-s ajoutés viennent donc **entièrement de la réserve de 6,8 (03 et 04/12)**, et il en reste **≈ 1,7**.
- **Le 04/12 tient, mais sans filet** : une seule reprise lourde (migration, Dependabot, pile à re-cibler) consomme le reste de la réserve.

**PR qui risquent de ne pas passer avant le 04/12.** Elles sont au bout d'une chaîne sur un fichier chaud, ou demandent une relecture lourde, et tombent donc les 03 et 04/12 :

| PR | Pourquoi | Si ça glisse |
|---|---|---|
| #362 lot 4 UX (+1 285/−68, 23 fichiers) | Après #390. Touche `DocumentDetailModal.tsx` et `services/index.ts`, partagés avec #290, #293, #295 et #338. C'est la plus grosse relecture de la fenêtre. | Décision du PO (lot demandé par lui). Pas de sortie sans son accord. |
| #359 reconnexion plus rapide | Touche la connexion (2FA, jetons) : relecture de sécurité, 476 lignes, CONFLICTING | 1re candidate à la V1.2 |
| #338 aperçu intégré | Après #290 dans la chaîne de la fiche (#290 → #293 → #295) | 2e candidate |
| #371 liste vide expliquée | Bout de la chaîne `Documents.tsx` : #388 → #351 → #354 → #371, plus #355 et #296 sur le même fichier | Petite, elle peut passer le 04 au matin. Sinon 3e candidate. |


**#335 reste en V1.1 (B, 18/11).** `main` n'a pas `ALLOW_TEXT_FALLBACK`, et sans ce réglage le générateur produit de faux PDF de 140 octets. B renumérote la leçon 054 (≈ 0,1 h-s, compté ci-dessus).

**Ordre de sortie vers la V1.2 (retiré par le PO le 18/11 : « on repousse rien », voir la fin du document)**, si la réserve de Q passe sous 1 h-s avant le 03/12 : #359, puis #338, puis #371. Les 21 autres sont petites, ou sont la base d'une autre PR : #389, #372, #384 et #388 ouvrent les vagues 0 et 2.

**Règle « pas d'ajout sans sortie »** : ici, c'est le PO qui la lève, pour ce lot seulement. Elle reste en vigueur pour tout ajout suivant. #278 reste en V1.2 (décision de O) : le faire revenir prendrait Q 0,5 sur la réserve.

## Mise à jour du 18/11, nuit : audit UX Lot 6, #407, #400 et #401 (demande de O)

**Entrées** (O, 18/11) :
- **Audit UX Lot 6** (connexion instable et premier jour), travail de F :
  - **(a) V1.0** si la relecture de Q est faite le 19/11 à 14:00 et si le go/no-go de 15:30 l'accepte : une coupure réseau pendant le renouvellement de session ne déconnecte plus ; un 401 au renouvellement mène à `/login` avec le message « Votre session a expiré… ». Sinon, (a) passe en V1.1.
  - **(b) V1.1** : « Validation… » sur Valider et Rejeter (XS) ; une seule erreur hors ligne au dépôt (XS) ; orientation du premier jour et aide sur le code à la connexion (S) ; saisie gardée à travers la reconnexion (M).
  - **(c) V1.2** : barre d'actions fixe en bas de la fenêtre de dépôt, à 1366×768 et zoom 125 %.
- **#407** (F, brouillon, OK de Q en 98d2317) : « Archiver » depuis l'aperçu de l'explorateur. C'est la ligne 57 bis du plan de fusion.
- **#400** (accessibilité de l'explorateur, +19/−6) et **#401** (sélection multiple et actions groupées, #150, +472/−16, 8 fichiers) : contrainte d'ordre donnée par O. Ces deux PR n'étaient comptées dans aucun lot.

**Barème** (`Déduit`, à confirmer par F et B) : XS = F 0,1 et Q 0,05 ; S = F 0,5 et Q 0,25 ; M = F 1,0 et Q 0,5 (la saisie gardée touche la session, donc relecture de sécurité). Pour les PR déjà écrites, l'auteur ne compte que le re-ciblage et le rebasage.

| | B | F | Q | I | Total |
|---|---|---|---|---|---|
| Avant (§ « 25 PR hors lot ») | 23,4 | 19,8 | 25,45 | 0,5 | 69,15 |
| #407, ligne 57 bis (déjà écrite : rebasage, variante e2e de l'étape 8) ; relecture de Q dans le temps de la vague 5 (O) | — | + 0,25 | — | — | + 0,25 |
| Lot 6 (b) : 2 XS, 1 S, 1 M | — | + 1,7 | + 0,85 | — | + 2,55 |
| #400 et #401 (re-ciblage, relecture) | + 0,15 | — | + 0,45 | — | + 0,6 |
| **Total V1.1, si (a) entre en V1.0** | **≈ 23,55** | **≈ 21,75** | **≈ 26,75** | **0,5** | **≈ 72,55** |
| Si (a) glisse en V1.1 (F 0,5, Q 0,25) | 23,55 | 22,25 | 27,0 | 0,5 | 73,3 |

**Verdict** :
- **F dépasse sa capacité.** Elle était à ≈ 0,5 h-s de marge à 19,8, donc vers 20,3. À 21,75, F dépasse de ≈ 1,45 (≈ 1,95 si (a) glisse).
- **La réserve de Q passe sous 1 h-s** : il restait ≈ 1,7, il reste ≈ 0,4 (≈ 0,15 si (a) glisse). L'ordre de sortie prévu se déclenche donc, en commençant par #359.
- La règle « pas d'ajout sans sortie » s'applique : le PO ne l'a levée que pour les 25 PR hors lot.

**Recommandation** :
1. **Sortir ensemble #359 (reconnexion plus rapide) et la saisie gardée (M) vers la V1.2.** Les deux touchent la connexion et la session : une seule conception, une seule relecture de sécurité. #359 était déjà la première candidate. Gain : F 1,25, Q 1,0.
2. **Mettre l'orientation du premier jour (S) en V1.2**, sauf si F donne un chiffre plus bas. Gain : F 0,5, Q 0,25.
3. On garde en V1.1 : les deux XS, #407, #400 et #401.

| Avec 1 et 2, (a) en V1.0 | B | F | Q | I | Total |
|---|---|---|---|---|---|
| **Total V1.1** | **≈ 23,55** | **≈ 20,0** | **≈ 25,5** | **0,5** | **≈ 69,55** |

F revient sous 20,3, et la réserve de Q remonte à ≈ 1,65. Si (a) glisse en V1.1, F passe à ≈ 20,5 : il faut alors sortir aussi #338 (deuxième candidate). **À trancher par O**, et par le PO pour le lot 6 qu'il a demandé.

**Décision de O (18/11, nuit)** :
- Le point M (saisie gardée à travers la reconnexion) et le point S (orientation du premier jour) du lot 6 passent en **V1.2**.
- **#359 reste en V1.1** : c'est une décision du PO, et les chiffres tiennent sans la sortir.

| | B | F | Q | I | Total |
|---|---|---|---|---|---|
| Total V1.1 si (a) entre en V1.0 (tableau ci-dessus) | 23,55 | 21,75 | 26,75 | 0,5 | 72,55 |
| Lot 6 M et S vers la V1.2 | — | − 1,5 | − 0,75 | — | − 2,25 |
| **Total V1.1** | **≈ 23,55** | **≈ 20,25** | **≈ 26,0** | **0,5** | **≈ 70,3** |

- **F** : 20,25 pour une capacité d'environ 20,3. Il ne reste presque plus de marge.
- **Q** : la réserve remonte à ≈ 1,15.
- **Si (a) glisse en V1.1** (F + 0,5, Q + 0,25), F passe à ≈ 20,75. O porte alors au PO la sortie de #359 (F 0,25, Q 0,5).

**#391, #392 et #396** (OK de Q pour #392 en fc71aad et pour #396 en 93feb87) :
- ces trois PR ne sont comptées dans aucun lot ; le temps de relecture que Q y a déjà passé est à confirmer par Q ;
- les points mineurs relevés par Q sont confiés à B en fin de V1.1, **seulement s'il reste de la capacité**, et ne sont pas comptés : pour #392, remettre à zéro `titleEditedByHand` et ajouter un e2e du flux en série ; pour #396, un test des nouveaux boutons.

## Mise à jour du 18/11, fin de soirée : relectures de Q, #413, #414 et #152 (demande de O)

**Entrées** :
- Q a passé ≈ 0,45 h-s sur les relectures de #391, #392, #393, #395, #396, #398, #400 et #401 (premier passage et re-relectures jusqu'à #391 en 9a943d3). Ce temps est pris sur sa réserve V1.1.
- Le + 0,45 de Q compté plus haut pour #400 et #401 (« re-ciblage, relecture ») portait sur **la même relecture**, déjà faite. Pour ne pas la compter deux fois, le relevé de Q remplace cette ligne. Il reste à venir la re-relecture après le re-ciblage de #401 et la résolution du conflit #400/#401 : 2 × XS, Q 0,1.
- Deux XS sécurité pour B, issues ouvertes par Q : #413 (le garde de production de `SECRET_KEY` laisse passer la clé par défaut du compose) et #414 (`/auth/refresh` ignore la blacklist et l'état du compte). Barème XS : B 0,1 et Q 0,05 chacune.
- #152, décision du PO (DEC-2026-006) : retrait de la purge du tenant_admin, tests 403, vérification du ciblage du tenant par le super_admin, ajustement de #168. B 0,3 (`Déduit`, hors choix de conception : si B s'arrête sur un choix, O rechiffre). Relecture du delta par Q : 0,1.

| | B | F | Q | I | Total |
|---|---|---|---|---|---|
| Total V1.1 (décision de O, 18/11, nuit) | 23,55 | 20,25 | 26,0 | 0,5 | 70,3 |
| Relectures déjà faites des 8 PR (Q) − ligne #400/#401 comptée plus haut | — | — | ± 0 | — | ± 0 |
| Re-relecture de #401 après re-ciblage, conflit #400/#401 | — | — | + 0,1 | — | + 0,1 |
| #413 et #414 (XS) | + 0,2 | — | + 0,1 | — | + 0,3 |
| Delta de #152 (DEC-2026-006), dont #168 | + 0,3 | — | + 0,1 | — | + 0,4 |
| **Total V1.1** | **≈ 24,05** | **≈ 20,25** | **≈ 26,3** | **0,5** | **≈ 71,1** |

**Verdict** :
- **La réserve de Q passe sous 1 h-s** : ≈ 1,15 − 0,3 = **≈ 0,85**. Elle tombe à ≈ 0,60 si (a) glisse en V1.1. C’était le seuil prévu pour porter au PO la sortie de #359 ; **le PO l’a refusée (18/11 : « on repousse rien ») et a retiré la règle** (Q − 0,5, F − 0,25). Avec cette sortie, la réserve remonte à ≈ 1,35 (≈ 1,10 si (a) glisse), et F revient à ≈ 20,0.
- Sans le delta de #152, compté parce que la décision du PO date de ce soir, la réserve serait de ≈ 0,95 : elle passerait sous 1 de toute façon.
- **B à ≈ 24,05** (+ 0,5) : aucune capacité de B n'est chiffrée dans ce plan, seulement « dans sa capacité » à 22,9. **À confirmer par O avec B.** Si B est juste, les points mineurs de Q sur #392 et #396 (non comptés) sortent les premiers.
  - **Confirmé (B, par O, 18/11)** : capacité ≈ 31 h-s (9 jours ouvrés × 3,5), charge déclarée par B 24,55, marge ≈ 6 h-s. Les points mineurs de #392 et #396 tiennent dans la marge.
  - ~~#404 et #355 sortent en V1.2~~ : **annulé par le PO (18/11)**, #370, #404 et #355 sont en V1.1. Le gain ci-après n’est donc pas pris (gain `Déduit` des lignes déjà comptées : F − 0,25 et Q − 0,25 pour #355, plus Q ≈ − 0,15 pour la relecture de #404 (un tiers de la ligne #394, #399, #404). La réserve de Q passe de ≈ 0,85 à ≈ 1,25 : caduc).
- F inchangée à 20,25 : l'écran Corbeille du super_admin va en V1.2, et l'audit UX Lot 7 aussi (`plan-fusion-v1.1.md` § 7).

**Audit UX Lot 7, points (1) et (2) : CDC et démo du 30/11** (demande de O, 18/11)
- **CDC** : aucun des deux points n'est un item. Le journal est l'item 11, déjà « fait » (`[Innovateur] Recalcul du taux CDC - 2026-11-10.md`) ; ni l'historique par document ni le PDF officiel n'y figurent.
- **Point (1)**, historique d'un document et plafond de 200 lignes : l'étape 6 de la démo montre l'historique par l'onglet « Historique des Versions », pas par le journal. Dans `/audit`, l'écran charge les 200 lignes les plus récentes (`AuditLogs.tsx:81`, tri par date décroissante côté API) et filtre « Effectuée par » sur ces 200 lignes. Les lignes de la séance sont les plus récentes : elles sont dans la fenêtre, sauf si plus de 200 lignes s'écrivent avant l'étape 6. La répétition du 17/11 est passée, et le scénario prévoit déjà le repli (l. 76 : retirer le filtre, trier par date).
- **Point (2)**, export sur une période et PDF : le contrôle 11 n'attend qu'un CSV qui s'ouvre dans le tableur. L'export est fait côté serveur, par lots, sur tout le journal filtré : il n'est pas plafonné à 200.
- **Verdict** : rien d'obligatoire en V1.1. Filet optionnel, si le PO le veut : passer `limit: 200` à `limit: 500` dans `AuditLogs.tsx` (maximum déjà permis par l'API) = **XS : F 0,1, Q 0,05**. La réserve de Q passerait alors de ≈ 0,85 à ≈ 0,80. Le filtre par identifiant de document (S : F 0,5, Q 0,25) reste en V1.2 avec le reste du Lot 7.

## Mise à jour du 18/11 : on repousse rien (décision du PO, transmise par O)

**Décision** : « on repousse rien ». La règle « réserve de Q < 1 h-s → sortie en V1.2 » est retirée. #359, #155 et #169 restent en V1.1. #370 entre en V1.1, et #404 et #355 reviennent. La suite de #211 revient en V1.1 (après #184, sur #401). La pagination du journal d'audit entre en V1.1 (GO du PO). Ordre et dépendances : `file-v1.1.md` ; lignes de fusion : `plan-fusion-v1.1.md`, § 2.

**Ce qui était déjà compté** (aucun changement de charge) :
- #359, #404 et #355 : leur sortie n'a jamais été appliquée au tableau du § précédent ;
- #155 et #169 : dans le lot 1 depuis le 17/11 ;
- réglages à l'écran (lot 8a, question 12) : dans le lot 8, sauf le serveur e-mail à l'écran, sorti par O le 17/11 (voir plus bas) ;
- accès par l'étape de circuit (#254, partie 13 b, question 13) : B 1,5, dans le lot 11. La partie 13 a (lecteur désigné hors circuit) est en V1.2 par réponse du PO du 17/11 (« 2 V1.2 »).

| | B | F | Q | I | Total |
|---|---|---|---|---|---|
| Total V1.1 du § précédent (B relevé par B : 24,55) | 24,55 | 20,25 | 26,3 | 0,5 | 71,6 |
| #370 (brouillon, +678 lignes, 12 fichiers : rebase, OCR) | + 0,5 | — | + 0,5 | — | + 1 |
| Suite de #211 (corbeille groupée avec annulation, Ctrl+Espace) | — | + 0,75 | + 0,25 | — | + 1 |
| Pagination du journal (total côté API, contrôles de page dans `AuditLogs`) | + 0,25 | + 0,5 | + 0,25 | — | + 1 |
| **Total V1.1 sans aucune sortie** | **≈ 25,3** | **≈ 21,5** | **≈ 27,3** | **0,5** | **≈ 74,6** |
| Relecture croisée : B relit les PR front sans surface de sécurité (ci-dessous) | + 1,5 | — | − 1,5 | — | 0 |
| **Total V1.1 après relecture croisée** | **≈ 26,8** | **≈ 21,5** | **≈ 25,8** | **0,5** | **≈ 74,6** |

Chiffres `Déduit`, à confirmer par B, F et Q.

- **B** : ≈ 26,8 pour ≈ 31 de capacité : marge ≈ 4,2.
- **F** : ≈ 21,5 (+ 1,25). La capacité de F n'est pas chiffrée : **à demander à F par O**. Si F manque de temps, B prend la partie serveur de la pagination (déjà à lui) et rien d'autre ne bouge.
- **Q** : ≈ 27,3 sans relecture croisée, soit ≈ 0,15 au-delà du budget qui laissait 0,85 de réserve (≈ 27,15). Avec la relecture croisée de B, Q revient à ≈ 25,8 : réserve ≈ 1,35. Le plafond de ≈ 34 h-s, marge de 20 % comprise, n'est approché dans aucun cas.

**Relecture croisée (proposition, à valider par O, B et Q)** :
- **B relit** (≈ 1,5 h-s) les PR front de la vague 5 sans surface de sécurité : #396, #392, #354, #351, #371, #416, #417, #393, #400, #367, #366, et la suite de #211. Q garde l'OK de fusion final sur la CI.
- **Q garde** tout ce qui touche la sécurité, l'auth, les migrations, les droits ou l'OCR : #389, #403, #413, #414, #394, #405, #222, #227, #235, #238, #370, #404, #284, #372, les PR du périmètre (vague 3), #152, #181, #154, #193, #219, #254, #359, #155, #294, #303, le lot 8a et la pagination (export et filtre).
- **F** ne relit pas : sa marge est la plus faible.

**Planning de relecture et de fusion (jours ouvrés du 24/11 au 04/12)**

| Jour | Fusions | Q relit | B relit (croisée) | B code | F code |
|---|---|---|---|---|---|
| Mar 24/11 | Vague 0 (#389, #403, #383), début de la vague 1 | #413, #414, #394, #405, #227, #222, #237 | — | #413, #414 ; total de la pagination | pagination (écran) |
| Mer 25/11 | Fin de la vague 1, pagination si prête (sinon vague 5) | essai hors ligne (≈ 2,5 h-s), puis #235, #238, #248, #267, #268 | #224, #234, #240, #245 | rebase de #370 ; lot 8a | pagination ; rebase de #355 après #404 |
| Jeu 26/11 | Vague 2 (#372, #370, #284, #311, #384 à #388, #404, #355, #290, #338), vague 3 | #370 (matin), #404, #284, #372 ; vague 3 (#241, #213, #261, #266, #361, #263) | #355, #290, #338, #388, #296 | #254 (13 b) ; lot 8a | #355 |
| Ven 27/11 | Fin de la vague 3 | vague 4 : delta de #152, #181, #184, #153, #154 | — | #254 (13 b) ; lot 8a | suite de #211 (branche sur #401) |
| Lun 30/11 | Démo ; vague 4 commence | #254, #359, #193, #219 (charge allégée : démo) | — | lot 8a (fin) | suite de #211 |
| Mar 01/12 | Vague 4, début de la vague 5 | #155, #169, #192, #197, #180, #209 | #396, #392, #354, #351, #371 | corrections de relecture | lot 8a (écran) |
| Mer 02/12 | Fin de la vague 4, vague 5 | lot 8a, #294, #303, #362, #407, #401 | #416, #417, #393, #400, #367, #366 | corrections de relecture | lot 8a (écran) ; corrections |
| Jeu 03/12 | Fin de la vague 5 (lot 8a, pagination si elle n'est pas entrée en vague 1, suite de #211 après #401), début de la vague 6 | re-relectures sur têtes changées | suite de #211 | — | corrections |
| Ven 04/12 | Vague 6 (#111, #112, #141, #335, #312, #189, #166) | Dependabot une à une, CI complète | — | — | — |

- Le 30/11 est un jour de démo : Q n'y prend que des relectures courtes.
- Les relectures du lot 8a et de la suite de #211 arrivent tard : ce sont les deux points à suivre chaque soir. Si l'une glisse au 03/12, elle se fusionne le 03 au soir, avant la vague 6.

**Sorties antérieures, décidées par O avant « on repousse rien »** : **toutes revenues en V1.1** (O, 18/11 au soir ; aucune n'a de blocage technique réel, voir `plan-fusion-v1.1.md` § 7). Coût d'après ce document :
- versions majeures de Dependabot (#29, #30, #110, #113) : ≈ 3 h-s, dont Q 1 ;
- #265, #279, #281 (nettoyage) : ≈ 1,25 h-s, dont Q 0,5 ;
- #278 (PR #298, tableau de bord du manager) : F 0,5, Q 0,5 ;
- phase 2 de #288 (accès public en HTTPS) : B 0,5, Q 0,25 ;
- serveur e-mail à l'écran (lot 8a) : B 0,5 ;
- OCR-1 : B 0,75, Q 0,5 ;
- audit UX Lot 6, points M et S : F 1,5, Q 0,75 ;
- glisser-déposer (#299) : F 1, Q 0,5.
Toutes ensemble : B + 1,75, F + 3, Q + 4, soit Q ≈ 29,8 après relecture croisée, encore sous le plafond de ≈ 34. Les sorties décidées par le PO lui-même (#183 et #194 ; partie 13 a de #254) restent en V1.2.

**Correction du recompte (18/11 au soir)** :
- **OCR-1, c'est #370**, déjà comptée dans le recalcul « on repousse rien » (B + 0,5, Q + 0,5) : ses 0,75 et 0,5 ne s'ajoutent pas une seconde fois.
- **Dependabot majeurs** : les ≈ 3 h-s se répartissent B 1 (#113 Starlette, #110 Python), F 1 (#29 TypeScript, #30 ESLint), Q 1. **Nettoyage** (#265, #281) : B 0,75, Q 0,5. Le total « B + 1,75, F + 3 » ci-dessus oubliait ces parts.
- Sorties réintégrées, chiffres justes : **B + 2,75, F + 4, Q + 3,5**.

**Ajouts du 18/11 au soir (audits UX Lots 8 et 9, O)** :
- Lot 8, points 1 à 5 (avec le point 5 du Lot 6) : F ≈ 1,75 (3 XS dans une PR ≈ 0,75 ; 2 S ≈ 1) ; relecture croisée de B ≈ 0,5.
- Lot 9, point 5 (export CSV à plusieurs acteurs) : B ≈ 0,25, F ≈ 0,25, Q ≈ 0,25.

| | B | F | Q |
|---|---|---|---|
| Après relecture croisée (plus haut) | 26,8 | 21,5 | 25,8 |
| Sorties réintégrées | + 2,75 | + 4 | + 3,5 |
| Lots 8 et 9 | + 0,75 | + 2 | + 0,25 |
| **Total** | **≈ 30,3** | **≈ 27,5** | **≈ 29,55** |
| Capacité | ≈ 31 | ≈ 24 (F, 18/11) | ≈ 34 (plafond avec la marge de 20 %) |
| Écart | + 0,7 | **− 3,5** | + 4,45 |

**F dépasse de ≈ 3,5 h-s.** Rien ne sort (PO). Proposition de répartition, à trancher par O avec F, B et Q :
1. Q prend #29 et #30 (TypeScript 7, ESLint 10 : corrections de types et de lint, CI complète entre chaque) : F − 1, Q + 1.
2. B fait aussi la partie écran du Lot 9 point 5 (une ligne dans `AuditLogs.tsx`, même PR que la liste de `user_id`) : F − 0,25, B + 0,25.
3. Q prend le Lot 8 points 4 et 5 (classes de contraste, barre fixe de la fenêtre de dépôt : pas de logique, e2e de F inchangés) : F − 1, Q + 1.
Après 1 à 3 : **B ≈ 30,55** (marge 0,45), **F ≈ 25,25** (− 1,25), **Q ≈ 31,55** (marge 2,45). Le reste de F (≈ 1,25) demande un choix d'O : une journée de F à ≈ 3 h-s au lieu de 2,7 (+ 2,7 sur 9 jours), ou une autre ligne de F confiée à B ou Q. Le goulot de F reste Docker (2 places, e2e une par une) : regrouper les 3 XS du Lot 8 en une PR économise deux passages e2e.

## Lots 7, 10 et 11 : charge et dépassements (O, 18/11)

- **Décisions d'O** : la répartition 1 à 3 ci-dessus est validée. Le reste de F (− 1,25) attend sa capacité réelle ; s'il manque encore, 1,25 h-s de F passe à Q (candidats isolés : 57 L7-4 `ValidationHub.tsx`, déjà touché par Q pour le Lot 8 point 4 ; #298 accueil du manager). Le Lot 7 revient en V1.1 (même logique que « on repousse rien »). Les Lots 10 et 11 entrent en V1.1, hors points V1.0 faits par F avant le 19/11 à 17:15.
- **Lignes** : `plan-fusion-v1.1.md`, 57 L7-1 à 57 L11-3 ; deux migrations ajoutées en fin de chaîne alembic (ordres 8 et 9).
- **Estimations (h-s)** : colonne B = chiffrage de B (18/11, tests en conteneur compris : Lots 10 et 11 = 11,5, Lot 7 = 8,5 ou 10,5) ; colonnes F et Q = innovateur, à confirmer par F et Q.

| Ligne | Contenu | B | F | Q |
|---|---|---|---|---|
| 57 L7-1 | historique dans la fiche | — | 0,5 | 0,25 |
| 57 L7-2 | journal « Du / Au » (déjà côté serveur) et PDF officiel : impression du navigateur (B 0) ou PDF produit par le serveur (B 2,5, à trancher par le PO) | 0 | 0,5 | 0,5 |
| 57 L7-3 | recherche par date et par auteur | 1 | 0,75 | 0,5 |
| 57 L7-4 | « J+ », erreur réseau, visa allégé | — | 0,75 | — |
| 57 L7-5 | délégation (L, migration ; choix du PO avant de coder) | 7 | 1,5 | 1,5 |
| Lot 7 | relecture croisée par B | 0,5 | — | — |
| **Lot 7** | (+ 2 pour B si PDF produit par le serveur) | **8,5** | **4** | **2,75** |
| 57 L10-1 | `/documents?q=` dans le texte OCR (index existant, pas de migration) | 1 | — | 0,25 |
| 57 L10-2 | statut OCR écrit par le worker, avec un état « échec » qui manque aujourd’hui ; pastille | 2 | 0,5 | — |
| 57 L10-3 | recherche sans accents (migration, vecteurs recalculés par lots) | 3 | — | 0,5 |
| 57 L10-4 | OCR page par page (mesure sur un PDF de 100 pages) | 3 | — | 0,25 |
| 57 L11-1 | texte des `.docx` et `.xlsx` (image reconstruite) | 2,5 | — | 0,25 |
| 57 L11-2 | XLSX chargé à la demande | — | 0,5 | — |
| 57 L11-3 | progression de l'aperçu PDF | — | 0,5 | — |
| Lots 10 et 11 | relecture croisée par B ; e2e recherche et dépôt par Q | 0,25 | — | 0,25 |
| **Lots 10 et 11** | (saisie gardée à l’expiration = 57 octies, déjà comptée) | **11,75** | **1,5** | **1,5** |

| | B | F | Q |
|---|---|---|---|
| Après la répartition 1 à 3 | 30,55 | 25,25 | 31,55 |
| Lot 7 | + 8,5 | + 4 | + 2,75 |
| Lots 10 et 11 | + 11,75 | + 1,5 | + 1,5 |
| **Total** | **50,8** | **30,75** | **35,8** |
| Capacité | 31 | 24 | 34 |
| **Dépassement** | **+ 19,8** | **+ 6,75** | **+ 1,8** |
| Dépassement sans la délégation (57 L7-5) | + 12,8 | + 5,25 | + 0,3 |

- **En clair, pour le PO** : tout remettre en V1.1 demande ≈ 28 h-s de plus que ce que l'équipe peut faire d'ici au 04/12 : près de six jours de travail de B, deux jours et demi de F, et une demi-journée de Q. Le transfert de 1,25 h-s de F vers Q ne règle plus rien : Q dépasse aussi.
- **La délégation (57 L7-5) pèse 10 h-s à elle seule** (B 7 : table, migration, droits, circuit de validation, expiration, tests d’isolation) et ne peut pas démarrer sans trois choix du PO : qui désigne l'intérimaire, quels droits il reçoit, ce que le journal trace.
- **Rien ne sort sans décision du PO.** Ce que le PO peut trancher : allonger la fenêtre V1.1 d’environ cinq jours ouvrés après les transferts (B est le goulot) ; ou choisir lui-même des lignes qui passent en V1.2 ; ou combiner les deux.

### Tableau consolidé pour le PO (O, 18/11)

Périmètre : toutes les sorties remises en V1.1 (« on repousse rien »), plus les audits UX Lots 7, 10 et 11. Ordre V1.1 : les deux vrais défauts OCR de B passent d'abord (57 L10-4 PDF mixte, 57 L10-2 état « échec »).

| | B | F | Q | Équipe |
|---|---|---|---|---|
| Charge | 50,8 | 30,75 | 35,8 | 117,35 |
| Capacité au 04/12 | 31 | 24 | 34 | 89 |
| **Écart** | **+ 19,8** | **+ 6,75** | **+ 1,8** | **+ 28,35** |
| Transferts proposés (ci-dessous) | − 2,75 | 0 | + 2,75 | 0 |
| **Écart après transferts** | **+ 17,05** | **+ 6,75** | **+ 4,55** | **+ 28,35** |

Transferts proposés, de B vers Q (lignes isolées, sans fichier chaud) :
1. #113 (Starlette 1.x) et #110 (Python 3.15), ligne 58 bis : montées de version, CI complète entre chaque : B − 1, Q + 1.
2. Mesure sur un PDF de 100 pages et tests en conteneur de l'OCR page par page (57 L10-4) : B − 1, Q + 1.
3. Tests de l'extraction `.docx` et `.xlsx` (57 L11-1) : B − 0,75, Q + 0,75.

F ne peut rien prendre à B : F dépasse déjà (+ 6,75), et ses parts d'écran du Lot 7 et du Lot 10 sont déjà à son nom. Les transferts répartissent l'écart, ils ne le réduisent pas : il manque ≈ 28 h-s à l’équipe, soit 32 % de sa capacité (≈ 30 si le PDF officiel est produit par le serveur).

**Ce que le PO tranche** (rien ne sort sans sa décision) :
- **Allonger la fenêtre V1.1** : B reste le goulot ; à ≈ 3,4 h-s par jour, il faut ≈ 5 jours ouvrés de plus après les transferts (fin vers le 11/12).
- **Ou passer des lignes en V1.2**, au choix du PO. Les plus lourdes : délégation (57 L7-5) 10 h-s (B 7, F 1,5, Q 1,5), qui attend de toute façon trois choix du PO ; recherche sans accents (57 L10-3) 3,5 ; texte des `.docx` et `.xlsx` (57 L11-1) 2,75.
- **Ou un mélange des deux.**

Réserve : toute la colonne B est chiffrée par B. Les colonnes F et Q restent mes estimations, non confirmées ; si elles sont aussi basses que mes premiers chiffres pour B, l’écart de F peut encore grossir. Choix à poser au PO pour 57 L7-2 : « PDF officiel » = impression du navigateur (B 0) ou PDF produit par le serveur, avec empreinte SHA-256 (B + 2,5, nouvelle dépendance, image reconstruite).

### Renfort aide-api (O, 18/11 au soir)

Le PO a ouvert une session de renfort, **aide-api**. Elle prend 57 L10-1 (`?q=` dans le texte OCR), 57 L10-3 (recherche sans accents, migration d’ordre 8), 57 L11-1 (texte des `.docx` et `.xlsx`) et 57 L7-5 (délégation, après les trois choix du PO ; migration d’ordre 9). B garde 57 L10-4 (PDF mixte, rendu page par page et en lots : même fonction, `strategy.process_pdf`), 57 L10-2 (état « échec »), 57 L7-2, 57 L7-3 et ses PR en cours. L’innovateur ne code pas.

Chiffres d’aide-api `À recevoir` : en attendant, ses lignes gardent le chiffrage de B. Le transfert 3 ci-dessus (tests de 57 L11-1 vers Q) tombe : aide-api écrit ses tests.

| | B | F | Q | aide-api | Équipe |
|---|---|---|---|---|---|
| Charge avant renfort | 50,8 | 30,75 | 35,8 | — | 117,35 |
| Lignes passées à aide-api (L10-1 1, L10-3 3, L11-1 2,5, L7-5 7) | − 13,5 | 0 | 0 | + 13,5 | 0 |
| **Charge** | **37,3** | **30,75** | **35,8** | **13,5** | **117,35** |
| Capacité au 04/12 | 31 | 24 | 34 | `À recevoir` | 89 + aide-api |
| **Écart** | **+ 6,3** | **+ 6,75** | **+ 1,8** | `À recevoir` | **+ 28,35 − capacité d’aide-api** |
| Avec les transferts 1 et 2 (B vers Q : #113 et #110 ; mesure et tests de L10-4) | + 4,3 | + 6,75 | + 3,8 | — | inchangé |

**Proposition, à trancher par O** (lignes isolées, sans fichier chaud de B) :
1. aide-api prend aussi 57 L7-3 (recherche par date et par auteur) : même route `list_documents` que 57 L10-1, qu’elle suit déjà. B − 1, aide-api + 1.
2. aide-api prend #113 et #110 (transfert 1) à la place de Q : Q n’a plus de marge. B − 1, aide-api + 1.
3. aide-api fait l’écran de la délégation (nouvel écran, aucun fichier chaud de F) : F − 1,5, aide-api + 1,5.
4. Si le PO veut un PDF officiel produit par le serveur (57 L7-2, + 2,5), c’est aide-api qui le prend (`audit.py`, isolé), pas B.

Après 1 à 3, avec le transfert 2 (mesure de L10-4 vers Q) : **B ≈ 34,3 (+ 3,3)**, **F ≈ 29,25 (+ 5,25)**, **Q ≈ 36,8 (+ 2,8)**, **aide-api ≈ 17**. Le total de l’équipe ne change pas (117,35). Le renfort ne règle le dépassement de F que pour l’écran de la délégation : F reste le premier goulot.

**Docker à partir du 19/11 à 18:00 (O)** : une charge lourde à la fois pour F, pour B et pour aide-api (3 au plus en même temps, `/c/tmp/wait_slot.sh`), chacune plafonnée à 3 Go et 4 CPU.

#### Recalcul avec les chiffres d’aide-api (O et aide-api, 18/11 au soir)

Décisions d’O : les propositions 1 à 3 sont acceptées (57 L7-3, #113 et #110, écran de la délégation vers aide-api). La proposition 4 attend le choix du PO sur le « PDF officiel ». Le transfert 2 vers Q (mesure et tests de 57 L10-4) est maintenu. La délégation est débloquée : choix du PO consignés dans `DEC-2026-007`.

| Ligne d’aide-api | Chiffrage d’aide-api (h-s) | Avant (B, ou F pour l’écran) |
|---|---|---|
| 57 L10-1 | 1 | 1 |
| 57 L10-3 | 2,5 | 3 |
| 57 L11-1 | 2,5 | 2,5 |
| 57 L7-5, serveur | 1 (note de conception) + 6 à 7 | 7 |
| 57 L7-5, écran | 3 à 4 (liste, création avec dates, révocation, Vitest, un e2e) | F 1,5 |
| 57 L7-3 | 1 | 1 |
| #113 (Starlette 1.x, avec FastAPI) | 2 | 1 (avec #110) |
| #110 (Python) | 1,5 à 2 : Python 3.13 par une PR manuelle (O, 18/11) ; 3.15 écarté (torch, asyncpg sans wheels) | — |
| **Total** | **20,5 à 23** | 17 |

| | B | F | Q | aide-api | Équipe |
|---|---|---|---|---|---|
| **Charge** | **34,3** | **29,5** | **36,8** | **20,5 à 23** | **121,1 à 123,6** |
| Capacité au 04/12 | 31 | 24 | 34 | `À recevoir` | 89 + aide-api |
| **Écart** | **+ 3,3** | **+ 5,5** | **+ 2,8** | `À recevoir` | **+ 32,1 à 34,6 − capacité d’aide-api** |

- **B** : 50,8 − 15,5 (lignes passées à aide-api, au chiffrage de B) − 1 (transfert 2) = 34,3.
- **F** : 30,75 − 1,5 (écran de la délégation) + 0,25 (relecture de cet écran, demandée par aide-api) = 29,5. F ne relisait rien jusqu’ici, faute de marge : **à confirmer par O**. Sinon, c’est Q qui relit, à + 0,25.
- **Q** : 35,8 + 1 (transfert 2) = 36,8.
- **La charge de l’équipe monte de 3,75 à 6,25 h-s** : les chiffres d’aide-api sont plus réalistes que les estimations précédentes. Les deux montées de version passent de 1 à 3,5 ou 4, et l’écran de la délégation de 1,5 à 3 ou 4.
- **À trancher par O pour #110** : viser 3.12 ou 3.13. Dans ce cas, #110 (3.15) est fermée et remplacée par une PR manuelle. Sinon, viser 3.15 coûte + 1,5 à 2 et oblige à monter torch et easyocr en cascade : risque élevé sur l’OCR juste avant le 04/12.
- **Ordre d’aide-api** : L10-1, L10-3, L7-3, puis la note de la délégation, son serveur et son écran, puis L11-1 dès la fusion de la PR « état OCR » de B, enfin #113 puis #110.

**Décisions d’O (18/11 au soir)** :
- **#110** : on vise Python 3.13 (choix technique : 3.15 entraîne la cascade torch et easyocr, trop risquée pour l’OCR). aide-api fait une PR manuelle (1,5 à 2 h-s, déjà compté dans le tableau). Une fois cette PR fusionnée, elle ferme #110 avec un commentaire et ajoute un `ignore` Dependabot pour python ≥ 3.14, pour que #110 ne revienne pas.
- **Relecture de l’écran de la délégation par F** (+ 0,25, déjà compté : F 29,5).
- **DEC-2026-007 § 5** : défauts retenus par O, PO informé. L’administrateur de l’institution peut aussi désigner un intérimaire ; l’intérimaire vient du même service ; pas de redélégation ; validations déjà en attente incluses.
- Le tableau ci-dessus vaut donc pour l’option 3.13 : **aide-api 20,5 à 23**, équipe 121,1 à 123,6.
