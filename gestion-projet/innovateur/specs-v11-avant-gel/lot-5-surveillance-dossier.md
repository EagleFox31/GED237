# Lot 5 — Surveillance continue d'un dossier (§ 1 n° 7 de DEC-2026-002, réouvert par la révision du 10/11)

Pour : dev-backend (tâche périodique, déduplication), ci-qa (compose, preuve), dev-frontend (état affiché), orchestrateur. Fiche courte de l'innovateur, 2026-11-10, lue sur `main` 950e66b. Règle : **livré si fusionné le mer 19/11 18:00, sinon V1.1** (phrase § 1 n° 7 inchangée : « import manuel d'un dossier, surveillance en V1.1 »). Dernier dans l'ordre O : le moins visible en démo, le plus sensible côté exploitation (RAM du worker, chemins). Niveaux : `Vérifié` = lu dans le dépôt ; `Proposé` = à trancher dans la PR. Pas de code ici.

**État au 10/11 11:10** : aucune PR ; B confirme la configuration par variables sans table.

## 1. Existant (`Vérifié`)

| Où | Ce qui existe |
|---|---|
| `endpoints/documents.py:1470` + `services/ingestion.py:88-160` | `POST /documents/ingest-directory` (`directory_path, recursive, document_category_id, processing_mode`) : scan `os.walk` sans liens symboliques, racine contrôlée par `INGEST_ALLOWED_ROOTS` (`core/config.py:67-70,161`, vide = tout refusé, 403 `INGEST_PATH_FORBIDDEN`, 7 tests `test_ingest_allowed_roots.py`) ; chaque fichier → version + classement par règles + OCR Celery (`:322`) ; rapport `total_found / imported / skipped / errors / details`. Droit `documents:create`, tenant et unité de l'appelant. |
| Déduplication | **upload** : empreinte `checksum_sha256` (`document_versions.py:28`) → 409 + audit `dup_detected` (`documents.py:600-616`) ; **ingestion** : aucune empreinte, un fichier déjà importé est **réimporté** (seul le nom de destination reçoit un suffixe, `ingestion.py:255-260`). Un rescan n'est donc pas idempotent aujourd'hui. |
| Worker | `workers/celery_app.py` (Redis broker, `include=["app.workers.tasks"]`, **aucun `beat_schedule`**) ; compose `worker: celery -A app.workers.celery_app worker --concurrency=2` ; une seule tâche, l'OCR. |
| Frontend | `profiles/tenant-admin/pages/DirectoryIngestion.tsx` (route `/ingestion`), `services/resources/documents.api.ts:151` ; lien depuis `SpacesPage.tsx:471`. |
| Démo | pas d'étape « surveillance » dans le déroulé ; D1 utilise `/data/ingest` (profil `demo` de `e2e_reset.sh`). |

## 2. Contrat (`Proposé`)

1. **Configuration déclarative, pas de table** : `INGEST_WATCH_FOLDERS` (JSON, défaut `[]`) = liste de `{ "path", "tenant_code", "org_unit_code", "matricule", "document_category_code"? , "recursive"? }`. Chaque `path` doit être sous une racine de `INGEST_ALLOWED_ROOTS` (même contrôle que l'endpoint, sinon ignoré avec une ligne de log au démarrage). `INGEST_WATCH_INTERVAL_SECONDS` (défaut `60`, `0` = désactivé). Le compte `matricule` est l'auteur des imports (audit et `uploaded_by`), comme s'il avait cliqué « Importer ». Pas de CRUD ni d'écran de configuration (V1.1 : table + écran admin).
2. **Tâche périodique Celery** `app.workers.tasks.watch_ingest_folders` : `beat_schedule` dans `celery_app.py` ; lancée par `celery ... worker -B` sur le service `worker` existant (un seul worker : pas de second conteneur, RAM bornée). Verrou Redis `ingest_watch:lock` (TTL = intervalle) : un passage à la fois, jamais deux en parallèle. Pour chaque dossier : réutilise `DirectoryIngestionService.ingest` (**aucune seconde implémentation du scan**), puis **déplace** chaque fichier importé vers `<path>/_traites/AAAA-MM-JJ/` et chaque fichier en erreur vers `<path>/_erreurs/` (le dossier surveillé ne contient que l'attente ; un second passage sans nouveau fichier = `total_found 0`, zéro écriture).
3. **Déduplication par empreinte dans l'ingestion** (profite aussi à l'import manuel) : avant de créer la version, calcul de `checksum_sha256` et recherche dans le tenant ; si trouvé → `skipped` + ligne `details` « doublon de <document_id> » + audit `dup_detected` (alimente le KPI du lot 1, cohérent avec l'upload) ; le fichier part dans `_traites/` quand même. Fichiers partiels : ignorer ceux modifiés depuis moins de `INGEST_WATCH_SETTLE_SECONDS` (défaut `10`) pour ne pas lire une copie en cours.
4. **État consultable** : à chaque passage, clé Redis `ingest_watch:last_run` = `{ "at", "folders": [{ "path", "found", "imported", "skipped", "errors" }] }` ; **`GET /documents/ingest-watch/status`** (droit `documents:create`, tenant courant : seuls ses dossiers) la renvoie, plus `enabled` et `interval_seconds`. Chaque passage avec `imported > 0` ou `errors > 0` écrit une ligne d'audit `documents` / `watch_ingested` (`new_data` = compteurs), jamais une ligne pour un passage vide (journal lisible).
5. **Frontend** : en tête de `DirectoryIngestion.tsx`, un encart compact « Surveillance : <dossier> — dernier passage à HH:MM, n importés, n ignorés » lu de `/ingest-watch/status` (rafraîchi toutes les 30 s), ou « Surveillance désactivée » ; icône d'aide, pas de bandeau. Pas d'écran de configuration.
6. **Compose** : `worker` passe en `-B` ; variables dans `.env.example`, `docker-compose.yml` (désactivé par défaut : `INGEST_WATCH_FOLDERS=[]`), pile e2e/démo : un dossier `/data/ingest/surveille` lié au tenant de démo et à MGR001, intervalle `15` s pour la preuve. Volume monté en lecture-écriture (déplacement). Limites mémoire du worker inchangées.
7. **Hors périmètre** : inotify/watchdog (le polling suffit à 60 s), plusieurs workers, suppression des fichiers source, surveillance par utilisateur, SMB/S3, configuration par l'UI.

## 3. Cas de test

| Cas | Entrée | Attendu |
|---|---|---|
| pytest config | `INGEST_WATCH_FOLDERS` avec un chemin hors `INGEST_ALLOWED_ROOTS` | dossier ignoré, log explicite, les autres actifs ; `[]` → tâche no-op |
| pytest passage | 3 fichiers dans le dossier ; appel direct de la tâche (sans beat) | 3 documents créés pour le tenant/unité configurés, fichiers dans `_traites/<date>/`, `last_run` rempli, audit `watch_ingested` |
| pytest idempotence | second appel immédiat | `found 0`, aucune écriture, aucune ligne d'audit |
| pytest doublon | copie d'un fichier déjà importé | `skipped 1`, audit `dup_detected`, fichier déplacé, compteur lot 1 incrémenté |
| pytest fichier en cours | fichier modifié il y a 2 s (`SETTLE=10`) | ignoré ce passage, importé au suivant |
| pytest verrou | `ingest_watch:lock` déjà posé | tâche sort sans scanner |
| pytest statut | `GET /ingest-watch/status` par MGR001 ; par un compte d'un autre tenant | ses dossiers ; liste vide |
| pytest erreur | fichier illisible (droits) | `_erreurs/`, `errors 1`, les autres importés |
| e2e / recette Q | pile Docker : copier `facture-2025.pdf` dans `/data/ingest/surveille` ; attendre ≤ 30 s | document visible dans l'espace, encart « dernier passage » mis à jour, fichier dans `_traites/` |

Preuve : pytest Docker vert (8 cas) ; `docker compose logs worker` montrant un passage vide puis un passage à 1 import ; capture de l'encart ; recette Q rejouée deux fois (seconde = `found 0`). I ajoute SC-ADM-12 à la matrice et passe le n° 7 du § 1 de DEC-002 à « livré » à la fusion. Budget en temps de session : B ≈ 0,4 j (dédup 0,1, tâche + déplacement 0,2, statut + tests 0,1), Q ≈ 0,1 j (compose, volume, recette), F ≈ 0,1 j. Ordre : PR B (dédup + tâche + statut) puis PR Q/compose dans la même PR ou juste après, F en dernier.

Sources : fichiers cités, lus le 10/11 sur `main` 950e66b ; `DEC-2026-002` § 1 n° 7 et révision du 10/11 ; `lot-1-kpi-doublons.md` § 2 (audit `dup_detected`) ; `spec-limite-upload.md` § 5 (racines d'import) ; mémoire projet « conteneurs bornés ».
