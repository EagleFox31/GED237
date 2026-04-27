# Plan De Réparation GED237 (Checklist Exécutable)

## Objectif
- [ ] Backend démarre sans erreur d'import ni de migration.
- [ ] Authentification front/back alignée et fonctionnelle (login + OTP + refresh).
- [ ] Flux documents opérationnel (`upload`, `liste`, `update statut`, `suppression`) avec règles de droits.
- [ ] Build frontend et tests backend exécutables en local et en CI.

## Ordre D'Exécution Recommandé

### Phase 0 - Stabilisation Environnement (P0)
- [x] Réinstaller les dépendances frontend proprement (`node_modules`, lockfile si nécessaire) pour corriger l'erreur Rollup.
- [x] Vérifier `VITE_API_URL` et la config `base` Vite selon l'environnement local.
- [x] Installer les dépendances backend manquantes dans l'environnement virtuel actif.
- [x] Ajouter `pytest`, `pytest-asyncio`, `ruff`, `mypy` au workflow local.

### Phase 1 - Redémarrage Backend Sans Casse (P0)
- [x] Corriger l'import `get_current_user` cassé dans `backend/app/api/v1/endpoints/documents.py`.
- [x] Implémenter une dépendance `get_current_user` robuste dans `backend/app/core/dependencies.py`.
- [x] Remplacer les dépendances d'endpoint pour utiliser la dépendance centralisée.
- [x] Vérifier le démarrage API (`uvicorn app.main:app --reload`).

### Phase 2 - Migration Base De Données Bloquante (P0)
- [x] Corriger la contrainte `UNIQUE(hierarchy_level)` incohérente avec les rôles existants.
- [x] Aligner le modèle SQLAlchemy `Role` avec la décision de migration.
- [x] Rejouer les migrations sur base fraîche et valider le seed.
- [x] Vérifier que les rôles (`UNIT_ADMIN`, `AUDITOR`, etc.) sont insérables sans conflit.

### Phase 3 - Contrat Auth Front/Back (P0)
- [x] Unifier le payload login côté frontend avec le schéma backend (`institution`, `matricule`, `password` JSON).
- [x] Adapter la logique frontend au flow réel: `login -> session_token`, `verify-otp -> access/refresh`.
- [x] Corriger le stockage des tokens (`access_token`, `refresh_token`) et l'usage dans les headers.
- [x] Ajouter refresh automatique via interceptor (ou wrapper fetch centralisé).
- [x] Tester manuellement: login invalide, login valide, OTP invalide, OTP valide, refresh expiré.

### Phase 4 - Contrat Documents Et Workflow (P0/P1)
- [ ] Aligner les types frontend avec les schémas backend de document.
- [ ] Valider `upload` multipart (file + metadata) de bout en bout.
- [ ] Valider la transition de statuts (`draft -> in_review -> validated/rejected -> signed -> archived`).
- [x] Empêcher les transitions invalides côté backend (règle métier centralisée).
- [ ] Vérifier permissions de mise à jour/suppression selon propriétaire + rôle.

### Phase 5 - Sécurité Multi-Tenant Et Autorisation (P1)
- [ ] Appliquer systématiquement le filtre `tenant_id` sur toutes les lectures/écritures.
- [ ] Introduire une couche de policy d'autorisation (rôle + action + ressource).
- [ ] Vérifier qu'un utilisateur ne peut pas accéder à un document d'un autre tenant.
- [ ] Ajouter audit minimal sur actions sensibles (auth, delete, changement statut).

### Phase 6 - Qualité, CI & DevSecOps (P1)
- [x] T6.1 : Seed CI injectable (`TEST_DATABASE_URL`, `REDIS_URL` obligatoires).
- [x] T6.2 : Pipeline CI backend (pytest + services Docker PostgreSQL/Redis).
- [x] T6.3 : Typecheck strict + ESLint frontend.
- [x] T6.4 : Pipeline unifiée (`ci.yml` → backend + frontend + security + gate).
- [ ] T6.5 : Signature GPG commits + SBOM (`cyclonedx`).
- [x] T6.6 : Coverage gate (`pytest-cov --fail-under=70`).
- [x] T6.7 : SAST Python (`bandit`) — `.bandit.yml` + `security.yml` CI.
- [x] T6.8 : Dependency audit (`pip-audit` + `npm audit`) — `security.yml` CI.
- [x] T6.9 : Secrets detection (`gitleaks`) — `.gitleaks.toml` + `security.yml` CI.
- [x] T6.10 : Pre-commit hooks (`pre-commit` + `husky`/`lint-staged`).
- [x] T6.11 : Branch protection — `CONTRIBUTING.md` + `setup_branch_protection.sh`.
- [x] T6.12 : Docker image scan (`trivy`) — backend + frontend + config dans `security.yml`.
- [x] T6.13 : Migration linting (`squawk`) — `alembic upgrade --sql` dans `backend.yml`.

### Phase 6b - AuthZ Production-Grade (P1)
- [ ] P6b.1 : Migrer source Casbin de `policy.csv` vers table SQL (`casbin_rule`, migration Alembic).
- [ ] P6b.2 : API admin policy bornée (`GET/POST/DELETE /authz/policies`, `super_admin` only, type `p`).
- [ ] P6b.3 : Logging structuré AuthZ (`deny` systématique, `allow` sensible, `request_id` propagé).
- [ ] P6b.4 : Cache enforcer avec `policy_version` + invalidation lazy sans redémarrage.
- [ ] P6b.5 : Tests + Runbook rollout (`shadow` → analyse → cutover `sql` → retrait CSV).
- [ ] P6b.6 : Benchmark latence CSV vs SQL (`pytest-benchmark`, seuil p99 < 5ms).
- [ ] P6b.7 : Rate limiting API policy (`slowapi`, max 10 mutations/min, block bulk).
- [ ] P6b.8 : Backup automatique pre-cutover (dump CSV + `pg_dump casbin_rule`, restore < 1min).

### Phase 7 - Conversion Maquettes -> Données Réelles (P2)
- [x] Brancher les pages profil sur les endpoints réels progressivement.
- [x] Remplacer mocks statiques par appels API dans `dashboard`, `audit`, `rules`.
- [x] Page AuthzAdmin super_admin (policies CRUD + metrics + health) branchée sur `/authz/*`.
- [x] Endpoint `GET /audit/logs` + AuditLogs branché sur vrai endpoint (plus de proxy notifications).
- [x] AdminPanel statique supprimé. Route `/admin` retirée.
- [x] Sidebar super-admin avec menuConfig dédié.
- [x] Zero module "UI only" restant — 100% branché sur API réelle.

## Design Patterns À Utiliser
- [ ] **Service + Repository (backend)**: routes minces, logique métier en service, SQL en repository.
- [ ] **Policy-Based Authorization**: règles d'accès centralisées (évite duplication dans les endpoints).
- [ ] **State Machine Document**: transitions de statut explicites et validées.
- [ ] **Adapter DTO (frontend)**: mapper réponses API vers types UI pour découpler l'interface du backend.
- [ ] **Feature-Based Front Structure**: modules `auth`, `documents`, `workflows`, `admin` avec frontières claires.

## Bibliothèques Qui Accélèrent

### Backend
- [ ] `pytest`
- [ ] `pytest-asyncio`
- [ ] `pytest-cov`
- [ ] `httpx` (tests d'API)
- [ ] `factory-boy`
- [ ] `faker`
- [ ] `ruff`
- [ ] `mypy`
- [ ] `pycasbin` (optionnel recommandé pour RBAC/ABAC)

### Frontend
- [ ] `@tanstack/react-query`
- [ ] `react-hook-form`
- [ ] `zod`
- [ ] `axios` (ou wrapper fetch + interceptors)
- [ ] `react-router-dom`
- [ ] `vitest`
- [ ] `@testing-library/react`
- [ ] `playwright`
- [ ] `openapi-typescript` (génération de types depuis OpenAPI)

## Bonnes Pratiques Pour Accélérer Sans Dette
- [ ] Contract-first: figer les payloads API avant implémentation UI.
- [ ] Vertical slices: livrer un flux complet avant d'en ouvrir un autre.
- [ ] Definition of Done stricte: code + tests + logs + doc endpoint.
- [ ] Migrations non destructives: pas de modification en place d'une migration déjà appliquée en environnement partagé.
- [ ] Seed data stable: jeux de données et identifiants de test déterministes.
- [ ] PR petites et fréquentes: review plus rapide, rollback plus simple.
- [ ] Logs structurés (`request_id`, `user_id`, `tenant_id`) sur endpoints critiques.

## Validation Finale (Go/No-Go)
- [ ] `backend` démarre et expose `/health`, `/api/docs`.
- [ ] Login OTP complet fonctionne depuis le frontend.
- [ ] Upload + validation manager + mise à jour de statut fonctionnent.
- [ ] Aucun accès cross-tenant possible en test.
- [ ] CI verte (lint + tests + build).
