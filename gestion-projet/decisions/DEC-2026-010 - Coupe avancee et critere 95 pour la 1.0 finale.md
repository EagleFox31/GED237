# DEC-2026-010 — Coupe avancée de `release/v1.0.0` et critère de 95 % pour la 1.0 finale

- **Statut** : BROUILLON, préparé par l'innovateur le 19/11 à la demande d'O. O le publie une fois la coupe faite, après avoir rempli les champs `‹…›`. Le numéro 009 est réservé à la DEC des leçons (une leçon par fichier), qui sera publiée après la coupe.
- **Décideurs** : le PO pour le critère (« 95 % pour la version finale », 19/11) et pour l'item 8 (§ 4) ; O pour l'exécution.
- **Modifie** : DEC-2026-005, § 1.1 (point de coupe) et § 1.2 (périmètre : la paire doublons est l'exception écrite prévue par ce paragraphe).
- **Sources** : `couverture-95-19-11.md` (mesure du 19/11 sur `main` 3fabddc5), `plan-fusion-v1.1.md` § 1 bis, `file-v1.1.md`.

## 1. Décision

1. **Coupe avancée.** `release/v1.0.0` est créée dès que #464 (correctif 1.0 de `/trash`, OK de Q) est dans `main` et que `main` est vert, avec l'accord du PO. #464 est fusionnée le 19/11 (`main` = 103ce48b). Le point de coupe n'est plus la fusion de #104.
   - Point de coupe : `‹sha court›`, fusion de #464 à `‹hh:mm›`.
2. **La recette du 20 au 23/11 et la démo du 30/11 se font sur la candidate figée**, et non sur `main`.
3. **La paire doublons entre dans la candidate.** #152, #181, #171 et #199 passent en tête de file juste après la coupe. Elles fusionnent dans `main`, puis une PR de report `main → release/v1.0.0` les amène dans la candidate (approche A retenue par O le 19/11, `plan-fusion-v1.1.md` § 1 bis ; texte de la PR au § 1 ter). #104 (notes de version) entre dans la candidate par la même PR de report.
   - **Exception à la règle du brouillon** : O sort ces 4 PR du brouillon au moment de leur passage. Les autres PR V1.1 restent en brouillon jusqu'au 24/11.
4. **`main` est gelé de la coupe jusqu'à la fusion de la PR de report.** Seules #152, #181, #171, #199 et #104 y entrent. Un correctif 1.0 urgent pendant le gel passe par la même PR de report.
5. **Critère de la 1.0 finale : 95 % du CDC, prouvés.** Cela fait 30,5 points sur 32, par la méthode du 10/11 (32 items à poids égal, `fait` = 1, `partiel` = 0,5). La candidate n'est déclarée 1.0 finale que lorsque les preuves du § 2 sont versées. Le dénominateur ne change pas.
6. **Échéances qui suivent la coupe**, sur signal d'O et non plus à 18:00 : push de #104, DEC-2026-004, DEC-2026-009.

## 2. Ce qu'il faut pour 95 %

Au 19/11 sur `main`, le score est de 27,5/32 (85,9 %). Les 5 conditions ci-dessous mènent à 30,5/32 (95,3 %), **sans aucune marge**. Une seule qui manque, et la 1.0 finale n'est pas atteinte.

| Item du CDC | Gain | Preuve attendue | Porteur | Date | Risque |
|---|---|---|---|---|---|
| 19. Détection des doublons | +0,5 | #152, #181, #171 et #199 fusionnées, puis reportées dans la candidate | B, F, Q, O | 19 au 20/11 | moyen : 2 PR en conflit avec `main` ; ≈ 4,25 h-s |
| 29. Disponibilité ≥ 99 % | +0,5 (`partiel` au mieux) | relevé C6 tenu à 18:00 (≥ 6 relevés verts consécutifs) | Q | 19/11, 18:00 | **élevé** : trou de nuit (03:29Z à 06:45Z), puis arrêt de Docker ce matin |
| 27. HTTPS | +0,5 | `prove_tls` réussi (passage 2) | Q | 20/11 | faible |
| 28. Déploiement sur site | +1 | installation sans Internet réussie (vaut preuve, réponse 15 du PO) | Q | 25/11 | moyen |
| 31. Documentation | +0,5 | rejeu du manuel sans écart (issue #273) | Q | 25/11 | moyen |

Q avance ce qui peut l'être dès aujourd'hui (réserve parallèle du 19/11). Lecture : si C6 échoue ce soir, le meilleur score est 30/32 (93,75 %), et seul l'item 8 permettrait d'atteindre 95 % (§ 4).

## 3. Calendrier qui en découle

- La 1.0 finale ne peut pas être déclarée avant le 25/11 au soir, après l'installation hors ligne et le rejeu du manuel.
- Chaque correction issue de la recette passe par `main` puis par une PR de report, comme la paire.
- Tag : la candidate reçoit le tag rc.1 à la coupe (DEC-2026-005). Le tag `v1.0.0` final est posé quand le § 2 est complet : `‹date›`.

## 4. À trancher par le PO : l'item 8 (100 000 fichiers en moins de 20 minutes)

Aujourd'hui, l'item 8 n'est pas planifié : c'est la « mesure de décembre » (#270, plan-v1.1, hypothèse 6). Le protocole existe (#166), mais aucune mesure n'a été faite.

| Option | Effet sur les 95 % | Coût |
|---|---|---|
| **a. Hors 1.0, mesure en décembre** (statu quo) | aucune marge : les 5 conditions du § 2 doivent toutes réussir | aucun maintenant |
| **b. Mesure avancée avant la 1.0 finale, comme marge** | +1 point si la mesure passe : la 1.0 tient même si C6 échoue | non chiffré : une passe d'ingestion longue sur une machine limitée en mémoire, et un créneau Docker à prendre à Q (`Déduit`) |
| **c. Item 8 retiré du CDC de la 1.0** | change le dénominateur (31 items), contraire à la règle de mesure | décision contractuelle |

Recommandation de l'innovateur : **b si C6 échoue ce soir, a sinon**. On décide après le relevé de 18:00, pour ne pas immobiliser Q avant d'en avoir besoin.

O présente les 3 options et cette recommandation au PO après le relevé C6 du 19/11 au soir. Décision du PO : `‹a / b / c›`, le `‹date›`.

## 5. Réversibilité

- Si la paire n'est pas verte avant la recette, la candidate reste sans elle. L'item 19 reste `partiel`, et 95 % n'est plus atteignable sans l'item 8.
- Si le report échoue, on le refait avec une branche partie de `release/v1.0.0` et `git cherry-pick -m 1` des commits de fusion (`plan-fusion-v1.1.md` § 1 bis).
