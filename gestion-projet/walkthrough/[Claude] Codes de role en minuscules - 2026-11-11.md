# [Claude] Codes de rôle en minuscules — 2026-11-11

> Statut : EN REVUE
> Session : ged-dev-backend
> Branche : `fix/role-codes-lowercase` (worktree `../GED237-roles`)
> Dépend de : PR #47 (`fix/authz-collaborator`, politique en `collaborator`)
> Leçon : LESSON-2026-021 (`DOCS/engineering/lessons-learned.md`)

## Ce qui a été fait

| Fichier | Changement |
|---|---|
| `backend/alembic/versions/001_initial_schema.py` | Les sept rôles sont insérés en minuscules (`super_admin` … `auditor`). |
| `backend/alembic/versions/f0a1b2c3d4e5_lowercase_role_codes.py` | Nouvelle révision (tête `e1f2a3b4c5d6`) : repointe `users.role_id` et `workflow_template_steps.role_id` vers le jumeau minuscule, supprime les doublons, renomme le reste, pose `CHECK (code = lower(code))`. Downgrade : retire la contrainte, les données restent en minuscules. |
| `backend/app/core/authz/roles.py` | Source unique des codes (`ROLE_CODES`). |
| `backend/scripts/seed_db.py` | Assertion : les rôles semés = `ROLE_CODES`. |
| `backend/scripts/init_db.py` | Recherche des rôles en minuscules (il cherchait `SUPER_ADMIN`, `TENANT_ADMIN`, `COLLABORATOR`). |

## Pourquoi

La migration 001 semait `COLLABORATOR`, la politique Casbin, le seed, les tests et le code comparent `collaborator`. Selon la façon dont une base avait été initialisée (`alembic upgrade head` puis `init_db.py` ou l'API, ou `seed_db.py` puis `alembic stamp head`), ses utilisateurs pouvaient pointer des rôles qu'aucune ligne de politique ne connaissait. Détail dans LESSON-2026-021.

Cause probable des 403 observés en démonstration : `init_db.py` cherchait `SUPER_ADMIN`, `TENANT_ADMIN` et `COLLABORATOR`, c'est-à-dire les lignes semées par la migration 001 ; les comptes créés par ce script portaient donc un rôle qu'aucune ligne de `policy.csv` ne nomme.

## Comment vérifier (Docker uniquement)

Scénario joué avec `backend/scripts/test-in-docker.sh` (`MIGRATION_DB=mig_roles`) :

1. base vierge → `alembic upgrade head` : sept codes en minuscules, contrainte présente ;
2. second `upgrade head` : aucune révision exécutée (idempotent) ;
3. `downgrade e1f2a3b4c5d6`, injection de `COLLABORATOR` (doublon) et `LEGACY_ROLE` (sans jumeau) plus un utilisateur rattaché au doublon ;
4. `upgrade head` : doublon supprimé, utilisateur sur `collaborator`, `legacy_role` renommé ;
5. insertion de `XYZ` refusée par `ck_roles_code_lowercase`.

## Preuves

- Scénario migration (Docker, `MIGRATION_DB=mig_roles`, 2026-11-09) : 1. base vierge → `upgrade head` : `auditor,collaborator,manager,reader,super_admin,tenant_admin,unit_admin`, contrainte `ck_roles_code_lowercase` présente ; 2. second `upgrade head` : aucune révision exécutée ; 3. `downgrade e1f2a3b4c5d6` puis injection `COLLABORATOR`, `LEGACY_ROLE` et un utilisateur sur `COLLABORATOR` ; 4. `upgrade head` : `auditor,collaborator,legacy_role,manager,reader,super_admin,tenant_admin,unit_admin`, l'utilisateur pointe `collaborator` ; 5. `INSERT ... ('XYZ', ...)` refusé par `ck_roles_code_lowercase`.
- Scénario seed (Docker, `MIGRATION_DB=mig_seed`, 2026-11-09) : base vierge → `upgrade head` : 7 rôles, 7 types, 0 tenant ; `seed_db.py` : 7 rôles, 11 types, 3 tenants, 8 utilisateurs, 6 documents ; second `seed_db.py` : `[SKIP] Demo tenant MINFI already present`, compteurs identiques, identifiants des rôles inchangés (`super_admin:1 … auditor:7`) ; `POST /auth/login` `MINFI` / `MGR001` / `Mgr@2025` → 200 (`session_token`, `otp`).
- Suite ciblée (`tests/api/test_authz*.py`) : à consigner.

## Hors périmètre, à suivre

- `seed_db.py` garde `Base.metadata.create_all` en tête : le flux ci-qa actuel (`seed_db.py` puis `alembic stamp head`) en dépend jusqu'à son passage à « `upgrade head` puis seed » (annoncé juste après la fusion). À retirer ensuite : Alembic possède le schéma. Avec `stamp`, la contrainte CHECK n'est pas posée ; le chemin de référence est `upgrade head` puis seed (`DOCS/exploitation/donnees-demo.md`).
- Types d'unité : la migration 001 sème `MINISTRY`, `SEC_GEN`, … (majuscules), le seed `ministry`, `direction`, … (minuscules) ; les deux séries coexistent (11 lignes). Même famille de défaut que les rôles, à traiter à part si l'application compare ces codes.
- Service `seed` : `api` et `worker` n'en dépendent pas (l'API démarre sans attendre le seed, une trentaine de secondes) ; `--scale seed=0` reste donc possible pour une plateforme vide.
- `SEEDED_ROLE_CODES` de `tests/api/test_authz_smoke_fixes.py` (PR #47) à remplacer par `ROLE_CODES` une fois les deux branches fusionnées.

## RAIDER

- **R / A** : constante partagée, pas de code propre à une base ; la migration ne dépend que de SQL standard PostgreSQL.
- **I** : chaque étape filtre sur `code <> lower(code)` ; un second `upgrade head` est un no-op (scénario 2).
- **D** : aucune API ni format modifié ; downgrade documenté ; données existantes préservées (repointage avant suppression).
- **Failure memory** : LESSON-2026-021.
- **E** : contrainte en base plutôt que convention ; migration documentée ; scénario de vérification reproductible.
- **R (rétroactif)** : les bases déjà peuplées sont le cas premier (doublons, orphelins, utilisateurs rattachés).

## Complément (demande orchestrateur, constat ci-qa)

- `seed_db.py` convergent : rôles et types d'unité réconciliés par `code` (`upsert_by_code`, pas d'identifiant forcé), garde d'idempotence sur le tenant `MINFI`, utilisateurs et unités rattachés par code (`role_ids["manager"]`, `type_ids["direction"]`).
- Chemin de seed de la pile démo : service `seed` one-shot dans `docker-compose.yml`, derrière `migrate` (`service_completed_successfully`) ; désactivable par `--scale seed=0`. Documenté dans `DOCS/exploitation/donnees-demo.md`. Choix du service plutôt que d'une commande manuelle : la démo se lance par `docker compose up -d` sans étape à retenir.
- Scénario Docker supplémentaire : base vierge → `upgrade head` → seed → seed à nouveau → login `MGR001` 200.

## Complément 2 (demande orchestrateur, constat #54) — types d'unité en doublon

Constat : sur `main`, `seed_db.py` échoue sur une base migrée (`UniqueViolation org_unit_types_pkey`). Sur cette branche, `upsert_by_code` le faisait passer, mais le seed ajoutait quatre types en minuscules (`ministry`, `direction`, `sub_direction`, `service`) à côté des sept codes majuscules insérés par `001_initial_schema` (`MINISTRY` … `CELLULE`, seuls codes utilisés par `init_db.py`) : 11 lignes, doublons de sens.

Correction : le seed déclare désormais les codes et libellés de la migration (`MINISTRY`, `DIRECTION`, `DEPARTMENT`, `SERVICE`) et `upsert_by_code` les réconcilie en place ; sur un schéma vide (`create_all`) il les crée. Aucune autre table de référence insérée par les migrations n'est touchée par le seed.

Preuve (2026-11-09, `postgres:15-alpine` 512 Mo, Docker) : base vierge → `alembic upgrade head` (tête `f0a1b2c3d4e5`) → `seed_db.py` : code 0, `roles=7 org_unit_types=7 tenants=3 users=8 documents=6 org_units=7`, types `MINISTRY:1 … CELLULE:7` inchangés → second `seed_db.py` : `[SKIP] Demo tenant MINFI already present; reference data reconciled only.`, comptages et identifiants strictement identiques.
