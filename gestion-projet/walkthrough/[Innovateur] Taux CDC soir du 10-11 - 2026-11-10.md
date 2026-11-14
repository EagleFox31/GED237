# Taux de couverture CDC — relevé du 10/11 (après la file du jour)

- **Pour** : O (engagement PO : **75 % demain soir, 11/11**), PO. Innovateur, 2026-11-10 ; méthode de la note du matin (`[Innovateur] Recalcul du taux CDC - 2026-11-10.md`) : 32 items de l'audit du 9/11 à poids égal, `fait` = 1, `partiel` = 0,5, `absent` / `non vérifiable` = 0 ; un item passe à `fait` seulement sur preuve **fusionnée dans `main`**. Niveaux : `Vérifié` = `gh`, `git log` ; `Déduit` = calcul.
- **Base** : `main` **75f3fb6** (13:00) ; § 3 donne la règle pour rejouer le calcul sur le SHA de fin de file sans refaire l'analyse.

## 1. PR comptées comme fusionnées depuis d34d51b (`Vérifié`, `git log --merges d34d51b..main`)

| PR | Sujet | Item CDC touché | Effet sur le score |
|---|---|---|---|
| #75 | Celery `ignore_result` | — | 0 |
| #76 | année dans les noms avec `_` | 1 (reste partiel : pas de critère contenu) | 0 |
| #85, #86 | docs (grille, lots, décisions) | — (31 reste partiel : pas de manuel d'installation) | 0 |
| #77 | KPI doublons, API `GET /analytics/tenant` | 20 (reste **partiel** sans la tuile #81) | 0 |
| **#78** | espaces : filtres serveur, pagination, états vides | **5 : partiel → fait** (API #38 + écran #78) | **+ 0,5** |

## 2. Taux (`Déduit`)

| Mesure | 9/11 | `main` d34d51b (11:30) | `main` 75f3fb6 (13:00) | **`main` d82a4f1 (#81 + #82, 12:30)** | Objectif PO 11/11 |
|---|---|---|---|---|---|
| `fait` | 14 | 18 | 19 | **22** | — |
| `partiel` | 9 | 6 | 5 | **4** | — |
| `absent` / `non vérifiable` | 9 | 8 | 8 | **6** | — |
| **Taux pondéré** | 57,8 % | 65,6 % (21/32) | 67,2 % (21,5/32) | **75,0 % (24/32)** | **75 % = 24/32** |

À 13:00 (75f3fb6) : + 1,6 point par rapport à 65,6 % (un seul item, #78), 75 % non atteint, 2,5 points d'item manquants. **Relevé 12:30 sur d82a4f1** (`Vérifié`, `gh pr list --state merged`) : #81 (3f10054) rend l'item 20 `fait` (+ 0,5) et #82 (d82a4f1) rend les items 2 et 14 `fait` (+ 2) → **24/32 = 75,0 %, objectif PO du 11/11 atteint**, sans session de code (§ 3). Chiffre définitif à confirmer sur le SHA de fin de file envoyé par O ce soir ; aucune autre PR ouverte ne fait bouger le taux avant sa fusion (#89 : item 24 ; #79 + #84 : item 21 ; #92 + #95 : item 1 partiel).

## 3. Ce qui fait passer la barre au moindre coût (`Déduit`, PR ouvertes au 10/11 13:00)

| Ordre | PR | Item CDC | Gain | État CI / chaîne | Coût restant (h-s) |
|---|---|---|---|---|---|
| 1 | **#82** (Q) activation D1 : `c2-2026-11-10.txt`, `c3-2026-11-10.txt` | **2** (≥ 95 % classés, C2 = 100 %) et **14** (recherche < 2 s, p95 27 ms) : non vérifiable → fait | **+ 2** | verte, approuvée, en chaîne | **0 h-s de code** ; chaîne ≈ 0,5 h-s |
| 2 | **#81** (F) tuile « Doublons refusés » | **20** : partiel → fait (avec #77 déjà fusionnée) | **+ 0,5** | verte, chaîne 26b en cours | 0 h-s de code ; chaîne ≈ 0,5 h-s |
| | **Total #82 + #81** | | **24/32 = 75,0 %** | | ≈ 1 h-s de chaîne, aucune session de code |
| 3 (réserve) | **#89** (Q) responsive 375/768/1280 | **24** : non vérifiable → fait (rapport vert joint) | + 1 | verte | 0 h-s de code ; chaîne ≈ 0,5 h-s |
| 4 (réserve) | **#79 + #84** (B, F) export/import des règles | **21** : absent → fait | + 1 | vertes, #79 en tête de chaîne 37 | 0 h-s de code ; chaîne ≈ 1 h-s (deux PR) |

Lecture : **#82 et #81 suffisent, à zéro heure de code** ; elles sont déjà vertes et en chaîne. Si l'une des deux glisse, #89 ou #79 + #84 compensent chacune pour 1 point d'item. Avec les quatre lignes fusionnées : 26/32 = **81,3 %**. Les autres PR ouvertes ne bougent pas le taux (#80/#87 : item 11 déjà fait ; #83/#88 : item 9 déjà fait ; #93, #94, #90, #91, #96, #97 : aucun item) ; #92 + #95 (lot 4) apportent + 0,5 (item 1) seulement.

Rejeu ce soir : pour chaque PR fusionnée après 75f3fb6, ajouter le gain de la ligne ci-dessus (0 si elle n'y figure pas) ; `fait` = 19 + nombre de passages à fait, `partiel` ajusté en conséquence ; taux = (fait + 0,5 × partiel) / 32.

Sources : `git log --oneline --merges d34d51b..origin/main` ; `gh pr list --state open --json number,statusCheckRollup` (10/11 13:00) ; `[Audit] Audit fonctionnel profond - 2026-11-09.md` § 1 (32 items) ; `[Innovateur] Recalcul du taux CDC - 2026-11-10.md` § 2 ; `PASSATION.md` (chaînes 26b, 37, 38, 39 du 10/11 12:08–12:19).
