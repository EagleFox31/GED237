# Note au PO : couper `release/v1.0.0` (19/11, à présenter si la lecture de 18:00 est bonne)

Préparée par l'innovateur le 19/11 à partir de `couverture-95-19-11.md`, de DEC-2026-010 et du runbook `runbook-coupe-19-11.md`. Rien n'est appliqué : aucune branche `release`, aucun ruleset.

## 1. Où on en est

- Score au 19/11, 13:21 : **30/32**, avec `main` = cffb7a4b (#199 fusionnée, item 19 prouvé). Depuis, #492 (menu « Doublons » masqué selon le droit) est fusionnée : `main` = 9cbe452e, score inchangé. Puis #498 (résumé C6 avec trous et échecs) est fusionnée : `main` = 1c4cea16, score inchangé. Le SHA de la coupe sera celui de la lecture C6 de 18:00.
- Le seuil est **30,5/32** (95 %, méthode du 10/11 : 32 items à poids égal, `fait` = 1, `partiel` = 0,5).
- **Il manque un demi-point : l'item 29 (disponibilité ≥ 99 %).** Il passe à `partiel` si la sonde C6 compte au moins 6 relevés verts consécutifs entre le 17 matin et le 19 soir (checklist, ligne 0.2). **Lecture de Q sur `c6.tsv` (19/11, 14:00) : la ligne 0.2 est acquise dans les deux lectures.**
  - Lecture brute : 714 relevés verts consécutifs, du 17/11 07:18Z au 19/11 03:29Z.
  - Lecture stricte (sans trou de plus de 15 min entre deux relevés) : 282 relevés, du 18/11 07:18Z à 19:01Z, soit 11 h 44.
  - Résultat : **30,5/32, soit 95,3 %**, sans aucune marge. Q refait le contrôle à 18:00.
- **Trous de plus de 15 min sans relevé, cités tels quels** : 17/11 de 19:11Z à 20:08Z (56 min) ; 18/11 de 05:26Z à 07:18Z (111 min) ; 18/11 de 19:01Z à 20:02Z (60 min) ; 19/11 de 03:29Z à 06:45Z (196 min, soit 3 h 16). Un trou n'est ni un relevé vert ni un échec : on ne sait pas si la pile répondait.
- **Relevés en échec, cités tels quels** : 19/11 à 06:45Z et 06:50Z (panne Docker) ; 19/11 de 12:01Z à 12:41Z, 9 relevés (pile de démo arrêtée sur commande, relancée avec l'accord du PO), reprise verte à 12:46Z. La ligne 3.7 (« 10/10 relevés matin/soir, 17 au 21 ») court jusqu'au 21 : l'item 29 ne sera donc jamais `fait` dans la 1.0.
- **Deux cas pour le score** : **30,5/32 avec C6 seule** (seuil atteint) ; **31,5/32 avec C6 et l'item 8** (marge d'un demi-point sur le seuil). L'item 8 n'est pas nécessaire à la coupe : il ne la conditionne pas.

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
- **Item 8, 100 000 fichiers en moins de 20 minutes** : deux essais, deux réglages (rapport sur #473, 7243b3c7).
  - Installation livrée (1 processus api, concurrence 2) : 30 min 28, critère non tenu.
  - Réglage musclé (2 processus api, concurrence 4, 7,5 cœurs, machine de 8 cœurs et 12 Go) : **18 min 41**, critère tenu avec 6 % de marge, 0 perte, 0 erreur, recherche de 29 à 174 ms.
  - L'item ne compte donc **que si** le PO accepte que ce réglage devienne celui de la 1.0 **et** que la PR « capacité » d'aide-api est fusionnée avant la coupe. Sinon il reste à 0, sans effet sur la coupe.
  - **Décision du PO (19/11, vers 13:45, DEC-2026-012)** : le réglage puissant devient celui de la 1.0, avec 8 cœurs et 12 Go minimum écrits dans `DOCS/exploitation/installation.md`. Essai de confirmation à 16:00 avec le compose de la PR capacité ; PR fusionnée avant 17:30, sinon l'item 8 n'est pas compté. La coupe n'attend pas l'item 8.
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
