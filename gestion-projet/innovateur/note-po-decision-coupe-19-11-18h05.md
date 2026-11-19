# Décision de coupe de la V1.0 : note au PO (19/11, vers 18:05)

> **Décision du PO à 18:03 : « on les attend ».** Pas de coupe sur `f890b3cb`. La coupe se fait cette nuit, après l'entrée de #450 et #502 dans `main`. La suite est au § 6. Les §§ 1 à 5 gardent l'état présenté à 18:05.

Une page, présentée par O. Le SHA de `main` et la lecture C6 sont remplis avec les relevés de Q (18:01). Le détail est dans `note-po-coupe-release-v1.0.0.md` et `couverture-95-19-11.md`.

- **SHA de `main` lu à 18:00** : `f890b3cb5a232f441e625b3cac8ca39de2cf43a8` (lu par Q à 18:01)
- **Lecture C6 de 18:00** : tous les relevés sont verts depuis 12:46Z, soit plus de 4 h sans échec (il en faut au moins 6 consécutifs) → ligne 0.2 ☑ tenue ☐ non tenue
  - Sur 857 relevés depuis le 17/11, 11 sont en échec, tous parce que le serveur ne répondait pas : 2 à la reprise de la machine le 19/11 (06:45Z et 06:50Z), et 9 entre 12:01Z et 12:41Z.

## 1. Le score

La règle : 32 points du cahier des charges, il faut **30,5** (95 %). Avant la lecture C6 : **30/32**. Avec C6 tenue : **30,5/32**, donc la variante A est possible ; la décision reste au PO.

- **Item 8, 100 000 fichiers en moins de 20 min** : essai du 19/11 à 16:01, **23 min 07, non tenu** (72 fichiers par seconde ; ce matin, le même réglage faisait 94 fichiers par seconde). Aucune perte, et la recherche tient (pire temps : 182 ms). Le goulot est l'envoi des fichiers au serveur, pas leur traitement. #497 n'est donc pas fusionnée avant la coupe, et l'item 8 ne compte pas. Nouvel essai en V1.1 ; rapport complet sur #473.

| Variante | Quand | Score | Marge |
|---|---|---|---|
| **A** (seule possible) | C6 tenue | **30,5/32** (95,3 %) | aucune |
| ~~B~~ | écartée : elle supposait l'item 8 tenu | ~~31,5/32~~ | — |

Si C6 n'est pas tenue, le score reste à 30/32 : **pas de coupe ce soir**.

## 2. Les anomalies, sans arrondi

- **Disponibilité de 99 % : non démontrée.** La sonde ne donne qu'un demi-point (« partiel »). Le point entier est impossible dans la V1.0 : il faudrait plus de jours de relevés.
- **4 trous sans aucun relevé** (on ne sait pas si l'application répondait) :
  - 17/11, 19:11 → 20:08 (56 min) ;
  - 18/11, 05:26 → 07:18 (111 min) ;
  - 18/11, 19:01 → 20:02 (60 min) ;
  - 19/11, 03:29 → 06:45 (**3 h 16**).
- **11 relevés en échec (KO)** :
  - 19/11 à 06:45 et 06:50 (2), panne de Docker ;
  - 19/11 de 12:01 à 12:41 (9), pile de démo arrêtée sur commande puis relancée avec votre accord.
- Heures en temps universel (Z), telles que la sonde les écrit.

## 3. Deux points fragiles si quelqu'un les conteste

- **Item 24, écran adapté à toutes les tailles.** Il est noté « fait » par déduction : le rapport mobile vert n'a pas été retrouvé. Sur un portable en 1366×768, le bouton « Envoyer » du dépôt sort de l'écran tant que #450 n'est pas dans `main`. Si l'item 24 tombe à « partiel », la variante A passe sous le seuil (30/32).
- **Item 22, circuit de validation.** Il fonctionne, mais l'audit du 19/11 relève des gênes :
  - un document rejeté n'a pas de bouton pour le corriger et le renvoyer ;
  - le motif du rejet ne se lit que dans un onglet de la fiche ;
  - « Tâches & Suivi » valide en un clic, sans confirmation.
  Ces gênes sont annoncées aux testeurs et corrigées en V1.1 (#502 pour le rejet). Si l'item 22 tombe à « partiel », la variante A passe sous le seuil.
- Sans l'item 8, il n'y a aucune marge : la perte d'un seul de ces deux items ramène le score à 30/32, sous le seuil.

## 4. Ce qui entre après la coupe (DEC-2026-013)

- Ces trois correctifs d'écran entrent dans `main` pour l'UAT du 23, **pas dans la V1.0 coupée** :
  - #441, le clavier ;
  - #450, le bouton « Envoyer » toujours visible ;
  - #442, le nombre de tâches sur le menu.
- Ordre : une PR à la fois, chacune après une nouvelle preuve de Q sur `main`.
- L'UAT se joue sur `main`. L'écart avec le SHA coupé (ces trois écrans) est noté au relevé.
- Tout le reste attend la V1.1. Ses PR restent en brouillon jusqu'au 24/11.

## 5. Les deux questions, à poser l'une après l'autre

**Question 1 : la coupe.**
« Je confirme que `release/v1.0.0` est créée sur `main` au SHA `f890b3cb`, avec un score de 30,5/32. »
☐ Oui ☐ Non

**Question 2 : la protection de la branche de version**, à poser seulement si la réponse à la question 1 est oui.
« J'autorise O à protéger `release/**` : suppression interdite, pas de réécriture de l'historique, passage obligatoire par une PR, contrôle CI exigé. La protection de `main` ne change pas. »
☐ Oui ☐ Non

Tant que la question 2 n'a pas de réponse positive et que la protection n'est pas active, rien n'est fusionné sur la release.

## 6. Après la décision de 18:03 : ce qui entre avant la coupe

- **Ordre de fusion** : #441 → #450 → #442 → #429 → #438 → #502. Une PR à la fois, chacune après la preuve de Q sur sa tête à jour avec `main`. Commandes et re-ciblages : `runbook-coupe-19-11.md` § 9.
- **Effet sur le score.** Le score ne change pas : **30,5/32**, si la nouvelle lecture C6 est tenue. Les items 22 et 24 comptaient déjà comme « fait ». Le seuil reste à 30,4 : la marge en points reste la même (0,1).
  - Ce qui change, c'est le risque. Avec #450, le bouton « Envoyer » reste visible en 1366×768 : l'item 24 n'a plus de défaut connu. Avec #502, un document rejeté peut être corrigé et renvoyé : le premier défaut de l'item 22 disparaît.
  - Les deux autres gênes de l'item 22 restent : le motif du rejet est seulement dans un onglet, et la validation se fait en un clic. Elles sont annoncées aux testeurs.
  - Il reste aussi une condition : le rapport mobile de l'item 24 doit être retrouvé ou refait. Sans lui, l'item reste « fait » par déduction.
  - En clair : les deux points fragiles deviennent solides, mais aucun point n'est gagné. La perte d'un seul demi-point ramène toujours le score sous le seuil.
- **Chaîne des migrations** : aucune de ces six PR n'apporte de migration. La base de données de la release reste à `a7c8d9e0f1b2`. Une seule précaution : #445 (qui a une migration) part de la branche de #429. Elle est donc re-ciblée sur `main` avant la fusion de #429, et sa migration ne change pas.
- **Nouvelle lecture C6** : la pile de démo est relancée sur le SHA final. Il faut ensuite au moins 6 relevés verts consécutifs, soit au moins 30 min, puisque la sonde relève toutes les 5 min.
- **Les deux questions du § 5** sont reposées avec le SHA final : `d96c1e679c0ff470de4bce30f296dc3fe82cc59e` (`d96c1e67`, les six PR fusionnées, une seule tête de migration `a7c8d9e0f1b2`). Lecture C6 sur ce SHA : ____ relevés verts consécutifs → ☐ tenue ☐ non tenue.

## 7. Lecture pour la question de coupe (à présenter après la C6 sur `d96c1e67`)

- **Score** : **30,5/32** si la C6 est tenue sur `d96c1e67` ; sinon 30/32 et pas de coupe. La marge reste de 0,1 point : aucun demi-point ne peut être perdu.
- **Écart trouvé à la recette (C.22, point 4)** : les décisions du circuit (viser, valider, rejeter) n'apparaissent pas dans le journal d'audit. B corrige.
  - **Item 22** : pas d'effet. Selon la checklist, seuls les points 1 à 3 déclassent l'item. Il reste « fait » si Q confirme que les points 1 à 3 sont verts sur `d96c1e67`.
  - **Item 11, « historique des actions »** : c'est là qu'est le risque. Il est noté « fait » sur les actions des documents (#80, #98, scénario SC-AUD-01). Un examinateur qui valide un document puis ouvre le journal n'y verra rien. S'il conteste, l'item 11 tombe à « partiel » et le score à 30/32, sous le seuil. **C'est un nouveau point fragile, à annoncer au PO.**
- **Deux façons de traiter cet écart** (décision du PO) :
  - **A. Couper sur `d96c1e67`** et annoncer l'écart comme connu. Le correctif de B passe ensuite par une PR vers la release, puis une recopie vers `main` (runbook § 6). Il faut pour cela que la protection de `release/**` (question 2) soit en place. La C6 obtenue reste valable, et la coupe a lieu dès que la C6 est lue.
  - **B. Attendre #445 dans `main`** avant de couper. Le correctif existe déjà dans #445 (délégations), tête `d240f6c2` : chaque décision du circuit y écrit une ligne d'audit, avec la personne remplacée si la décision est déléguée. Q donne un avis favorable sur la résolution du conflit avec `d96c1e67`. La passe pytest de B est à faire. Ce que B fait entrer dans la V1.0 (relevé par git diff contre `main`, 19/11 au soir) :
    - **+2 481 lignes sur 30 fichiers**, soit plus que les six PR de la coupe réunies ;
    - **deux migrations** : `0f6f64260460` (recherche sans accents) puis `7680f303299d` (délégations). La tête de la release passe de `a7c8d9e0f1b2` à `7680f303299d`. Il faut lancer `alembic upgrade head` sur `edossier`, `test_ged` et la base de la pile de démo ;
    - **tout le contenu de #436**, recopié à l'identique (la recherche sans accents, le moteur de recherche, `tasks.py`, la migration `0f6f…`). La recherche, déjà notée « fait », change donc de comportement juste avant la coupe. #436 devient vide et se ferme après. La chaîne du § « Migrations » des trains devient : `a7c8` → `0f6f` → `7680` → #457 ;
    - **deux capacités hors CDC** (délégations, recherche sans accents), qui étaient prévues en V1.1 (TR-12). Il faut un accord du PO pour les faire entrer dans la V1.0.
    - **Durée réelle** : environ 3 h-s, avec une fourchette de 2,5 à 4. Le détail : pytest de B (0,5), preuve de Q sur `d240f6c2` (parcours des délégations, recherche avec et sans accents, montée et descente des deux migrations : 1 à 1,5), fusion et CI (0,5), `alembic upgrade head` puis nouvelle C6 sur le nouveau SHA (0,75), C.22 point 4 rejoué (0,25).
  - **C. Un correctif réduit** : seulement les lignes d'audit des décisions, sans délégation et sans migration. B doit dire si c'est possible sans la colonne « au nom de ». Cela prend 1 à 1,5 h-s avec la preuve de Q. Il peut passer sur `main` avant la coupe (avec une nouvelle C6), ou sur la release après la coupe (runbook § 6).
  - **Recommandation : A**, en annonçant l'écart du journal comme une limite connue. Il est corrigé en V1.1 par #445, à sa place dans le train TR-12. Si le PO veut ce correctif dans la V1.0, c'est C, sur la release. **Je déconseille B** : aucun point gagné, 3 h-s de plus, deux migrations et deux capacités V1.1 qui entrent après le gel, et la recherche qui change. On ajoute ainsi un risque sur des items déjà acquis, alors que la marge est de 0,1.
- **Recette de Q sur `d96c1e67`** (Playwright sur une pile jetable, 19/11 au soir ; captures dans `mesures-2026-11-20/item22` et `item24`) :
  - **Item 22** : C.22 points 1, 2 et 3 **verts** (pytest du circuit : 19 tests passés). L'item reste « fait » avec une preuve. Le point 4 (journal d'audit) est **rouge sur `d96c1e67`**, et **vert sur `d96c1e67` + #445** : le journal contient alors `workflow_approved` (2 fois) et `workflow_rejected` pour les trois décisions.
  - **Item 24** : C.24 points 1, 2 et 3 **verts**. Il n'est plus « fait » par déduction : il a maintenant sa preuve. En 1366×768, « Envoyer » est atteint et le dépôt aboutit. En 375 px, les 20 boutons de « Tâches & Suivi » et les 6 de la fenêtre de dépôt sont atteignables.
  - **Bilan** : les deux points fragiles du § 3 (items 22 et 24) sont levés. Il ne reste qu'un point fragile, l'item 11 (journal sans les décisions du circuit). Le choix entre A, B et C le concerne lui seul.
