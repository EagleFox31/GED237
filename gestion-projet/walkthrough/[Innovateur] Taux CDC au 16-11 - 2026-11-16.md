# [Innovateur] Taux CDC au 16-11 - 2026-11-16

Rôle : innovateur. Base : `main` ca9953b (`Vérifié`, `gh pr list --state merged`, 16/11 19:44). Barème inchangé : (fait + 0,5 × partiel) / 32. Suite de `[Innovateur] Taux CDC au 14-11 - 2026-11-14.md`.

## 1. Taux acquis sur `main` ca9953b (`Déduit`)

| Mesure | `main` 3cc6e15 (14/11) | **`main` ca9953b (16/11)** | Cause |
|---|---|---|---|
| `fait` | 24 | **25** | #92 aa1ff60 + #95 fa26e17 : item 1 (critères contenu OCR et année, API et écran) |
| `partiel` | 4 | **3** | items 7, 19, 31 |
| `absent` / `non vérifiable` | 4 | **4** | items 8, 27, 28, 29 |
| **Taux pondéré** | 81,3 % (26/32) | **82,8 % (26,5/32)** | + 0,5 |

Sans effet sur le taux : #83 64ade05 et #88 6669f2c (verrou OTP, item d'authentification déjà `fait`), #102 3e2dca4 (e2e), #106 ca9953b (sonde C6 : le script existe, pas encore de relevé, donc item 29 reste `absent`).

## 2. Plafond au 19/11 18:00

| Item | Gain | Condition restante | État au 16/11 19:44 |
|---|---|---|---|
| 7 Surveillance de dossier | partiel → fait **+ 0,5** | #100 (écran de statut) fusionnée | #100 brouillon, en retard sur `main` |
| 31 Docs | partiel → fait **+ 0,5** | rejeu réel de Q sans écart, #107 fusionnée | #107 ouverte ; rejeu bloqué par la mémoire (≥ 5 Go libres requis) |
| 29 Disponibilité | absent → partiel **+ 0,5** | ≥ 6 relevés verts du 17 matin au 19 soir | #106 fusionnée ; les relevés commencent demain : 6 relevés exigent matin et soir du 17, du 18 et du 19 |
| 27 HTTPS | absent → fait **+ 1** | #109 fusionnée **et** `prove_tls.sh` vert sur le poste de démo ; D6 tranchée par le PO le 16/11 : démo en HTTPS ; repli HTTP = partiel (+ 0,5) | #109 en conflit (DIRTY), à rebaser par B |

| Scénario le 19 18:00 | Items | Taux |
|---|---|---|
| Acquis | 26,5 | **82,8 %** |
| + items 7 et 31 | 27,5 | 85,9 % |
| + item 29 partiel | 28 | **87,5 %** (probable) |
| + item 27 fait (D6 = HTTPS, tranchée) | 29 | **90,6 %** (plafond) |

Le plafond du 14/11 (90,6 %) tient, mais il ne reste plus aucune marge sur les items 7, 27 et 29 : chacun dépend d'une seule PR ou d'un seul relevé non encore commencé. L'item 29 n'a aucune tolérance : un relevé raté le 17 ou le 18 le fait tomber sous 6 relevés avant le 19 18:00.

## 3. Risques

- **Rejeu des 8 parcours en HTTPS le 20/11** : condition de D6 ; s'il échoue, repli sur la démo en HTTP sans changer la pile et item 27 `partiel`.
- Rejeu de Q : conditionné à 5 Go de RAM libres (1,7 Go annoncé le 14, 2,6 Go constatés le 14 sur 31,7 Go) ; sans libération de mémoire, l'item 31 reste `partiel` au 19.
- #109 : conflit à résoudre avant toute fusion ; l'item 27 est le seul gain de + 1.
- Un item `fait` vaut « présent sur `main` avec preuve jointe » ; la recette du 20 au 23 reste le juge. Définitif à rejouer sur le SHA de fin de file d'O le 19 au soir.
