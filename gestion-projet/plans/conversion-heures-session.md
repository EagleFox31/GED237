# Conversion des chiffrages hérités (j-p) en heures de session — proposition

- **Pour** : O (budget § 4 du point S1, ven 13), le PO (règle du 10/11 : tout chiffrage en temps de session). Innovateur, 2026-11-10, non commité. `Vérifié` = horodatages `gh pr list` (création → fusion) et entrées `PASSATION-dev-backend.md` ; `Déduit` = ratio calculé ; `Proposé` = règle à adopter.
- **Unité** : **h-s** = heure de session (une session, un sujet, horloge murale). La colonne j-p des fiches DEC-002 / audit reste une trace, jamais une mesure.

## 1. Mesures (`Vérifié`, 09–10/11)

| PR | Chiffrage hérité | Taille | Création → fusion | Lecture |
|---|---|---|---|---|
| #51 validateurs P8 (B) | 0,25 j-p | +251 | 21:24 → 23:09 = **1 h 45** | une route + tests, 2 runs CI |
| #52 plafond 413 (B) | 0,25 j-p | +416/−20 | 21:54 → 23:17 = **1 h 25** | |
| #53 racines d'import (B) | 0,25 j-p | +379/−12 | 21:54 → 06:54 (**≈ 1 h de code**, le reste = attente de fusion de #50 et nuit) | goulot = chaîne, pas l'effort |
| #54 sauvegarde + restauration (B) | 1,5 j-p (DEC-002) ramené à 0,25 | +450 | 22:13 → 23:31 = **1 h 20** | scripts + doc |
| #66 cycle de validation UI (F) | 0,45 j-p | +231/−53 | ouverte 08:34, fusionnée 08:45 ; code ≈ **2–3 h** la veille/matin | relecture courte |
| #59 bascule seed e2e (Q) | 0,25 j-p | +9/−8 | 07:00 → 07:07 = **7 min** | le chiffrage hérité valait 20× le réel |
| lots 1, 2, 3a, 3b (B) | 0,8 j « de session » (fiches du 10/11) | +153, +832, +482, +286 | fiches ≈ 09:00 → PR ouvertes 10:02–10:24 = **≈ 1 h 30 pour les quatre** | mes propres fiches surestimaient encore ×4 |
| #92 lot 4 (B) | 0,35 j (fiche) | +471/−6 | 10:24 → 12:08 = **≈ 1 h 45** (migration, moteur, worker, 7 tests) | |
| #48 UAT P1–P8 (F) | 1 j-p | +1070/−1708 | 19:08 (09/11) → 10:18 (10/11) | 15 h dont ≈ 12 h d'attente de rebase sur #47/#51 |

Rythme global (`Vérifié`, mémoire de session) : ≈ 20 PR fusionnées entre le 09/11 17:30 et le 10/11 10:30 ; périmètre backend DEC-002 (chiffré ≈ 3 j-p à l'audit) soldé dans la nuit du 09 au 10.

## 2. Ratios (`Déduit`)

| Grandeur | Valeur observée | Commentaire |
|---|---|---|
| Code + tests d'une PR, par j-p hérité | **1 h-s à 2 h-s** (#51 : 7 h/j-p bout en bout, mais ≈ 1 h de code ; #54 : 1,3 h pour 0,25 ; lots 1–3 : 1,5 h pour 0,8) | médiane ≈ 1,5 h-s par j-p |
| Bout en bout (ouverture → fusion) quand la chaîne est fluide | **+ 0,5 h-s à 1 h-s par PR** | 2 runs CI × 13 min + relecture O 10–20 min |
| Bout en bout quand la PR attend une autre PR | **+ 2 h-s à 12 h-s** (#53, #48) | c'est la chaîne de fusion qui coûte, pas l'effort |
| Recette Q d'un lot | 0,5 h-s à 1 h-s par lot (reset + run ciblé + rapport) | une pile Docker à la fois : sérialisation entre sessions |

## 3. Règle proposée (`Proposé`)

1. **Convertir** : `h-s = j-p hérité × 1,5` pour le code et les tests ; **+ 1 h-s par PR** pour CI et relecture ; **+ 1 h-s par lot** pour la recette Q. Exemple : lot 4 (0,35 « j » fiche) → 0,5 h-s + 1 h + 1 h ≈ **2,5 h-s** bout en bout, mesuré 1 h 45 de code + chaîne 37.
2. **Budgéter le calendrier, pas l'effort** : la contrainte réelle est la coupure du mer 19/11 18:00 et les goulots (CI ≈ 13 min par run, une charge Docker à la fois, file de relecture O, recette 20–23). Le budget § 4 s'exprime donc en **h-s restantes par session jusqu'au 19 à 18:00** et en **nombre de PR que la chaîne peut absorber par jour** (observé : 15–20 fusions par jour calme, 5–8 quand Docker et la relecture saturent).
3. **Seuil D2** (`Proposé`, décision du PO en attente, présentée par O avec la fiche ; rien d'acquis) : « glissement ≥ 0,25 j » deviendrait « **glissement ≥ 2 h-s sur une ligne S1** » (0,25 j × 1,5 + 1 h de chaîne ≈ 1,4 h ; arrondi à 2 h pour ne déclencher que sur un vrai écart). Même règle pour le tri des anomalies du plan de recette (« corriger si ≤ 0,25 j de session » ≡ **≤ 2 h-s**).
4. **Présentation au PO** : une ligne = sujet, h-s estimées (code / chaîne / recette), h-s consommées, reste ; la colonne j-p héritée en dernier, grisée, pour la traçabilité DEC-002. Marge « 0,05 j-p » : à ne plus écrire, elle ne mesure rien ; dire « X h-s de session B/F/Q libres avant le 19 ».

## 4. Budget § 4 converti (brouillon pour O, `Déduit`)

| Poste (point-2026-11-14 § 4) | Hérité | Converti (code / chaîne / recette) | Consommé (`Vérifié`) | Reste |
|---|---|---|---|---|
| P8 cycle de validation (B #51, F #66, e2e #69) | 0,7 j-p | 1 h / 3 h / 1 h = 5 h-s | #51 1 h 45, #66 ≈ 3 h, #69 8 min, tous fusionnés | 0 |
| Racines d'import (#53) | 0,25 j-p | 0,5 h / 1 h / 0,5 h = 2 h-s | ≈ 1 h de code, fusionnée | 0 |
| Migration rôles + seed (#50, #55, #59, #60) | 0,5 j-p | 1 h / 4 h / 1 h = 6 h-s | nuit du 09 au 10, fusionnées | 0 |
| Sauvegarde / restauration (#54, #61, #62) | 0,5 j-p | 0,5 h / 2 h / 1 h = 3,5 h-s | #54 1 h 20 ; restauration n° 1 prouvée le 10/11 | restauration n° 2 : 1 h-s Q le 20 |
| Lots 1–5 (fiches du 10/11) | 1,55 j (fiches) | 2,5 h / 5 h / 5 h = 12,5 h-s B+F+Q | lots 1–4 B ouverts (≈ 3 h 15) ; F lots 1–3 ouverts ; Q specs en brouillon | lot 5 B, PR F lot 4, recette des 5 lots |
| D3 audit (connexion, dépôt, import) | — | 1 h / 1 h / 0,5 h = 2,5 h-s | à venir (B après lot 4) | 2,5 h-s |

Sources : `gh pr list --state all` (création, fusion, lignes), `PASSATION-dev-backend.md` entrées du 09/11 22:55 au 10/11 12:08, `gestion-projet/plans/point-2026-11-14.md` § 4, fiches `innovateur/specs-v11-avant-gel/lot-*.md` (ligne « Budget »), mémoire de session (règle PO du 10/11).
