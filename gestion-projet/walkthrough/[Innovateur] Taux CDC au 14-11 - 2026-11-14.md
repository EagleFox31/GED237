# [Innovateur] Taux CDC au 14-11 - 2026-11-14

Rôle : innovateur. Base : `main` 3cc6e15 (`Vérifié`, `gh pr list --state merged`, 14/11 12:35). Barème inchangé : taux = (fait + 0,5 × partiel) / 32 (`[Innovateur] Taux CDC soir du 10-11 - 2026-11-10.md`).

## 1. Taux acquis sur `main` 3cc6e15 (`Déduit`)

| Mesure | `main` d82a4f1 (10/11) | **`main` 3cc6e15 (14/11)** | Cause |
|---|---|---|---|
| `fait` | 22 | **24** | #89 : item 24 (responsive, rapport vert) ; #79 + #84 : item 21 (export / import des règles) |
| `partiel` | 4 | **4** | items 1, 7, 19, 31 |
| `absent` / `non vérifiable` | 6 | **4** | items 8, 27, 28, 29 |
| **Taux pondéré** | 75,0 % (24/32) | **81,3 % (26/32)** | + 2 points d'item |

Sans effet sur le taux : #80, #87 (item 11 déjà fait), #98 (journal, item 11), #94 (version, aucun item), #97, #91, #90, #96, #103, #105 (voir § 2), #101 (voir § 2).

## 2. Ce qui reste atteignable d'ici le 19 18:00

| Item | Gain | Condition | État au 14/11 | h-s restantes | Qui |
|---|---|---|---|---|---|
| 1 Tri par règles (contenu, date) | partiel → fait **+ 0,5** | #92 puis #95 fusionnées | #92 rouge (test des règles, B) ; #95 en brouillon, **base `feat/rule-content-date` et non `main`** : à rebasculer par `gh pr edit 95 --base main` avant la fusion de #92 (LESSON-029) | B : correctif ; F : fin de #95 | B, F |
| 7 Surveillance d'un dossier | partiel → fait **+ 0,5** | #101 (fusionnée) + #100 (écran de statut) ; preuve réelle au plan de recette du 20 | #101 sur `main` ; #100 brouillon | F : fin de #100 | F |
| 31 Docs | partiel → fait **+ 0,5** | manuel #105 (fusionné) + rejeu de Q sur pile vierge sans écart ; corrections #107 | rejeu statique de Q : 1 écart de fond (cohabitation de deux piles), corrigé dans #107 ; rejeu réel en attente de mémoire | Q : 0,5 | Q |
| 29 Disponibilité | absent → partiel **+ 0,5** (fait + 1 le 21) | `probe_c6.sh` versionné et ≥ 6 relevés verts du 17 matin au 19 soir | rien au dépôt | 0,5 | Q |
| 27 HTTPS | absent → fait **+ 1** (partiel + 0,5 si D6 = HTTP) | profil `tls` livré par B après l'item 26 ; décision D6 le 13 | non commencé | 1 | B |
| 19 Doublons (vue) | — | aucune PR ouverte | partiel | — | — |
| 8 (100 000 fichiers < 20 min), 28 (VPS) | 0 | non mesuré / VPS écarté par le PO | — | — | — |

| Scénario le 19 18:00 | Items | Taux |
|---|---|---|
| Acquis (aucune autre fusion) | 26 | **81,3 %** |
| Probable : + items 1, 7, 31 | 27,5 | **85,9 %** |
| + item 29 partiel (relevés de Q) | 28 | 87,5 % |
| + item 27 fait avec D6 = HTTPS | 29 | 90,6 % |

Changement par rapport à la fiche `items-cdc-27-29-30.md` : celle-ci partait de 26 items et ne comptait que 27, 29 et 31 ; les items 1 et 7 s'y ajoutent (#92 + #95 et #100). Le plafond du 19 passe de 87,5 % à 90,6 %.

## 3. Réserves

- Un item `fait` ici vaut « présent sur `main` avec preuve jointe », pas « recetté » : la recette du 20 au 23 reste le juge.
- Item 7 : le comportement est livré par #101 seule ; je ne le compte `fait` qu'avec l'écran de statut (#100) pour garder la même règle que l'item 5 (API + écran), et la preuve contre un vrai Redis n'existe qu'au plan de recette du 20.
- Définitif : à rejouer sur le SHA de fin de file d'O le 19 au soir, par ce même barème.
