# Tableau de statuts final des 32 items — à rejouer le 19/11 à 18:00

- **Pour** : O (remplit à 18:00), Q (preuves), I (reporte). Innovateur, 2026-11-17. Statut de départ = `main` b64144f ; relevé détaillé et scénarios : `releve-preliminaire-taux-cdc-19-11.md`.
- **Règle** : on ne change un statut que sur preuve (PR fusionnée, fichier `recette/…`, sortie de script) citée dans la dernière colonne. Barème : (fait + 0,5 × partiel) / 32. Seuls les items 27, 29 et 31 peuvent bouger ; toute autre variation est une régression ou une erreur à expliquer.
- **Remplissage** : colonnes « Statut 19/11 18:00 » et « Preuve du jour » ; SHA de coupure : `…`.

| # | Item | Départ b64144f | Statut 19/11 18:00 | Preuve du jour |
|---|---|---|---|---|
| 1 | Tri auto par règles (type, nom, date, contenu) | fait | | |
| 2 | ≥ 95 % de documents classés | fait | | |
| 3 | Priorité des règles + simulation | fait | | |
| 4 | Arborescence service > domaine > activité > année | fait | | |
| 5 | Espaces : filtres + pagination serveur | fait | | |
| 6 | Upload manuel | fait | | |
| 7 | Surveillance automatique d'un dossier | fait | | |
| 8 | 100 000 fichiers en < 20 min | absent | | |
| 9 | Authentification + rôles | fait | | |
| 10 | Droits stricts par rôle et par service | fait | | |
| 11 | Journal des actions | fait | | |
| 12 | Tags | fait | | |
| 13 | Recherche avancée | fait | | |
| 14 | Recherche < 2 s | fait | | |
| 15 | OCR | fait | | |
| 16 | Multi-lecture + verrouillage d'édition | fait | | |
| 17 | Versionnage | fait | | |
| 18 | Corbeille applicative | fait | | |
| 19 | Détection des doublons | partiel | | |
| 20 | Tableau de bord (doublons, non classés, activité) | fait | | |
| 21 | Export / import des règles | fait | | |
| 22 | Workflows de validation / visa | fait | | |
| 23 | Rapports (manager) | fait | | |
| 24 | Interface responsive | fait | | |
| 25 | Interface en français | fait | | |
| 26 | Limite de taille des fichiers | fait | | |
| 27 | HTTPS | partiel | | |
| 28 | Déploiement on-site + démo VPS | absent | | |
| 29 | Disponibilité ≥ 99 % | absent | | |
| 30 | Sauvegardes + restauration testée | fait | | |
| 31 | Docs utilisateur / admin / technique | partiel | | |
| 32 | Front connecté à l'API | fait | | |

## Totaux à 18:00

| Fait | Partiel | Absent | Points | Taux |
|---|---|---|---|---|
| `…` | `…` | `…` | `…` | `…` / 32 = `…` % |

Attendus : 26 / 3 / 3 = 27,5 (85,9 %) ; 87,5 % si l'item 29 passe `partiel` (6 relevés verts consécutifs, voir § 3 du relevé préliminaire). Les items 27 et 31 restent `partiel` à 18:00 : leurs preuves sont aux passages 2 et 1, après la coupure.
