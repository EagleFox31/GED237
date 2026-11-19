# Décision de coupe de la V1.0 : note au PO (19/11, vers 18:05)

Une page, présentée par O. Seuls le SHA de `main` et le résultat de la lecture C6 (Q, 18:00) restent à remplir. Le détail est dans `note-po-coupe-release-v1.0.0.md` et `couverture-95-19-11.md`.

- **SHA de `main` lu à 18:00** : `__________`
- **Lecture C6 de 18:00** : ____ relevés verts consécutifs (il en faut au moins 6) → ligne 0.2 ☐ tenue ☐ non tenue

## 1. Le score

La règle : 32 points du cahier des charges, il faut **30,5** (95 %). Avant la lecture C6 : **30/32**.

| Variante | Quand | Score | Marge |
|---|---|---|---|
| **A** | C6 tenue, mais l'essai de 100 000 documents a échoué **ou** #497 n'est pas fusionnée | **30,5/32** (95,3 %) | aucune |
| **B** | C6 tenue, l'essai tient sous 20 min **et** #497 est fusionnée | **31,5/32** (98,4 %) | un demi-point |

Variante retenue : ☐ A ☐ B. Si C6 n'est pas tenue, le score reste à 30/32 : **pas de coupe ce soir**.

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
- En variante B, la perte d'un de ces deux items laisse le score à 31/32, toujours au-dessus du seuil.

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
« Je confirme que `release/v1.0.0` est créée sur `main` au SHA `__________`, avec un score de ☐ 30,5/32 ☐ 31,5/32. »
☐ Oui ☐ Non

**Question 2 : la protection de la branche de version**, à poser seulement si la réponse à la question 1 est oui.
« J'autorise O à protéger `release/**` : suppression interdite, pas de réécriture de l'historique, passage obligatoire par une PR, contrôle CI exigé. La protection de `main` ne change pas. »
☐ Oui ☐ Non

Tant que la question 2 n'a pas de réponse positive et que la protection n'est pas active, rien n'est fusionné sur la release.
