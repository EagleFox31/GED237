# [Claude] Lot 0 — Sécurisation environnement — 2026-07-22

> Statut : EN COURS — reprise par voie **Docker** (décision PO du 2026-07-22)
> Agent : Claude (Tech Lead / QA)
> Note : T01 et T03 restent ✅ Vérifiés. T04/T05/T06 débloqués via la stack
> `docker compose` (projet `edossier`) au lieu d'un venv local.
> Date : 2026-07-22
> Type de tâche : technique (environnement / baseline)
> Référence : `gestion-projet/PLAN_EXECUTION_GED237_2026-07-22.md` (Lot 0),
> `PERT_EXECUTION` T01–T06

## Ce qui va être fait

Établir un environnement fiable et une baseline de preuve :

- **T01** état Git réel (revérifie l'audit du 22/07) ;
- **T03** audit `venv/` / `.venv/` (suivis ? valides ?) ;
- **T04** recréer un environnement Python propre depuis `requirements.txt` ;
- **T05** vérifier les heads Alembic sur `edossier` et `test_ged` ;
- **T06** exécuter la baseline `pytest` (Postgres + Redis présents : `trigenys_*`).

**Exclu : T02 (commit/push)** — nécessite une demande humaine explicite, non
donnée. Aucune suppression des venvs existants (T03 DoD : pas de suppression non
autorisée).

## Pourquoi

L'audit du 22/07 signalait env cassé + tests non rejouables ; ces constats sont à
revérifier avant d'être traités comme courants, et à transformer en preuve
**Vérifié**. C'est le déblocage du chemin critique.

## Comment

- Diagnostics Git/venv en lecture seule (T01/T03).
- T04 : nouvel environnement `backend/venv313` (Python 3.13 via `py -3`) pour ne
  pas écraser ni supprimer les env étrangers existants ; `pip install -r requirements.txt`.
- T05/T06 : via ce nouvel environnement + `.env` de test.

## Résultat attendu

Python utilisable, dépendances installées, deux bases au head, rapport pytest
pass/fail complet et honnête.

## Fichiers / zones concernés (VERROU)

- **création** `backend/venv313/` (nouvel environnement)
- lecture seule : `backend/requirements.txt`, `backend/.env`, `backend/alembic/`,
  `backend/tests/`
- ce fichier
- (aucune modification de code applicatif dans cette tâche)

## Vérifications prévues

- `git` : log, status, ahead/behind origin.
- `venv` : pyvenv.cfg + suivi git + `.gitignore`.
- `pip check` post-install ; `alembic heads/current` ; `pytest` avec compte-rendu.

---

## RÉSULTAT (par tâche)

### T01 — État Git — ✅ Vérifié
- 4 commits ; `origin/main == HEAD` (0/0) → **rien de neuf poussé**.
- Working tree : **38 modifiés + 38 untracked** ; **11 833 LOC** (ts/tsx/py) non
  versionnées (inchangé vs audit ; les nouveaux fichiers récents sont des `.md`).
- Commande : `git rev-list --left-right --count origin/main...HEAD` → `0 0`.

### T03 — Audit venv — ✅ Vérifié (CORRIGE l'audit initial)
- `git ls-files backend/venv backend/.venv` → **0 fichier suivi**.
- `.gitignore` l.20-21 : `.venv/` et `venv/` ignorés ; `git check-ignore` confirme.
- **Correction** : l'audit du 22/07 disait « venv committé/étranger ». Faux : le
  venv **n'est pas versionné**, il est ignoré. Il reste **localement étranger/cassé**
  (`pyvenv.cfg` → `C:\Users\XEPTION NETWORK\...\Python312`, `E:\GED237`), donc
  inutilisable, mais **aucune action git n'est requise** (DoD T03 déjà satisfait :
  environnements non suivis).

### T04 — Recréer l'environnement — ⛔ BLOQUÉ
- Seul **Python 3.13** installé (`py --list` → `-V:3.13 *`). Pas de 3.12.
- `requirements.txt` épingle des paquets **sans wheels 3.13** : `torch==2.2.2`
  (cp313 dès torch 2.5+), `asyncpg==0.29.0` (cp313 dès 0.30), `easyocr`, `spacy`…
- L'env cassé a été construit en **Python 3.12.6** (pyvenv.cfg).
- **Cause** : mismatch de version Python. **Prochaine action** : installer
  **Python 3.12** (fidèle aux pins) **ou** décider une modernisation des deps vers
  3.13 (bump asyncpg→0.30, torch→2.5+… — déviation des pins, sign-off PO requis).

### T05 — Migrations aux heads — ⛔ BLOQUÉ (dépend de T04 + DB)
- Nécessite un env Python fonctionnel (alembic) + connexion aux bases GED237.

### T06 — Baseline pytest — ⛔ BLOQUÉ
- `TEST_DATABASE_URL` **non défini** dans `backend/.env` → `conftest.py` lève une
  erreur d'emblée (obligatoire).
- Postgres vu (`trigenys_postgres`) **non running** et hors périmètre GED237.
- **Prochaine action** : fournir un **Postgres + Redis dédiés GED237** (via
  `docker-compose` du projet — attention conflit de ports 5432/6379 avec la stack
  `trigenys`) + définir `TEST_DATABASE_URL` et `TEST_REDIS_URL`.

## Synthèse

- **M0 non atteint** sur cette machine en l'état.
- 2 acquis vérifiés : état Git (T01), venvs non versionnés (T03, + correction audit).
- 3 prérequis manquants, décisions PO/humaines : **(a)** Python 3.12, **(b)** DB/Redis
  de test GED237 running, **(c)** `TEST_DATABASE_URL`/`TEST_REDIS_URL`.
- **T02 (commit/push) non fait** : demande explicite requise.

## Reprise via Docker (décision PO)

### Infrastructure — ✅ Vérifié
- Stack compose projet **`edossier`** : `postgres:15-alpine`, `redis:7-alpine`,
  `api` (build `./backend/Dockerfile`), `worker`, `frontend`, `nginx`.
- `edossier_postgres` et `edossier_redis` : **Up, healthy** (Postgres **15.18**).
- **Aucun conflit de ports** avec la stack `trigenys` : postgres/redis n'exposent
  pas de port hôte (seul `nginx` publie). Ma détection initiale d'indisponibilité
  était un artefact d'un redémarrage du daemon Docker.
- `backend/Dockerfile` = **`python:3.11-slim`** → compatible avec tous les pins
  (`torch==2.2.2`, `asyncpg==0.29.0` ont des wheels cp311). **Le blocage Python
  3.13 disparaît par cette voie.**

### T05 — État réel des migrations — ⛔ Écart majeur constaté
- Base `edossier` : **0 table**, pas de relation `alembic_version`, taille 7,5 Mo.
- → **Aucune migration n'a jamais été appliquée** sur cette base. La DB est vierge.
- `test_ged` **n'existait pas** → **créée** (`CREATE DATABASE test_ged OWNER
  edossier_user`) — opération additive, non destructive.
- Bases après : `edossier`, `postgres`, `test_ged`.

### T04 — Build de l'image `api` — 🔄 en cours
- `docker compose build api` lancé en arrière-plan (pull `python:3.11-slim` puis
  `pip install -r requirements.txt`).
- **Coût attendu élevé** : `torch` + `torchvision` + `torchaudio` + `easyocr` +
  `spacy` → plusieurs Go de téléchargement.

### T04 — INTERROMPU par décision PO (budget data) — ⏸️ BLOQUÉ

- **Arrêt demandé** : pas de budget data pour ~2 Go. Build stoppé **avant** le
  téléchargement de `torch` (755,6 MB) — consommation réelle ≈ **150–200 Mo**.
- Arrêt **vérifié** : log figé, aucun conteneur de build actif.

#### Acquis conservés (non perdus)
- `.dockerignore` créé → contexte **834 MB → 1,18 MB** (≈700×), build atteint
  `pip install` en ~20 s au lieu de rester bloqué 7 min.
- Infra `edossier_postgres` / `edossier_redis` up & healthy ; base `test_ged` créée.

#### ⚠️ Piège à corriger avant de relancer
`backend/Dockerfile` utilise `pip install --no-cache-dir` → **rien n'est
réutilisable** : une reprise re-télécharge tout depuis zéro. À changer si on veut
des builds interruptibles.

#### Options pour reprendre (par économie de données)
1. **torch CPU-only** (`--index-url https://download.pytorch.org/whl/cpu`) :
   supprime toute la stack NVIDIA → total **~600–800 Mo** au lieu de ~3–3,5 Go.
   **Économie ≈ 2,7 Go.** Sans impact fonctionnel (code déjà CPU-aware, cf.
   `easyocr_engine.py:55-66`).
2. **Cache pip BuildKit** (`--mount=type=cache`) : reprise sans re-téléchargement.
3. **Image prête sur DockerHub** (idée PO) : build une fois, `pull` ensuite.

#### Travaux possibles SANS aucun téléchargement (non bloqués)
- Frontend : `typecheck` / `build` / e2e (node_modules déjà présents).
- T14 retrait `/index.css` (innocuité déjà vérifiée).
- Spec plan-mode du contrat `spaces/documents` (T09).
- Écriture de `test_reports.py` (exécution différée).

### Reste à faire (dès build terminé)
1. `alembic upgrade head` sur `edossier` **et** `test_ged` (T05).
2. `pytest` avec `TEST_DATABASE_URL=postgresql+asyncpg://edossier_user:changeme@postgres/test_ged`
   et `TEST_REDIS_URL=redis://redis:6379/0` (T06) → baseline pass/fail.

## Coordination
- Verrou : création `backend/venv313/` **non effectuée** (T04 bloqué) → aucun
  fichier de code touché. Aucun verrou concurrent au démarrage.
