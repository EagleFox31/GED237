# AUDIT ACTUEL - E-Dossier Cameroun (GED237)

> Dernière mise à jour : 2026-04-18 (clôture P6b AuthZ + livraison T6.4 quality-gate)
> Scope : code courant backend + frontend + tests
> Méthode : lecture directe du code source, inventaire des endpoints, schémas, stores, services, fichiers de test

---

## État Global

| Axe | État |
|-----|------|
| Backend FastAPI | 42+ routes, toutes protégées par Casbin via façade unique |
| Tests backend | 10+ fichiers, **63 tests authz** verts (`tests/api/test_authz.py`) |
| Tests frontend | Aucun test automatisé |
| Build frontend | Non vérifié |
| Déploiement production | Recommandé en rollout contrôlé (runbook P6b validé) |

---

## Phases PERT — État d'avancement

| Phase PERT | Contenu | État |
|-----------|---------|------|
| P0 — Stabilisation env | Dépendances, venv, imports | ✅ Terminé |
| P1 — Backend | `get_current_user`, démarrage Uvicorn | ✅ Terminé |
| P2 — Migration BDD | Contraintes rôles, seed | ✅ Terminé |
| P3 — Auth front/back | Flow OTP, refresh, mapping profils UI | ✅ Terminé |
| P4 — Documents & Workflow | GEDRules, machine d'état, permissions | ✅ Terminé |
| **P5 — Sécurité Multi-Tenant & RBAC** | Casbin, façade authz, tests cross-tenant | ✅ **Terminé** |
| P6 — Qualité, CI & DevSecOps | Pipeline + SAST + SCA + secrets + coverage (13 tâches) | 🔧 En cours (13/13 livrés) |
| **P6b — AuthZ Production-Grade** | CSV→SQL Casbin, shadow mode, API policy, cache versionné | ✅ **Terminé** |
| P7 — UI → API réelle | AuthZ admin UI, audit endpoint, suppression mocks | ✅ **Terminé** |

---

## P5 — Ce qui a été livré (2026-04-17)

### Socle authz Casbin (`backend/app/core/authz/`)

| Fichier | Rôle |
|---------|------|
| `model.conf` | Modèle RBAC `sub/obj/act`, matcher `manage` wildcard |
| `policy.csv` | 58 policies, 7 rôles, 10 ressources, vocabulaire d'actions figé |
| `casbin_enforcer.py` | Singleton `AsyncEnforcer` + `await load_policy()` |
| `context.py` | `AuthzContext(tenant_id, owner_id, org_unit_id)` + `ctx_from_resource()` |
| `service.py` | Façade `authorize_or_403` — Casbin → tenant check → ownership → audit log |

**Vocabulaire d'actions figé** : `read`, `read_own`, `create`, `update`, `update_own`, `delete`, `delete_own`, `trash_own`, `manage`, `assign`, `resolve_review`, `simulate`.

**Dette explicitement documentée dans `policy.csv`** : fichier CSV valide en DEV/STAGING uniquement. En production multi-instance → migrer vers `SQLAlchemyAdapter` Casbin.

### Migration des endpoints

Tous les checks inline `role.code not in [...]` ont été supprimés de tous les endpoints.

| Endpoint | Checks inline supprimés |
|----------|------------------------|
| `categories.py` | 3 |
| `users.py` | 3 |
| `org_units.py` | 2 + `_require_admin()` locale supprimée |
| `gedrules.py` | 10 + `_require_admin()` function supprimée + constante `ADMIN_ROLES` supprimée |
| `documents.py` | 10 (helpers `_can_*` rendus async via `can_perform`) |
| `workflows.py` | 3 |
| `analytics.py` | 1 |
| `tenants.py` | 4 |

**Zéro guard d'autorisation inline restant.** Les filtres de scope SQL (`documents.py` : `ADMIN_ROLES`, `TENANT_WIDE_READ_ROLES`, `ORG_UNIT_READ_ROLES`) restent en place pour la visibilité des requêtes — ce ne sont pas des checks d'accès mais des filtres de portée déterminant quels documents un rôle peut lister.

### Flux d'autorisation garanti

```
1. Casbin enforce(role, resource, action)
2. Tenant isolation : ctx.tenant_id == user.tenant_id (super_admin exempté)
3. Ownership : si action *_own → ctx.owner_id == user.id
4. Audit log : WARNING (cross-tenant, actions sensibles) / INFO (refus RBAC standard)
```

### Fix collatéral : GEDRules listener cross-loop Windows

`gedrules_listeners.py` : le listener réutilise désormais la session DB injectée via le payload de l'event (`_db`) au lieu d'ouvrir un nouveau pool. Corrige le crash `ProactorEventLoop._proactor = None` sur Windows en contexte de tests avec boucles asyncio function-scoped.

### Tests P5 (26 nouveaux — `test_authz.py`)

| Famille | Tests | Ce qui est couvert |
|---------|-------|--------------------|
| Casbin pur | 6 | Policies par rôle sur resources stratégiques |
| Façade | 5 | Ownership check, cross-tenant block, super_admin exempt, RBAC denied |
| SQL backend | 1 | Policy decision + reload via SQLAlchemy adapter |
| HTTP RBAC + cross-tenant | 14 | standard bloqué sur categories/gedrules/analytics/users/org_units, cross-tenant doc, read_own, workflow steps/actions cross-unit, RBAC vs règle métier |

---

## Corrections appliquées avant P5 (2026-04-17 — lot stabilisation)

### Dispatcher async bloquant (ex-P0 #1)
`backend/app/core/events/dispatcher.py` : `asyncio.create_task()` fire-and-forget → `asyncio.gather(_safe_call())`. Bloquant, concurrent, erreurs isolées, docstring honnête sur le comportement assumé (pas du BASE, du synchrone in-process).

### `org_unit_id` garde explicite (ex-P0 #2)
`documents.py` : garde `HTTP 400` dans `upload_new_version()` + autorisation cross-unit `HTTP 403` dans `list_workspace_documents()`.

### Suppressions métier (ex-P0 #3)
`users.py` : `DELETE /users` bloque sur documents actifs + workflow steps actifs (HTTP 409).
`org_units.py` : `DELETE /org-units` bloque sur enfants + users actifs + documents actifs (HTTP 409).

### Corrections tests pré-existants
- `test_auth.py` : flow 2FA réel (login → verify-otp) dans `_full_login()` helper
- `test_rules.py` : URL corrigée `/api/v1/rules/` → `/api/v1/gedrules/rules`
- `test_documents.py` : `db_seed` ajouté aux signatures manquantes
- `test_gedrules.py` : `RoutingRule(category=...)` → `document_category_id=...`
- `test_workflows.py` : 13 uploads nettoyés (GEDRules auto-routing conflits)
- `conftest.py` : `reset_redis_singleton` fixture (cross-loop asyncio), `DocumentCategory` dans `db_seed`

---

## Findings actuels

### P1 — Qualité & portabilité tests

**4. Tests auth nécessitent Redis local**
`test_auth.py` : `test_login_success_and_me` et `test_refresh_token` appellent Redis réel. Pas de mock. Si Redis est absent → les 2 tests échouent.

**5. `TEST_DATABASE_URL` fallback hardcodé**
`conftest.py:5` : `postgresql+asyncpg://postgres:Postgresql@localhost:5432/test_ged` en dur. `TEST_DATABASE_URL` env var est lue mais le fallback reste non-injectable proprement en CI.

**6. Navigation tenant-admin partiellement câblée**
Plusieurs entrées du menu `tenant-admin` pointent vers des routes non déclarées dans `TAB_TO_ROUTE`.

---

### P2 — Finition UI / Observabilité

**7. Intégration frontend/API (reste AuditLogs à finaliser)**

| Composant | Ce qui est mocké | Endpoint à brancher |
|-----------|-----------------|---------------------|
| `Dashboard.tsx` | ✅ branché API | `GET /notifications` + `GET /analytics/tenant` |
| `AuditLogs.tsx` | Proxy notifications | Endpoint `/audit-logs` backend absent |
| `LibraryView.tsx` | ✅ branché API | `GET /documents?status=validated` |
| `PlatformDashboard.tsx` | ✅ branché API | `GET /analytics/platform` |

**8. Synchronisation modale ↔ liste document**
`DocumentDetailModal.tsx` → `Documents.tsx` : la liste parente ne se rafraîchit pas après action de validation dans la modale.

**9. Filtre `role_id !== 5` couplé aux IDs seed**
`DraftWorkspace.tsx` : filtre hardcodé sur l'ID numérique du rôle collaborateur.

**10. Logging non structuré résiduel**
`documents.py:302` : `print(f"Warning: Could not queue OCR task...")` → doit être `logger.warning`.
`frontend/hooks/useNotifications.ts` : `console.error()` sans corrélation de requête.

---

## État des tests backend (62 tests)

| Fichier | Tests | Couverture |
|---------|-------|------------|
| `test_auth.py` | 4 | Login invalide, route protégée, flow 2FA complet, refresh token |
| `test_documents.py` | 6 | Upload, corbeille/restore, lock/unlock, dédoublonnage, workspace/tree, manager dashboard |
| `test_workflows.py` | 15 | Flux nominal, policy, avancement, history, return, concurrence, validated |
| `test_gedrules.py` | 4 | Routage auto, fallback pending_assignment, sans catégorie, priorité |
| `test_analytics.py` | 2 | Métriques tenant, refus platform |
| `test_search.py` | 2 | Recherche simple et avec filtres |
| `test_tenants.py` | 2 | Liste tenants (standard scoped), create interdit |
| `test_rules.py` | 1 | Lecture règles GEDRules |
| `test_authz.py` | **26** | Casbin pur, façade ownership/cross-tenant, SQL backend, HTTP RBAC (categories/gedrules/analytics/users/org_units/workflows) |

---

## Architecture validée

| Composant | État |
|-----------|------|
| Auth 2FA | ✅ |
| Permissions documents | ✅ Casbin + ownership + locking |
| Machine d'état workflow | ✅ Centralisée |
| Contrat auth front/back | ✅ |
| GEDRules routing engine | ✅ |
| **RBAC centralisé Casbin** | ✅ **Façade unique, 0 check inline** |
| **Isolation multi-tenant** | ✅ **SQL scope + tenant_guard dans façade** |
| **Tests cross-tenant** | ✅ **26 tests RBAC dédiés** |
| **Audit log refus sensibles** | ✅ **WARNING/INFO structuré** |
| CI pipeline | ✅ Présente (backend + frontend + security + quality-gate unifiée) |
| AuthZ SQL prod | ✅ SQL/shadow disponible + runbook de cutover |
| Frontend branché sur API | ✅ 100% — AuthZ admin + Audit + AdminPanel supprimé |

---

## Prochaine phase : P6 — Qualité, CI & DevSecOps

Objectifs selon PERT (13 tâches) :

| Tâche | Description | Standard | État |
|-------|-------------|----------|------|
| T6.1 | Seed CI injectable (`TEST_DATABASE_URL`, `REDIS_URL` obligatoires) | 12-Factor | ✅ |
| T6.2 | Pipeline CI backend (pytest + services Docker) | DORA | ✅ |
| T6.3 | Typecheck strict + ESLint frontend | ISO 25010 | ✅ |
| T6.4 | Pipeline unifiée (backend + frontend + sécurité) | DORA | ✅ |
| T6.5 | Signature GPG commits + SBOM (`cyclonedx`) | NIST SSDF | 🟨 Workflow livré (secrets GPG à configurer) |
| T6.6 | Coverage gate (`pytest-cov --fail-under=70`) | DORA | ✅ |
| T6.7 | SAST Python (`bandit`) — `.bandit.yml` + CI workflow | OWASP A03/A07 | ✅ |
| T6.8 | Dependency audit (`pip-audit` + `npm audit`) — CI workflow | NIST Supply Chain | ✅ |
| T6.9 | Secrets detection (`gitleaks`) — `.gitleaks.toml` + CI workflow | OWASP A07 | ✅ |
| T6.10 | Pre-commit hooks (`pre-commit` + `husky`) | Shift-left | 🟨 Config livré (activation locale restante) |
| T6.11 | Branch protection — `CONTRIBUTING.md` + `setup_branch_protection.sh` | Governance | ✅ |
| T6.12 | Docker image scan (`trivy`) — backend + frontend + config | Container Security | ✅ |
| T6.13 | Migration linting (`squawk`) — `alembic upgrade --sql` piped | Zero-downtime | ✅ |

Prérequis : PostgreSQL et Redis accessibles en CI (services Docker).
Bloquant pour clôturer P6 : terminer T6.5/T6.10/T6.11/T6.12/T6.13.

### Plan de réparation P6 (priorisé)

| Priorité | Tâche | Action concrète | Cible |
|---------|------|------------------|-------|
| P0 | T6.5 | Configurer secrets `RELEASE_GPG_PRIVATE_KEY` + `RELEASE_GPG_PASSPHRASE` et valider une release signée | Artifact release avec `manifest.sha256.asc` présent |
| P0 | T6.10 | Activer hooks locaux: `pre-commit install` (root) + `npm run prepare` (frontend) | Commit bloqué en local si lint/secrets/format KO |
| P1 | T6.11 | Configurer branch protection GitHub (`quality-gate` requis + 1 review min) | Merge impossible sans checks verts |
| P1 | T6.12 | Ajouter scan Trivy image + config dans CI | CI rouge sur vulnérabilité CRITICAL non exemptée |
| P2 | T6.13 | Ajouter lint migrations Alembic (squawk/check custom) | Warning/échec sur migration destructive |
| P2 | Hygiène CI | Vérifier noms de status checks pour éviter ambiguïté en branch protection | Noms stables et documentés |

Fenêtre recommandée: 2 itérations (Sprint court) avant clôture P6.

---

## P7 — UI branchée sur API réelle (terminé)

| Tâche | Description | État |
|-------|-------------|------|
| T7.1 | API service authz (8 méthodes + types dans `api.ts` / `types.ts`) | ✅ |
| T7.2 | Page AuthzAdmin super_admin (policies + metrics + health) | ✅ |
| T7.3 | Route `/authz` + sidebar super-admin + menuConfig | ✅ |
| T7.4 | Backend endpoint `GET /audit/logs` (filtré par tenant) | ✅ |
| T7.5 | AuditLogs.tsx branché sur vrai endpoint (plus de proxy notifications) | ✅ |
| T7.6 | AdminPanel statique supprimé, route `/admin` retirée | ✅ |

---

## Historique : P6b — AuthZ Production-Grade (terminé)

Objectifs selon PERT :

| Tâche | Description |
|-------|-------------|
| P6b.1 | Migration Casbin CSV → SQL (table `casbin_rule`, Alembic, SQLAlchemy adapter) |
| P6b.2 | API admin policy bornée (`GET/POST/DELETE /authz/policies`, `super_admin` only) |
| P6b.3 | Observabilité AuthZ (logs structurés `deny` systématique, `request_id` propagé) |
| P6b.4 | Cache enforcer versionné (`policy_version` + invalidation lazy sans redémarrage) |
| P6b.5 | Tests shadow CSV↔SQL + runbook rollout (`shadow` → cutover `sql` → retrait CSV) |
| P6b.6 | Benchmark latence CSV vs SQL (`pytest-benchmark`, seuil p99 < 5ms) |
| P6b.7 | Rate limiting API policy (`slowapi`, max 10 mutations/min) |
| P6b.8 | Backup automatique pre-cutover (dump + restore < 1min) |

Prérequis : P6 CI verte + P5 Casbin CSV fonctionnel (acquis).
Bloquant pour P7 (les policies doivent être stables en SQL avant de valider les routes UI).

---

## Conclusion

P5/P6b sont stabilisées. Le projet dispose d'une colonne vertébrale d'autorisation unique : toute décision d'accès passe par `authorize_or_403()`, les policies sont gérées en modes `csv/sql/shadow`, et les tests AuthZ dédiés sont verts (`63 passed` sur `test_authz.py`). Aucun endpoint ne code sa logique d'accès en dur.

Risques résiduels avant production :
1. **T6.5 partiellement finalisé** (workflow SBOM/manifest en place, secrets GPG à brancher) — traçabilité supply-chain à finaliser.
2. **T6.10** (hooks configurés mais activation locale restante) — `pre-commit install` à documenter onboarding.
3. **T6.11** (branch protection script prêt, à exécuter par un admin GitHub) — `scripts/setup_branch_protection.sh`.
