# Lot 1 — KPI doublons au tableau de bord (écart 8, réouvert par la révision du 10/11 de DEC-2026-002)

Pour : dev-backend (API), dev-frontend (carte), ci-qa (preuve), orchestrateur. Fiche courte de l'innovateur, 2026-11-10, lue sur `main` 950e66b. Règle : **livré si fusionné le mer 19/11 18:00, sinon V1.1** (phrase d'écart inchangée : « le compteur au tableau de bord arrive en V1.1 »). Niveaux : `Vérifié` = lu dans le dépôt ; `Proposé` = à trancher dans la PR. Pas de code ici.

**État au 10/11 11:10** : PR B **#77** (`feat/kpi-duplicates`, CI rouge : mock incomplet dans `test_dashboard_facade_patterns`, B corrige) et PR F **#81** (`feat/dashboard-duplicates-tile`, CI verte) ouvertes ; non fusionné.

## 1. Existant (`Vérifié`)

| Où | Ce qui existe |
|---|---|
| `api/v1/endpoints/documents.py:558-618` (upload) et `:1736-1750` (nouvelle version) | refus **409** `duplicate_file` par SHA-256 ; une ligne d'audit `action="dup_detected"`, `table_name="documents"`, `new_data={checksum_sha256, attempted_filename, existing_version}` via `_audit_document_action` (`:372-386`), **avant** la 409. |
| `services/import_analysis_service.py:110-128`, `import_execution_service.py:76-81` | import de dossier (`/imports`) : items `status="duplicate"`, compteur `ImportJob.duplicate_files` (`models/import_job.py:58`) ; **aucune ligne d'audit**. |
| `services/ingestion.py` (`/documents/ingest-directory`) | aucun `dup_detected` ; `skipped` = non importés (`:156`). À vérifier par B : si le doublon passe par le même chemin que l'upload, il journalise déjà ; sinon ajouter la même ligne d'audit. |
| `services/analytics/dashboard_facade.py:20-76` | `GET /analytics/tenant` → `{users.total, documents.{total, storage_used_mb, storage_quota_mb}, workflows.{pending, completed, rejected}}` ; droit `analytics.tenant:read` (`endpoints/analytics.py:15-24`). |
| `frontend/components/Dashboard.tsx:56-59` | 4 cartes lues de `api.getTenantAnalytics()` (`services/resources/analytics.api.ts:9-10`, typé `any`). |
| Tests | `tests/api/test_analytics.py` (2 tests), `tests/api/test_documents.py:78` `test_duplicate_detection` ; e2e `specs/dashboards.spec.ts`, `specs/demo-counters.spec.ts:165` « refused duplicates are not stored ». |

## 2. Contrat (`Proposé`)

1. **Réponse** `GET /analytics/tenant` : nouvelle clé **`duplicates`**, les clés existantes inchangées :
   `"duplicates": {"refused": <int>, "refused_upload": <int>, "refused_import": <int>}` avec `refused = refused_upload + refused_import`.
   - `refused_upload` = `count(AuditLog)` où `tenant_id` = tenant courant, `table_name="documents"`, `action="dup_detected"` (couvre upload et nouvelle version).
   - `refused_import` = `sum(ImportJob.duplicate_files)` du tenant, jobs **engagés** seulement (`running`, `completed`, `completed_with_errors`) : une analyse annulée ou relancée compterait sinon deux fois les mêmes fichiers (précision de dev-backend le 10/11, retenue).
   - Pas de double comptage : l'import n'écrit pas `dup_detected` (§ 1). Si B ajoute l'audit à `ingest-directory`, il compte dans `refused_upload` et n'incrémente pas `duplicate_files`.
2. **Cumul depuis l'origine du tenant**, aucune fenêtre temporelle (la démo part d'un reset ; une fenêtre « 30 jours » se discute en V1.1).
3. **Même façade** `DashboardFacade.get_tenant_metrics` (deux requêtes `count`/`sum` supplémentaires, pas de table ni de migration). `get_manager_metrics` et `get_platform_metrics` inchangés.
4. **Carte** : 5e carte « Doublons refusés » à côté de « Documents » (`Dashboard.tsx:56-59`), valeur `metrics?.duplicates?.refused ?? 0`, sous-texte `« {refused_upload} dépôts · {refused_import} imports »` ; `?? 0` si la clé manque (rétro-compatible avec une API non mise à jour). Typage : interface `TenantAnalytics` dans `analytics.api.ts` à la place de `any` (`Proposé`, 10 lignes).
5. **Hors périmètre** : liste des doublons, lien vers le document existant, KPI par service, export.

## 3. Cas de test

| Cas | Entrée | Attendu |
|---|---|---|
| pytest `test_tenant_analytics_duplicates` | upload `a.pdf` puis re-upload du même binaire → 409 ; `GET /analytics/tenant` | `duplicates.refused == 1`, `refused_upload == 1`, `refused_import == 0` ; clés existantes toujours présentes |
| pytest isolation | même scénario, puis `GET /analytics/tenant` avec un compte d'un **autre** tenant | `refused == 0` |
| pytest import | job d'import exécuté avec 2 fichiers déjà présents (fixture de `test_imports.py`) | `refused_import == 2`, `refused == 2` |
| pytest droits | lecteur (`READ001`) | 403 inchangé (`test_get_platform_analytics_denied_standard_user` comme modèle) |
| e2e `dashboards.spec.ts` | après `e2e_reset.sh` (jeu e2e : doublons déjà refusés par le seed ou par `demo-counters`) | carte « Doublons refusés » visible, valeur numérique ≥ 0 ; sur le profil `demo` : valeur = nombre de fichiers `status: duplicate` du manifeste (`demo-counters.spec.ts:72`) |
| manuel P2 (déroulé) | déposer 3 fichiers dont 1 doublon via `/ingestion` | la carte passe de n à n + 1 après rafraîchissement |

## 4. Preuve attendue dans la PR

- B : pytest vert (4 cas) en Docker ; extrait JSON de `GET /analytics/tenant` sur la pile e2e.
- F : capture de la carte avec un compteur > 0 ; build + lint Docker ; `dashboards.spec.ts` vert en local.
- Q : run smoke + `dashboards` sur la pile Docker après fusion ; ligne SC-ADM-09 « KPI doublons » ajoutée à `matrice-recette.md` par I à la fusion (critère : valeur de la carte = `duplicates.refused` de l'API = doublons du manifeste).
- Budget en temps de session : B ≈ 0,15 j, F ≈ 0,1 j, Q ≈ 0,05 j. Une PR B puis une PR F (F peut partir sur le contrat § 2 sans attendre : `?? 0`).

Sources : fichiers cités, lus le 10/11 sur `main` 950e66b ; `DEC-2026-002` (révision du 10/11) ; `plan-presentation.md` § 3 n° 3 ; `deroule-demo.md` § 3.
