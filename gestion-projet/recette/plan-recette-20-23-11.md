# Plan de la recette protégée — jeu 20 → dim 23/11, avant le tag v1.0.0-rc.1 du lun 24

- **Pour** : O (anime, relit les correctifs), Q (rejeu et mesures), F et B (correctifs seulement), le PO (une heure, § 4). Innovateur, 2026-11-10, sur `main` 14521ce. Sources : `innovateur/matrice-recette.md` (22 scénarios, 8 parcours), `frontend/e2e/specs/uat/*.spec.ts` (SC-AUTH, SC-ADM-05/07/08/09, SC-AUD, SC-ESP-01, SC-VAL-01..04, `v11-lots`), `innovateur/deroule-demo.md`, `innovateur/checklist-demo.md` § C (H-30), `recette/mesures-outillage.md`, DEC-2026-002 (calendrier 19–24).
- **Règle de la fenêtre** : depuis la coupure du mer 19/11 18:00, **aucune nouvelle fonctionnalité** ; seules passent des PR de correctif (§ 3). Tout ce qui n'est pas fusionné le 19 à 18:00 est V1.1 et se dit en phrase d'écart. Sam 22 et dim 23 restent un tampon : rien n'y est planifié, ils absorbent les correctifs bloquants.

## 1. Calendrier jour par jour

| Jour | Q | F | B | PO | Preuve attendue le soir |
|---|---|---|---|---|---|
| **Jeu 20** | matin : pile Docker neuve depuis `main`, `e2e_reset.sh demo`, **restauration n° 2** sur le poste de secours (`restore.sh --wipe`, `recette/restauration-2026-11-20.txt`) ; après-midi : run 1 **smoke + uat** complet (8 parcours), mesures **C2/C3** rejouées (`measure_c2.py`, `measure_c3.py`), compteurs D1 (`measure_counters.py`) | recette manuelle **P1, P2, P3, P6** sur le jeu D1 (clics du `deroule-demo.md` § 1 et § 1 bis) ; anomalies tracées | recette manuelle **P4, P5, P7, P8** + les lots fusionnés (tuile, export/import, CSV, verrou sur `UNIT001`, dossier surveillé : un fichier déposé dans un dossier de `INGEST_WATCH_FOLDERS` est importé au passage suivant et déplacé dans `_traites/`, le verrou `ingest_watch:lock` apparaît libéré dans les logs du worker — seul test contre un vrai Redis) | — | rapport Playwright run 1 archivé ; `c2-2026-11-20.txt`, `c3-2026-11-20.txt` ; liste d'anomalies classée (§ 3) |
| **Ven 21** | matin : rejeu des parcours touchés par les correctifs de la veille ; **run 2 smoke + uat** ; rejeu reset D1 (mêmes compteurs que run 1) ; après-midi : **checklist H-30** jouée une fois en entier (§ C) | correctifs bloquants frontend (§ 3), puis recette croisée : F rejoue les parcours de B | correctifs bloquants backend, puis recette croisée : B rejoue les parcours de F | **heure PO** (§ 4) : créneau proposé 16:00–17:00 après le run 2, **à confirmer par le PO** | run 2 vert ou liste des rouges ; verdict GO/NO-GO par parcours dans `matrice-recette.md` (colonne État, par I) ; décisions PO sur les majeurs |
| **Sam 22** | tampon : run 3 **seulement si** un correctif a été fusionné le 21 après le run 2 | tampon | tampon | — | rien, ou run 3 |
| **Dim 23** | relevé 18:00 : critères § 2 cochés, transmis à O | — | — | — | message daté Q → O : GO ou NO-GO argumenté |
| **Lun 24** | O : tag `v1.0.0-rc.1` si § 2 est entièrement vert (`CHANGELOG.md`, release GitHub, `release-integrity.yml`) ; sinon correctif + nouveau run, tag au plus tard mar 25 (H-5) | | | | tag, release, SBOM |

Rôles croisés le 21 : personne ne recette seul son propre code. Chaque anomalie porte un identifiant `REC-nn` (suite des `SMK-nn`), le parcours, le compte (identifiant seul), les étapes, l'attendu, le constaté, une capture.

## 2. Critères GO / NO-GO pour le tag rc.1 (tous requis, relevés par Q le 23 à 18:00)

1. **0 anomalie bloquante ouverte** ; chaque majeure a une décision PO écrite (corrigée, acceptée avec phrase d'écart, ou V1.1).
2. **Smoke + uat verts sur 2 runs consécutifs** sur la pile Docker depuis `main` (runs 1 et 2, ou 2 et 3), sans `skip` ajouté depuis le 19 ; rapport HTML et traces archivés (plan B captures).
3. **Reset D1 identique** : deux `e2e_reset.sh demo` consécutifs donnent les mêmes compteurs (`measure_counters.py` = section `expected` du manifeste) et les mêmes SHA-256.
4. **C2 et C3 remesurés** sur le jeu D1 : C2 ≥ 95 % sur les fichiers couverts par une règle (10/11 : 100 %), C3 p95 ≤ 2 000 ms (10/11 : 27 ms) ; fichiers datés dans `recette/`.
5. **Restauration n° 2 prouvée** sur le poste de secours (`restauration-2026-11-20.txt`).
6. **Checklist H-30 rejouée** une fois en entier le 21 sans incident (login, OTP, `/health`, pas de 429, limite auth à `30/minute`).
7. **Heure PO faite** (§ 4) : parcours des 10 étapes terminé, verdict PO par parcours consigné.
8. **CHANGELOG.md** : section « Limites connues » complétée avec le relevé du 19 (lots non fusionnés) ; aucun écart annoncé sans sa phrase dans `plan-presentation.md` § 3.

NO-GO si un seul critère manque : correctif ciblé, nouveau run, tag reporté au plus tard au mar 25 ; au-delà, la démo se fait sur le dernier `main` vert avec captures (checklist § C) et le PO est prévenu le 25 au soir.

## 3. Tri des anomalies et circuit d'un correctif pendant le gel

| Classe | Définition | Traitement | Délai |
|---|---|---|---|
| **Bloquant** | un parcours du déroulé ne peut pas être joué, ni par repli manuel ni par API (§ 2 du déroulé) ; ou faille visible (cloisonnement, 413, racines d'import) | correctif **dans la journée** par la session propriétaire ; O prévenu immédiatement | fusion le jour même, rejeu Q le lendemain matin |
| **Majeur** | le parcours se joue, mais avec un repli ou un résultat différent de l'attendu (compteur faux, filtre inopérant, message erroné) | **décision PO** (heure PO du 21 ou message) : corriger si ≤ 0,25 j **de session**, sinon phrase d'écart | décision le 21, correctif éventuel le 22 |
| **Mineur** | cosmétique, libellé, aide, cas hors déroulé | **V1.1** : ligne dans `CHANGELOG.md` « Limites connues » si visible en démo, sinon backlog | aucun correctif avant le 30 |

Circuit d'un correctif (identique pour B et F) : branche `fix/rec-nn-<sujet>` depuis `main` → PR titrée `fix(...)` citant `REC-nn`, **sans nouvelle fonctionnalité ni migration** (une migration = décision O) → CI verte (gates de la surface touchée) → **relecture O** sur le diff (grille § 0 de `grille-relecture.md` : contrat, idempotence, test de non-régression ajouté) → fusion par O → rejeu Q du parcours touché → `REC-nn` fermé dans la liste. Une PR qui dépasse le périmètre de son `REC-nn` est renvoyée. Jamais de `--no-verify`, jamais de commit direct sur `main`.

## 4. L'heure du PO (ven 21, créneau proposé à confirmer par le PO, 60 min au plus, poste principal, jeu D1 après reset)

Le PO joue lui-même, sans assistance au clavier (O lit les étapes, note les verdicts) ; comptes désignés par identifiant seul, codes OTP lus dans la réponse de connexion (`ENVIRONMENT=development`) ou dans Redis par O.

1. **Connexion** `MINFI002` avec un code OTP juste ; vérifier nom et rôle dans l'en-tête (5 min).
2. **Import** du dossier `/data/ingest/live` depuis `/ingestion` : compteur, doublons refusés, documents classés (8 min).
3. **Tableau de bord** administrateur : tuile « Doublons refusés » > 0 *(si lot 1 fusionné, sinon passer)* (3 min).
4. **Règles** : simuler la règle inactive « Rapports financiers » ; vérifier qu'aucun document ne bouge ; *(si lot 2 fusionné)* exporter puis réimporter le fichier : « 0 à créer, 0 à mettre à jour » (8 min).
5. **Revue manuelle** d'un document sans règle : choisir service, domaine, activité, année ; il quitte la liste (5 min).
6. **Espaces** en `MGR001` : DAF → Comptabilité → 2025, ouvrir un document, historique des versions ; filtres et pagination *(si #78 fusionnée)* (6 min).
7. **Recherche** en `MINFI002` puis en `READ001` : même mot-clé, deux listes différentes, temps de réponse affiché ; un document mis en corbeille n'apparaît plus (7 min).
8. **Cycle de validation** : soumettre en `MINFI002`, viser un document et en rejeter un autre avec motif en `MGR001`, voir le statut côté rédacteur (8 min).
9. **Journal d'audit** en `AUDIT001` : filtrer sur `MINFI002` + aujourd'hui, retrouver l'ordre des actions ; *(si lot 3a fusionné)* exporter le CSV et l'ouvrir (5 min).
10. **Verdict** : pour chaque parcours P1–P8, GO / majeur / bloquant, et pour chaque majeur la décision (corriger, accepter avec phrase d'écart, V1.1) ; O reporte dans `matrice-recette.md` et dans la liste `REC-nn` (5 min).

Hors parcours PO : le verrou OTP (lot 3b) ne se montre pas au PO sur un compte de séance ; s'il veut le voir, O le joue sur `UNIT001` après l'heure. Le PO ne touche ni au poste de secours ni à la restauration.

Sources : `innovateur/matrice-recette.md` § 1-2 ; `innovateur/deroule-demo.md` § 1, 1 bis, 2 ; `innovateur/checklist-demo.md` § B-C ; `recette/mesures-outillage.md` ; `recette/restauration-2026-11-10.txt` ; `decisions/DEC-2026-002` (calendrier 19–24, révision du 10/11) ; `innovateur/specs-v11-avant-gel/grille-relecture.md` § 0 ; `frontend/e2e/specs/uat/` (10/11 12:30).
