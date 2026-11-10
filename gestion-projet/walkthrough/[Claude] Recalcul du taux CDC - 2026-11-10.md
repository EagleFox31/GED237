# Recalcul du taux de couverture CDC — 2026-11-10 (préparation du point du 11/11 soir)

- **Pour** : O (point du 11/11 soir), PO. Innovateur, 2026-11-10 11:30, sur `main` d34d51b. Reprend la table des 32 items de `[Audit] Audit fonctionnel profond - 2026-11-09.md` § 1 ; seuls les items dont le statut change sont détaillés, les autres gardent le statut du 9/11.
- **Pondération** (`Proposé`, l'audit du 9/11 ne fixait pas de taux) : 32 items à poids égal ; `fait` = 1, `partiel` = 0,5, `absent` et `non vérifiable` = 0. Un item passe à `fait` seulement sur une preuve fusionnée sur `main` ou citée par sa PR.
- **Trois colonnes** : 9/11 (audit), `main` d34d51b (fusionné), « PR ouvertes citées » (projection si #77/#81, #79/#84, #80, #83, #82, #78 fusionnent avant le 19/11 18:00). Niveaux : `Vérifié` = lu dans le dépôt ou `gh` ; `Déduit` = calcul.

## 1. Taux

| Mesure | 9/11 | `main` d34d51b | PR ouvertes citées | Si lots 4 et 5 fusionnent aussi |
|---|---|---|---|---|
| `fait` | 14 | 18 | 23 | 25 |
| `partiel` | 9 | 6 | 4 | 2 |
| `absent` / `non vérifiable` | 9 | 8 | 5 | 5 |
| **Taux pondéré** (`Déduit`) | **57,8 %** (18,5/32) | **65,6 %** (21/32) | **78,1 %** (25/32) | **81,3 %** (26/32) |

## 2. Changements de statut depuis le 9/11

| # | Item | 9/11 | `main` d34d51b | PR ouvertes | Preuve du changement (`Vérifié`) |
|---|---|---|---|---|---|
| 2 | ≥ 95 % de documents classés | non vérifiable | non vérifiable | **fait** | #64 (scripts `measure_c2.py`, `measure_counters.py`) fusionné ; #82 apporte `gestion-projet/recette/c2-2026-11-10.txt` : **C2 = 357/357 = 100 %** sur les fichiers couverts par une règle, **87,5 % brut** hors doublons (357/408), seuil 95 % : GO |
| 5 | Espaces : filtres + pagination serveur | partiel | partiel | **fait** | API : #38 (`spaces.py:43-45`, `domain_id, activity_id, year, status, classification_status, q`, `limit/offset`, `X-Total-Count`) ; écran : #78 `feat/spaces-filters` ouverte |
| 10 | Droits stricts par rôle et par service | partiel | **fait** | fait | #42 recherche bornée au tenant et au périmètre de lecture (`search.py:48-53`), #46 garde des routes admin, #47 politique collaborateur |
| 13 | Recherche avancée | partiel | **fait** | fait | #42 : corbeille exclue des résultats |
| 14 | Recherche < 2 s | non vérifiable | non vérifiable | **fait** | #82 `gestion-projet/recette/c3-2026-11-10.txt` : `took_ms` **p50 16 ms, p95 27 ms, max 52 ms**, 30 mesures, seuil 2 000 ms : GO |
| 20 | Tableau de bord (doublons) | partiel | partiel | **fait** | lot 1 : #77 (`duplicates` dans `GET /analytics/tenant`, CI avec un échec à corriger) + #81 (tuile « Doublons refusés », CI verte) |
| 21 | Export / import des règles | absent | absent | **fait** | lot 2 : #79 (API, CI verte) + #84 (écran, CI verte) |
| 26 | Limite de taille des fichiers | partiel | **fait** | fait | #52 : `MAX_UPLOAD_SIZE` appliqué sur tous les chemins de dépôt (`documents.py:68-75`), 413 |
| 30 | Sauvegardes + restauration testée | absent | **fait** | fait | #54 `ops/backup.sh` + `ops/restore.sh`, #61 recette n° 1, #62 attente santé ; `gestion-projet/recette/restauration-2026-11-10.txt` ; `DOCS/exploitation/sauvegarde-restauration.md` |

Items **sans changement de statut malgré des livraisons** (restent au statut du 9/11) :

| # | Item | Statut | Pourquoi |
|---|---|---|---|
| 1 | Tri par règles (date, contenu) | partiel | lot 4 non commencé ; #76 (année dans les noms avec `_`) corrige sans ajouter le critère |
| 7 | Surveillance d'un dossier | partiel | #53 (racines autorisées) sécurise l'import manuel ; lot 5 non commencé |
| 9 | Authentification + rôles | fait | #44 (limites auth configurables), #83 (verrou OTP, lot 3b) renforcent sans changer le statut |
| 11 | Journal | fait | #80 (export CSV, lot 3a) ajoute une sortie, statut déjà `fait` |
| 19 | Détection des doublons | partiel | le KPI (lot 1) compte, mais la vue « doublons » reste absente |
| 24 | Interface responsive | non vérifiable | exécution Playwright mobile **en cours chez ci-qa** (10/11) ; passe à `fait` sur rapport vert joint |
| 29 | Disponibilité ≥ 99 % | absent | #58 version dans `/health` ; toujours aucune sonde ni mesure |
| 31 | Docs utilisateur / admin / technique | partiel | `DOCS/exploitation/` (sauvegarde-restauration, données de démo, déverrouillage avec #83) ; manuel d'installation toujours absent |
| 27, 28 | HTTPS, déploiement VPS | absent / non vérifiable | aucun fichier `deployment/` ni bloc Caddy dans le dépôt au 10/11 |

## 3. Lecture pour le point du 11/11

- Le passage de 57,8 % à 65,6 % est **acquis** (fusionné). Le passage à 78,1 % dépend de six PR ouvertes dont cinq sont déjà vertes ; seule #77 a un échec de CI à corriger.
- Les deux chiffres CDC mesurés (C2, C3) sont la réponse attendue du jury (écart 6 du top 10 du 9/11) ; le troisième (100 000 fichiers < 20 min, item 8) reste **non mesuré** et annoncé tel quel.
- Un item `fait` ici ne vaut pas « recetté » : la recette du 20 au 23/11 (matrice) reste le juge ; ce taux mesure le **périmètre présent sur `main`**, pas sa qualité.

Sources : `gh pr list --state merged` (fusions depuis le 09/11 : #33–#74), `gh pr view` #76–#84 (10/11 11:10), `backend/app/api/v1/endpoints/{spaces,search,documents}.py`, `ops/`, `DOCS/exploitation/`, contenu de #82 (`c2-2026-11-10.txt`, `c3-2026-11-10.txt`), `[Audit] Audit fonctionnel profond - 2026-11-09.md` § 1.
