# P6 — Qualité, CI & DevSecOps

**Date : 2026-04-17**
**État actuel : P5 terminé (RBAC + multi-tenant + 63 tests AuthZ dédiés)**
**Prochaine : P6 (Qualité & CI) → P6b (AuthZ Prod) → P7 (UI)**

## Mise à jour de statut (2026-04-18)
- P6b AuthZ Production-Grade: ✅ **Terminé**
- Validation AuthZ: `63 passed` sur `tests/api/test_authz.py`
- P6 T6.4 Pipeline unifiée: ✅ **Livrée** (`.github/workflows/quality-gate.yml`)
- P6 T6.5 SBOM+manifest: 🟨 **Workflow livré** (`.github/workflows/release-integrity.yml`), secrets GPG à configurer
- P6 T6.10 Hooks shift-left: 🟨 **Config livrée** (`.pre-commit-config.yaml`, `frontend/.husky/pre-commit`), activation locale restante
- Prochaine phase prioritaire: **P7 (UI branchée sur API réelle)**.

## Plan de réparation P6 restant (court terme)

1. **T6.5 (P0)** — Signature & SBOM
- Configurer `RELEASE_GPG_PRIVATE_KEY` et `RELEASE_GPG_PASSPHRASE` dans GitHub.
- Exécuter une release test et vérifier `manifest.sha256.asc` dans les artifacts.

2. **T6.10 (P0)** — Hooks locaux
- Exécuter `pre-commit install` à la racine du repo.
- Exécuter `npm run prepare` dans `frontend/` pour activer `frontend/.husky/pre-commit`.

3. **T6.11 (P1)** — Branch protection
- Exiger le check `Unified Quality Gate`.
- Exiger 1 review minimum, interdire push direct sur `main`.

4. **T6.12 (P1)** — Trivy
- Scanner images backend/frontend + `trivy config .` en CI.
- Bloquer sur `CRITICAL` non exempté.

5. **T6.13 (P2)** — Lint migrations
- Ajouter un job de lint Alembic (squawk ou script de règles minimales).
- Bloquer/warn sur opérations destructives non encadrées.

---

## Récapitulatif terminé (P0-P5)

### ✅ P0-P3 : Fondations
- Environnement stable (venv, Rollup)
- Auth 2FA fonctionnel
- Contrat backend/frontend aligné
- Seed BDD cohérente

### ✅ P4 : Documents & Workflow
- GEDRules complet (routage auto, templates, rules)
- Machine d'état workflow verrouillée
- Permissions documents (owner + admin + locking)
- Intégration upload → workflow

### ✅ P5 : Sécurité Multi-Tenant & RBAC
- **Casbin** : Modèle RBAC, 57 policies, 7 rôles, 10 ressources
- **Façade unique** : `authorize_or_403()` centralise tout
- **Isolation tenant** : SQL scoped + cross-tenant block
- **Tests cross-tenant** : 26 tests RBAC + HTTP isolation (62 tests totaux)
- **Audit logging** : WARNING sur actions sensibles

---

## P6 : Plan détaillé

**Objectif :** Pipeline CI/CD complète avec sécurité shift-left conforme OWASP DevSecOps, DORA, NIST SSDF.

---

### T6.1 : Seed CI complète
**But :** Rendre les tests portables en environnement CI.

**Sous-tâches :**
- Supprimer fallback hardcodé `postgresql+asyncpg://postgres:Postgresql@localhost:5432/test_ged` dans `conftest.py:5`
- Rendre `TEST_DATABASE_URL` obligatoire (env var CI)
- Ajouter `REDIS_URL` injectable pour tests auth (aujourd'hui Redis local requis)
- Étendre seed avec données RBAC complètes (7 rôles, 10 ressources testées)
- Vérifier seed déterministe (même ordre ID pour tests stables)

**Livrable :** `conftest.py` CI-ready, tests passent sur PostgreSQL/Redis externes.

---

### T6.2 : Workflow CI backend (pytest)
**But :** Tests automatisés sur chaque PR.

**Sous-tâches :**
- Créer `.github/workflows/backend.yml` (ou `.gitlab-ci.yml`)
- Services Docker : `postgres:15` + `redis:7`
- Étapes : checkout → install deps → run migrations → pytest
- Timeout 15min, cache pip/pytest
- Bloquer merge si échec

**Livrable :** PR avec tests rouges → merge bloqué.

---

### T6.3 : Typecheck & Lint frontend
**But :** Qualité TypeScript/ESLint automatisée.

**Sous-tâches :**
- Installer `typescript`, `eslint`, `@typescript-eslint/*` dans `frontend/`
- Configurer `tsconfig.json` strict : `"noImplicitAny": true`, `"strict": true`
- Règles ESLint : Airbnb + React hooks
- Pipeline CI : `npm run typecheck` + `npm run lint`
- Corriger erreurs existantes si présentes

**Livrable :** `npm run typecheck && npm run lint` passe sans erreur.

---

### T6.4 : Pipeline unifiée (Build All)
**But :** Job unique backend + frontend + sécurité.

**Sous-tâches :**
- Pipeline qui enchaîne T6.2 + T6.3 + T6.6 + T6.7 + T6.8 + T6.9 + T6.12
- Build frontend : `npm run build` → artifact `dist/`
- Tests e2e optionnels (Playwright pour UI connectée)
- Notifications Slack/Discord sur échec

**Livrable :** Un commit → CI verte → artifact déployable.

---

### T6.5 : Signature & traçabilité
**But :** Traçabilité et intégrité conformes aux standards.

**Sous-tâches :**
- **Git commit signing** (`git commit -S`) avec clé GPG de l'auteur — traçabilité par commit
- **SBOM** (Software Bill of Materials) via `cyclonedx-bom` (Python) + `cyclonedx-npm` (frontend)
- Manifest signé : `manifest.sha256` + `manifest.sha256.asc`
- Pipeline CI qui génère SBOM + manifest automatiquement à chaque release

**Note :** Le watermark inline dans chaque fichier `.py/.ts` est remplacé par Git signing + SBOM. Le watermark crée du bruit dans les diffs et n'est pas un standard reconnu.

**Livrable :** Chaque release signée GPG, SBOM exportable, traçable à l'auteur.

---

### T6.6 : Code coverage gate (NOUVEAU)
**But :** Garantir un seuil minimum de couverture de test.

**Sous-tâches :**
- Configurer `pytest-cov` (déjà installé dans le venv) avec `--cov=app --cov-report=xml`
- Ajouter `--fail-under=70` dans le pipeline CI (seuil initial prudent, à monter progressivement)
- Exclure `alembic/`, `workers/tasks.py` (OCR heavy), `venv/` du calcul
- Publier le rapport de couverture comme artifact CI
- Badge coverage dans le README

**Livrable :** CI rouge si couverture < 70%. Rapport consultable par PR.

---

### T6.7 : SAST Python — Bandit (NOUVEAU)
**But :** Détection automatique de vulnérabilités dans le code Python (OWASP A03/A07).

**Sous-tâches :**
- Installer `bandit` dans les dépendances dev
- Configurer `.bandit.yml` : exclure `venv/`, `tests/`, activer checks critiques (B101-B703)
- Intégrer dans le pipeline CI : `bandit -r app/ -c .bandit.yml -f json`
- Corriger les findings existants (ex: `print()` résiduel dans documents.py)
- Seuil : zéro finding de sévérité HIGH/CRITICAL pour merger

**Livrable :** CI rouge sur vulnérabilité Python HIGH+. Rapport JSON archivé.

---

### T6.8 : Dependency audit (NOUVEAU)
**But :** Détection de CVE connues dans les dépendances (NIST SSDF / Supply chain).

**Sous-tâches :**
- Backend : `pip-audit --require-hashes -r requirements.txt`
- Frontend : `npm audit --audit-level=high`
- Intégrer les deux dans le pipeline CI
- Configurer Dependabot ou Renovate pour les mises à jour automatiques de dépendances
- Documenter les exceptions acceptées (si CVE sans impact réel)

**Livrable :** CI rouge sur CVE HIGH+ non-exemptée. Mises à jour de dépendances automatisées.

---

### T6.9 : Secrets detection (NOUVEAU)
**But :** Empêcher les fuites de secrets dans le code (OWASP A07).

**Sous-tâches :**
- Installer `gitleaks` (pre-commit + CI)
- Scanner l'historique Git complet pour secrets existants (`gitleaks detect --source .`)
- Configurer `.gitleaks.toml` : patterns pour JWT, clés API, mots de passe, DSN PostgreSQL
- Adresser le finding existant : `docker-compose.yml` contient `SECRET_KEY: dev-secret-key-change-in-production` en clair
- Migrer tous les secrets vers `.env` (déjà partiellement fait) + vérifier `.gitignore`

**Livrable :** Zéro secret dans le code. CI rouge sur nouveau secret détecté.

---

### T6.10 : Pre-commit hooks (NOUVEAU)
**But :** Shift-left — attraper les problèmes avant le push, pas seulement en CI.

**Sous-tâches :**
- Backend : installer `pre-commit` + configurer `.pre-commit-config.yaml`
  - `ruff` (lint + format Python)
  - `bandit` (security)
  - `gitleaks` (secrets)
  - `check-yaml`, `check-json`, `trailing-whitespace`
- Frontend : installer `husky` + `lint-staged` dans `package.json`
  - `eslint --fix` sur fichiers staged
  - `tsc --noEmit` (typecheck)
- Documenter l'installation pour les nouveaux développeurs (`pre-commit install`)

**Livrable :** Commit rejeté localement si lint/secrets/format échoue.

---

### T6.11 : Branch protection rules (NOUVEAU)
**But :** Gouvernance du code conforme aux standards d'équipe.

**Sous-tâches :**
- Configurer sur GitHub/GitLab :
  - PR obligatoire pour merger sur `main` (pas de push direct)
  - Au moins 1 review approuvée requise
  - Status checks obligatoires : `backend-tests`, `frontend-lint`, `security-scan`
  - Branch `main` protégée contre le force-push
  - Conversation résolue obligatoire
- Documenter le workflow Git dans `CONTRIBUTING.md`

**Livrable :** Impossible de merger sans CI verte + review.

---

### T6.12 : Docker image scan (NOUVEAU)
**But :** Sécurité des images conteneur déployées.

**Sous-tâches :**
- Installer `trivy` dans le pipeline CI
- Scanner les images `backend` et `frontend` après build : `trivy image --severity HIGH,CRITICAL`
- Configurer `.trivyignore` pour les exceptions documentées
- Ajouter scan du `docker-compose.yml` pour misconfigurations : `trivy config .`

**Livrable :** CI rouge sur vulnérabilité conteneur CRITICAL. Images scannées à chaque build.

---

### T6.13 : Migration linting (NOUVEAU)
**But :** Prévenir les migrations destructives qui causent du downtime.

**Sous-tâches :**
- Installer `squawk` (linter PostgreSQL pour migrations)
- Scanner les fichiers `alembic/versions/*.py` pour détecter :
  - `DROP COLUMN` sans backup
  - `ALTER TYPE` avec lock exclusif sur grosse table
  - `NOT NULL` sans valeur par défaut sur colonne existante
- Intégrer dans le pipeline CI sur les fichiers modifiés

**Livrable :** Warning CI sur migration potentiellement dangereuse.

---

## Ordre d'exécution P6

```
T6.1  (seed injectable)
  │
  ├──→ T6.2  (CI backend pytest)
  │      │
  │      └──→ T6.6  (coverage gate ≥70%)
  │
  ├──→ T6.3  (lint/typecheck frontend)
  │
  ├──→ T6.7  (bandit SAST)
  ├──→ T6.8  (pip-audit + npm audit)
  ├──→ T6.9  (gitleaks secrets)
  │
  └──→ T6.10 (pre-commit hooks)
         │
         └──→ T6.11 (branch protection)

T6.12 (trivy docker scan) ──┐
T6.13 (migration linting) ──┤
                             ↓
                          T6.4  (pipeline unifiée)
                             │
                             └──→ T6.5  (signature GPG + SBOM)
```

**Chemin critique :** `T6.1 → T6.2 → T6.6 → T6.4 → T6.5`

**Parallélisable dès T6.1 terminé :** T6.3, T6.7, T6.8, T6.9, T6.10 (indépendants entre eux)

---

## Prérequis techniques

- **GitHub/GitLab** : accès pour créer workflows + branch protection
- **Docker** : pour services CI + scan d'images
- **PostgreSQL + Redis** : disponibles en CI (services cloud ou self-hosted)
- **Node.js 18+** : pour frontend CI
- **GPG key** : pour Git signing + manifest

---

## Matrice de conformité

| Standard | Tâches couvrant |
|----------|----------------|
| OWASP DevSecOps | T6.7 (SAST), T6.8 (SCA), T6.9 (secrets), T6.12 (container) |
| NIST SSDF | T6.8 (supply chain), T6.5 (SBOM), T6.11 (governance) |
| DORA metrics | T6.2 (deployment frequency), T6.4 (lead time), T6.6 (change failure rate) |
| 12-Factor App | T6.1 (config via env), T6.9 (secrets externalisés) |
| ISO 25010 | T6.6 (maintainability/testability), T6.3 (reliability) |

---

## Proposition de démarrage

On commence par **T6.1** (seed injectable) — c'est immédiat et débloque tout le reste.
Puis **T6.7 + T6.8 + T6.9** en parallèle (quick wins sécurité).
Puis **T6.2 + T6.3** (pipeline principale).
