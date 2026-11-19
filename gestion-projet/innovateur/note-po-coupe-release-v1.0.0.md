# Note au PO : couper `release/v1.0.0` (19/11, à présenter si la lecture de 18:00 est bonne)

Préparée par l'innovateur le 19/11 à partir de `couverture-95-19-11.md`, de DEC-2026-010 et du runbook `runbook-coupe-19-11.md`. Rien n'est appliqué : aucune branche `release`, aucun ruleset.

## 1. Où on en est

- Score au 19/11, 13:21 : **30/32**, avec `main` = cffb7a4b (#199 fusionnée, item 19 prouvé).
- Le seuil est **30,5/32** (95 %, méthode du 10/11 : 32 items à poids égal, `fait` = 1, `partiel` = 0,5).
- **Il manque un demi-point : l'item 29 (disponibilité ≥ 99 %).** La lecture C6 de 18:00 le donne à `partiel` si elle compte au moins 6 relevés verts consécutifs. Dans ce cas : **30,5/32, soit 95,3 %**. Sans aucune marge.

## 2. Ce qui est prouvé

| Item | Preuve |
|---|---|
| 19 Doublons | #171 (serveur) et #199 (écran), test `duplicates.spec.ts`, fusionnées le 19/11 |
| 27 HTTPS | `prove_tls` passé par Q le 19/11 sur 103ce48b |
| 28 Déploiement sur site | installation sans Internet réussie dans le lab de Q, avec #477 (correctif de l'import d'images) ; référence `main` = 65d3eaaa |
| 31 Documentation | passe de Q dans le lab (annexe A du protocole hors ligne), acquise avec la fusion de #482 (`ops/`) ; `main` = 9542b4d5 |
| Les 24 autres items | `fait` sur `main`, preuves listées dans `couverture-95-19-11.md` § 2 |

## 3. Ce qui n'est pas prouvé

- **Item 29, disponibilité ≥ 99 %** : seulement `partiel` après C6. Le `fait` est impossible dans cette version : il faudrait une durée de relevé que la 1.0 n'a pas. Si C6 échoue ce soir (relevés non verts ou trou de sonde), le score reste à 30/32 (93,75 %).
- **Item 8, 100 000 fichiers en moins de 20 minutes** : premier essai non prouvé (30 min 28 pour un seuil de 20 min ; 0 perte, lectures sous 0,4 s). Un nouvel essai à environ 8 cœurs est en cours (lancé à 13:18, fin attendue vers 13:45-13:55). S'il passe, le score monte et la marge apparaît. S'il échoue, l'item reste à 0 : il ne compte pas dans la coupe et n'est pas une condition.
- **Items 28 et 31 prouvés sur une seule machine** : le lab de Q (Docker dans Docker, images de `main`). Le PO l'a accepté le 19/11 ; il n'y a pas de deuxième machine avant le 25/11.
- **Item 24, interface responsive** : noté `fait` par déduction (rapport mobile vert non retrouvé).
- **Lab à plusieurs postes** (W2 ce soir à 18:30) : ne rapporte aucun point. Il renforce les preuves des items 16, 27 et 28.

## 4. Les deux accords à demander au PO

**Accord 1 : la coupe.** « Je confirme que `release/v1.0.0` est créée sur `main` au SHA de la lecture C6, avec un score de 30,5/32. » Conséquences :
- La branche est créée par O sur le SHA noté, puis les correctifs vont d'abord sur la release et sont recopiés sur `main` par `cherry-pick -x`.
- Les échéances liées à la coupe se déclenchent sur signal d'O : push unique de #104 puis `gh pr ready 104`, DEC-2026-004, DEC-2026-009.
- Les PR V1.1 restent en brouillon jusqu'au 24/11, puis suivent la fusion par trains (DEC-2026-011).
- Si C6 est mauvaise ou si le score reste à 30, **il n'y a pas de coupe ce soir** : l'accord est alors remplacé par le choix de l'item 8 (DEC-2026-010 § 4, options a, b, c).

**Accord 2 : le ruleset de la release.** « J'autorise O à créer le ruleset de `release/**` (suppression interdite, pas de réécriture d'historique, PR obligatoire, CI Gate exigée) ; le ruleset de `main` n'est pas touché. » Précisions :
- L'écriture est faite par O, en `plan`, puis `apply`, puis `plan` pour constater qu'il n'y a plus de dérive (`runbook-coupe-19-11.md` § 4).
- Aucune fusion sur la release tant que le ruleset n'est pas actif.
- Le ruleset de `main` (« AppFactory default branch governance », id 26190959) doit rester ciblé sur la branche par défaut : contrôle après la création.

## 5. Ce que le PO ne verra pas ce soir

- Pas de fusion supplémentaire sur `main` pendant la coupe, hors correctifs.
- L'item 29 sera `partiel`, jamais `fait`, dans la 1.0.

## 6. Recommandation de l'innovateur

Accorder les deux accords **si et seulement si** la lecture de 18:00 donne ≥ 6 relevés verts consécutifs et que `main` n'a pas bougé depuis le SHA lu. Le recomptage est inscrit dans `couverture-95-19-11.md` juste après la lecture. L'ordre est : accord 1, coupe, puis accord 2 avant toute fusion sur la release.
