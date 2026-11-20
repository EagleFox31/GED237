# Compte rendu du 20/11 à 12:00 — gabarit

- **Pour** : O (le remplit et l'envoie au PO), Q, F, B (fournissent statuts et preuves). Innovateur, 2026-11-17.
- **Mode d'emploi** : remplacer chaque `…` ; ne rien laisser vide (écrire « non joué » et la raison). Ordre et critères d'arrêt des passages : `registre-risques-demo-2026-11-17.md` § 3. Une preuve est un fichier daté sous `gestion-projet/recette/` ou un numéro de run ; une anomalie porte un identifiant `REC-nn`.

## 1. En trois lignes

- SHA de coupure : `…` · pile construite le `…` à `…` · mémoire libre au départ : `…` Go.
- Passages réussis : `…` sur 5 · anomalies bloquantes : `…` · démonstration du 30 en : HTTPS / HTTP (repli).
- Taux CDC constaté : `…` % (`…` / 32).

## 2. Passages

Statut : `réussi`, `échec`, `partiel`, `reporté au …`, `non joué`.

| # | Passage | Prévu | Début – fin réels | Statut | Preuve | Anomalies (REC) | Suite |
|---|---|---|---|---|---|---|---|
| 0 | Arrêt de la sonde C6, synthèse par demi-journée | 19/11 18:00 | … | … | … | … | … |
| 1 | Rejeu du manuel d'installation (clone et build neufs) | 19/11 18:15 | … | … | … | … | … |
| 2 | `mkcert -install`, `prove_tls.sh`, contrôles 307 et WebSocket | 19/11 19:30 (PO présent) | … | … | … | … | … |
| 3 | Restauration n° 2 (`backup.sh`, `restore.sh --wipe`, comptages, puis `e2e_reset.sh demo`) | sam 21/11 09:00–10:00, repli le 22 | … | … | `recette/restauration-2026-11-21.txt` | … | … |
| 4 | Run uat officiel (run 1, pile e2e isolée) : `…` réussis, `…` ignorés, `…` en échec | 20/11 08:30 | … | … | … | … | … |
| 5 | Les 8 parcours en HTTPS | 20/11 09:45 | … | … | … | … | … |

Détail du passage 5 :

| Parcours | Joué par | Durée | Résultat attendu obtenu (oui / non) | F5 garde la session | REC |
|---|---|---|---|---|---|
| P1 connexion OTP | … | … | … | … | … |
| P2 import et classement | … | … | … | — | … |
| P3 simulation de règle | … | … | … | — | … |
| P6 revue manuelle | … | … | … | — | … |
| P4 espaces | … | … | … | — | … |
| P5 recherche et cloisonnement | … | … | … | — | … |
| P8 cycle de validation | … | … | … | — | … |
| P7 journal d'audit | … | … | … | — | … |

Durée totale des 8 parcours : `…` min (cible : 13 ± 1 min de direct).

## 3. Anomalies

| REC | Parcours ou passage | Gravité (bloquant / majeur / mineur) | Constaté | Propriétaire | Correctif attendu le |
|---|---|---|---|---|---|
| … | … | … | … | … | … |

## 4. Taux CDC recalculé

Formule : (fait + 0,5 × partiel) / 32. Base au 17/11 sur `main` 371c0a0 : 26 fait, 3 partiel (19, 27, 31), 3 absent (8, 28, 29) = 27,5 points, 85,9 %.

| Item | Condition | Preuve | État au 20/11 à 12:00 | Points gagnés |
|---|---|---|---|---|
| 29 | ≥ 6 relevés verts de la sonde, du 17 matin au 19 soir | synthèse du passage 0 | `absent` / `partiel` | 0 / 0,5 |
| 27 | `prove_tls.sh` vert sur le poste de démonstration | sortie du passage 2 | `partiel` / `fait` | 0 / 0,5 |
| 31 | rejeu réel du manuel d'installation | relevé du passage 1 | `partiel` / `fait` | 0 / 0,5 |
| autres | fusions entre le 17/11 et la coupure qui changent un item | relevé de coupure | … | … |

Total : `…` fait, `…` partiel, `…` absent = `…` points, **`…` %** (plafond attendu : 29 points, 90,6 %).

## 5. Décisions à demander au PO

| # | Question | Options | Recommandation de l'équipe | Réponse attendue le |
|---|---|---|---|---|
| 1 | Démonstration du 30 en HTTPS ou en HTTP ? (à poser seulement si le passage 2 ou 5 a échoué) | HTTPS / repli HTTP, item 27 `partiel` | … | … |
| 2 | Anomalies bloquantes : correction avant le tag du 24, ou limite connue annoncée ? | par REC | … | 21/11, heure PO |
| 3 | Poste de secours pour le 30 : y en a-t-il un ? | oui (restauration et certificat à y rejouer) / non | … | … |
| 4 | Décisions du 13/11 encore ouvertes : D2, D3, D4, D5, S1 | voir `decisions-po-2026-11-13.md` | … | 23/11 |
| 5 | Réflexes Windows : L3 et L4 en V1.1, confirmé ? | oui / autre priorité | … | … |
| … | … | … | … | … |

## 6. Suite

- Passages reportés et nouvelle date : `…`
- Run 2 du 21/11 : périmètre `…`
- Risques du registre qui changent d'état (R1 à R13) : `…`
