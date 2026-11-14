# § 4 « Budget au 14/11 » en heures de session — brouillon pour O

- **Pour** : O (reprend ce bloc dans `point-2026-11-14.md` § 4 le 13 au soir, avec les fusions réelles), le PO. Innovateur, 2026-11-10 12:45, sur `main` d82a4f1, non commité. Grille : `conversion-heures-session.md` § 3 (code = j × 1,5 ; + 1 h-s de chaîne par PR : 2 runs CI × 13 min + relecture O ; + 1 h-s de recette Q par lot). Niveaux : `Vérifié` = horodatages `gh pr list` et passations du 10/11 ; `Déduit` = grille appliquée ; `Proposé` = marge.
- **Unité** : h-s = heure de session (horloge murale d'une session sur un sujet). La colonne j héritée est grisée, pour la traçabilité des fiches seulement.

## 1. Consommé depuis le 10/11 08:00 (`Vérifié`, 10/11 12:30)

| Rôle | Fenêtre | PR ouvertes ou fusionnées | Consommé |
|---|---|---|---|
| B | 08:00 → 12:30 | D1 #70 (fusionnée), #75, #76, lots 1–4 #77, #79, #80, #83, #92 + correctifs #79/#92, D3 en test | **≈ 4,5 h-s** |
| F | 08:30 → 12:30 | #66, #73, #78, #81, #84, #87, #88, #93, #94, #95, #97 | **≈ 4 h-s** |
| Q | 08:00 → 12:30 | #62–#65, #67, #69, #71, #74, #82, #89, #91, SC-V11-04 (commit local) | **≈ 4,5 h-s** |
| O | 08:00 → 12:30 | 24 fusions (#62 → #82), file de relecture | ≈ 4,5 h-s |
| I | 08:00 → 12:30 | #85, #86, #90, #96, 6 relectures, 4 brouillons | ≈ 4,5 h-s |

Lecture : les cinq lots chiffrés 1,55 j « de session » dans les fiches ont coûté **≈ 3 h 15 de code B** (lots 1–4) ; l'ensemble des 15 PR fonctionnelles V1.1 a été ouvert en **une demi-journée**. Ce qui reste est de la chaîne et de la recette, pas du code.

## 2. Reste à faire jusqu'au 19/11 18:00 (`Déduit`, grille § 3)

| Poste | PR | Code restant (h-s) | Chaîne (h-s, 1/PR) | Recette Q (h-s) | **Total h-s** | Qui | Hérité (j) |
|---|---|---|---|---|---|---|---|
| Lot 1 tuile doublons | #77, #81 fusionnées | 0 | 0 | 0,5 (rejeu D1 le 20) | **0,5** | Q | 0,3 |
| Lot 2 export/import des règles | #79 (B), #84 (F), #91 (Q, dépend de #79) | 0 | 3 | 1 | **4** | O, Q | 0,55 |
| Lot 3a export CSV du journal | #80 (B), #87 (F) | 0 | 2 | 0,5 | **2,5** | O, Q | 0,35 ¹ |
| Lot 3b verrou OTP | #83 (B), #88 (F) | 0 | 2 | 0,5 | **2,5** | O, Q | 0,35 ¹ |
| Lot 4 critères contenu / année | #92 (B, relue OK), #95 (F, dépend de #92), e2e SC-V11-04 (Q, à pousser) | 0,75 (F ajustements après fusion de #92 0,5 ; Q push 0,25) | 3 | 1 | **4,75** | F, Q, O | 0,35 |
| Lot 5 surveillance de dossier | aucune (B en lecture, après D3) | 2 (B 1 ; F encart 0,5 ; Q spec 0,5) ² | 3 | 1 | **6** | B, F, Q, O | 0,35 ² |
| D3 journal : connexion, dépôt, import | à ouvrir (B, tests en cours) ; F libellés ; Q lève le fixme `audit-trail` | 1,25 (B 0,5 ; F 0,5 ; Q 0,25) | 2 | 0,5 | **3,75** | B, F, Q, O | — |
| Aide V1.1 (HelpHint, 5 écrans) | F, une PR après fusion de #81, #84, #87, #88, #95 | 1 | 1 | 0,25 | **2,25** | F, O | — |
| Responsive | #93 (F), #89 (Q) | 0 | 2 | 0,25 | **2,25** | O, Q | — |
| Version 1.0.0-rc.1 (D6) | #94 (F) | 0 | 1 | 0 | **1** | O | — |
| Reconnexion, page quittée | #97 (F) ; Q lève le fixme E1 | 0,25 | 1 | 0,25 | **1,5** | Q, O | — |
| Docs | #90, #96 ouvertes ; PR docs du 19 (CHANGELOG, notes rc.1, relevé) | 1 (I, le 19 soir) | 3 | 0 | **4** | I, O | — |
| **Total avant le 19 18:00** | 15 PR ouvertes + 4 à ouvrir | **≈ 6,25** | **≈ 23** | **≈ 5,75** | **≈ 35 h-s** | | 2,25 j |

¹ fiche lot 3 : pas de ligne « Budget » ; 0,35 j = moitié des 0,8 j des lots 1–3 moins les lots 1–2 (`Déduit`). ² fiche lot 5 : pas de ligne « Budget » ; chiffré comme le lot 4 (worker + encart + spec), `Déduit`.

Répartition par rôle du reste (code + sa part de recette ; la chaîne est portée par O) : **B ≈ 1,5 h-s** (D3 0,5, lot 5 1) ; **F ≈ 2,5 h-s** (lot 4 UI 0,5, D3 0,5, lot 5 0,5, aide 1) ; **Q ≈ 7 h-s** (pushes et fixmes 1,25, recette des lots 5,75) ; **O ≈ 23 h-s de chaîne**, soit 6 à 12 h-s réelles de relecture si 2 à 4 PR avancent en parallèle (observé le 10/11 : 24 fusions en 4,5 h) ; **I ≈ 1 h-s** (PR docs du 19) + relectures (lot 5, D3, aide : ≈ 1,5 h-s).

## 3. Recette protégée 20 → 23/11 (`Déduit`, `recette/plan-recette-20-23-11.md` § 1)

| Poste | h-s | Qui |
|---|---|---|
| Pile neuve + reset D1 + restauration n° 2 (poste de secours) | 1,5 | Q, jeu 20 matin |
| Run 1 smoke + uat, mesures C2/C3, compteurs | 1,5 | Q, jeu 20 |
| Recette manuelle P1–P8 + lots fusionnés, croisée | 2 + 2 | F, B, jeu 20 |
| Run 2 + rejeu reset + checklist H-30 complète | 2 | Q, ven 21 |
| Heure PO + report des verdicts | 1,5 | O (+ PO 1 h), ven 21 |
| Correctifs `REC-nn` (tampon, bloquants seulement) | 2 + 2 | B, F, ven 21 – sam 22 |
| Run 3 (si correctif), relevé GO/NO-GO, CHANGELOG « Limites connues » | 1,5 | Q, I, sam 22 – dim 23 |
| **Total** | **≈ 16 h-s** (Q 6,5 ; B 4 ; F 4 ; O 1,5 ; I 0,5) | |

## 4. Marge avant le 19/11 18:00 (`Proposé`)

- **Capacité** : 7 jours ouvrés (mar 10 après-midi → mer 19) × ≈ 4 h-s par rôle et par demi-journée observée ≥ **50 h-s par rôle** ; le reste à faire § 2 tient en **1 à 2 jours de sessions** (B/F/Q ≤ 7 h-s chacun, O 6–12 h-s de chaîne). Marge en temps de session : **≥ 40 h-s par rôle**, soit ≈ 5 jours ouvrés. Le budget n'est plus la contrainte.
- **Contrainte réelle** : la **chaîne** (23 PR à faire passer par une seule file de relecture O et une pile Docker à la fois) et les **dépendances en série** : #79 → #84/#91 → lot 2 ; #92 → #95 → SC-V11-04 → aide V1.1 (après 5 fusions) ; D3 → lot 5. Au rythme observé (15–20 fusions par jour calme), la file se vide **mer 11 ou jeu 12** ; le lot 5 et l'aide V1.1, derniers de la chaîne, se fusionnent **au plus tard ven 13** si D3 est ouverte ce soir.
- **Seuil D2** (décision PO en attente, rien d'acquis) : un glissement se mesure désormais sur une ligne § 2 ; une ligne qui dépasse son total de **2 h-s** le 13 au soir est signalée. Aucune ligne n'est à ce niveau aujourd'hui.
- **Ce qui reste exposé** : lot 5 (seule ligne sans PR, 6 h-s, dépend de D3) et l'aide V1.1 (dernière de la chaîne). Si l'un des deux n'est pas fusionné le 19 à 18:00, il bascule en V1.1 avec sa phrase du relevé de coupure ; aucun autre poste n'est à risque de calendrier.

Sources : `gh pr list --state all --search "created:>=2026-11-10T08:00:00Z"` (10/11 12:30) ; `PASSATION-dev-backend.md` 12:08 et 12:25, `PASSATION-dev-frontend.md` 12:15 → 12:31, `PASSATION-ci-qa.md` 10:50 → 12:30 ; `plans/conversion-heures-session.md` § 1–3 ; `plans/point-2026-11-14.md` § 4 (lignes héritées) ; fiches `innovateur/specs-v11-avant-gel/lot-*.md` ; `recette/plan-recette-20-23-11.md` § 1 ; `plans/releve-coupure-19-11.md`.
