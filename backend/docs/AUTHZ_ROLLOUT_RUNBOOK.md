# AuthZ Rollout Runbook (P6.5 → P6b.8)

> Statut lot P6b: ✅ Terminé (2026-04-18)
> Résultat de validation: `63 passed` sur `tests/api/test_authz.py`

## Scope
Migration contrôlée AuthZ Casbin `csv -> shadow -> sql`, avec rollback rapide.

## Preconditions
- Migration DB appliquée (`alembic upgrade head`).
- API démarre en `AUTHZ_BACKEND=shadow` sans erreur.
- Super-admin disponible pour les opérations `/api/v1/authz/*`.

## Phase 0 — Backup obligatoire (pre-cutover)
```bash
python scripts/backup_policies.py --output-dir ./backups/authz
```
Conserver le chemin retourné (ex: `./backups/authz/authz_backup_...`).

## Phase 1 — Shadow
1. Configurer:
   - `AUTHZ_BACKEND=shadow`
   - `AUTHZ_POLICY_DATABASE_URL=<url sql policy>`
2. Démarrer l’API.
3. Observer les logs:
   - `[AUTHZ_SHADOW_DIFF]` (écarts CSV vs SQL)
   - `[AUTHZ_SHADOW_ERROR]` (erreurs backend SQL)
4. Corriger les policies SQL jusqu’à zéro écart non expliqué.

## Phase 2 — Validation
- Exécuter:
```bash
pytest -q tests/api/test_authz.py
python scripts/benchmark_authz.py --iterations 1000 --sql-p99-max-ms 5 --sql-vs-csv-max-ratio 2.0
```
- Vérifier tests dédiés:
  - multi-worker simulé (visibilité mutation inter-process)
  - backup/restore script avec SLA `< 1 min`
- Vérifier `/api/v1/authz/metrics/health`:
  - `degraded=false`
  - `dropped_count=0` (ou incident connu documenté)
  - Note: `degraded` est un état observé (last-known), pas un probe réseau Redis actif.

## Phase 3 — Cutover SQL
1. Basculer config:
   - `AUTHZ_BACKEND=sql`
2. Redémarrer les instances.
3. Vérifier endpoints critiques:
   - `documents`, `workflows`, `users`, `org-units`, `authz/policies`.

## Phase 4 — Retrait CSV (prod)
- Conserver `policy.csv` comme artefact de backup uniquement.
- Toutes les mutations passent par `/api/v1/authz/policies`.

## Rollback (<1 minute)
1. Restaurer depuis backup:
```bash
python scripts/restore_policies.py --backup-dir <path_backup>
```
2. Rebasculer temporairement:
   - `AUTHZ_BACKEND=shadow` (diagnostic) ou `AUTHZ_BACKEND=csv` (urgence contrôlée non-prod).
3. Redémarrer services.

## Rate-limit policy mutations
- `POST /api/v1/authz/policies`: `10/minute` par utilisateur authentifié (fallback IP si user indisponible).
- `DELETE /api/v1/authz/policies`: `10/minute` par utilisateur authentifié (fallback IP si user indisponible).
- Payload bulk `> 5` règles: rejet `HTTP 400`.
