# Inventaire des couples (ressource, action) : dÃ©cidÃ©s par Casbin seul ou avec un garde mÃ©tier

Ã‰lÃ©ment 13 (droits par institution), premiÃ¨re tÃ¢che. Instruction : `gestion-projet/innovateur/instruction-element-13-droits-par-institution.md`. Ã€ relire par Q.

## MÃ©thode

- Script rÃ©utilisable : `backend/scripts/inventory_casbin_pairs.py <backend/app>` (analyse AST, sortie JSON, lecture seule).
- Il recense les 106 appels Ã  `authorize_or_403` / `can_perform` (83 + 23, comme dans l'instruction), rÃ©partis sur 17 fichiers.
- Pour chaque appel, il cherche dans la fonction et dans les aides locales qu'elle appelle (un niveau) des **gardes hors Casbin** :
  - `role_code` : `_role_code(...)`, `.role.code` ;
  - `role_set` : `ADMIN_ROLES`, `TENANT_WIDE_READ_ROLES`, `ORG_UNIT_READ_ROLES`, `VALIDATOR_ROLE_CODES`, `INSTITUTION_WIDE_ROLES` ;
  - `http403` : un `HTTPException` 403 Ã©crit Ã  la main ;
  - `scope` : `assert_org_unit_scope`, `tenant_guard`, `reports_scope` ;
  - `own_or_unit_cmp` : comparaison directe de `org_unit_id`, `owner_id` ou `created_by_id`.
- Un couple est classÃ© selon **tous** ses appels : un seul appel gardÃ© le sort de la classe A.
- Le contrÃ´le d'institution et le contrÃ´le `*_own` de la faÃ§ade (`_authorize`) ne comptent pas comme garde : ils s'appliquent Ã  tous les couples.

## Limites (Ã  relire par Q)

- Analyse statique par motifs : un garde Ã©crit autrement (aide dans un autre module, requÃªte filtrÃ©e par rÃ´le sans ces motifs) n'est pas vu. Les couples de la classe A sont des **candidats** : Q rejoue un test par couple avant de les ouvrir Ã  la surcharge.
- Deux appels ont des arguments non constants (`users.py:361` `update_user`, `workflows.py:185` `create_workflow_steps`) : classÃ©s C.
- `documents:update`, `delete`, `update_own` et `trash_own` passent par des aides (`_can_mutate_document`, `_can_trash_document`, `_can_manage_lock`) qui ajoutent des rÃ¨gles de **statut et de verrou**, pas de rÃ´le : classe A, mais une case cochÃ©e reste bornÃ©e par l'Ã©tat du document.
- `tenants:manage` sert de test Â« administrateur Â» dans `documents.py` (`/stats`), `org_units.py` et `users.py` (liste), en plus d'un `_role_code` : classe C, et exclu de toute surcharge par l'instruction.

## Classe A â€” Casbin est le seul contrÃ´le (candidats Ã  la surcharge)

Exclus malgrÃ© tout par la contrainte Â« pas d'Ã©lÃ©vation Â» de l'instruction : `analytics.platform:read` et tout couple de `tenants`.

| Couple | Appels | Dont gardés | Signaux de garde | Rôles (policy.csv, `manage` inclus) |
|---|---|---|---|---|
| `analytics.platform:read` | 1 | 0 | — | super_admin |
| `audit_logs:read` | 2 | 0 | — | auditor, super_admin, tenant_admin |
| `categories:create` | 1 | 0 | — | super_admin, tenant_admin |
| `categories:delete` | 1 | 0 | — | super_admin, tenant_admin |
| `categories:read` | 1 | 0 | — | auditor, collaborator, manager, reader, super_admin, tenant_admin, unit_admin |
| `categories:update` | 1 | 0 | — | super_admin, tenant_admin |
| `classification_reviews:read` | 1 | 0 | — | super_admin, tenant_admin, unit_admin |
| `classification_reviews:update` | 1 | 0 | — | super_admin, tenant_admin, unit_admin |
| `classification_rules:create` | 4 | 0 | — | super_admin, tenant_admin, unit_admin |
| `classification_rules:delete` | 3 | 0 | — | super_admin, tenant_admin, unit_admin |
| `classification_rules:read` | 6 | 0 | — | super_admin, tenant_admin, unit_admin |
| `classification_rules:update` | 4 | 0 | — | super_admin, tenant_admin, unit_admin |
| `documents:delete` | 1 | 0 | — | super_admin, tenant_admin, unit_admin |
| `documents:review` | 1 | 0 | — | super_admin, tenant_admin |
| `documents:trash_own` | 1 | 0 | — | collaborator, manager, super_admin |
| `documents:update` | 3 | 0 | — | super_admin, tenant_admin, unit_admin |
| `documents:update_own` | 2 | 0 | — | collaborator, manager, super_admin |
| `gedrules.rules:create` | 1 | 0 | — | super_admin, tenant_admin |
| `gedrules.rules:delete` | 1 | 0 | — | super_admin, tenant_admin |
| `gedrules.rules:read` | 1 | 0 | — | super_admin, tenant_admin |
| `gedrules.rules:simulate` | 1 | 0 | — | super_admin, tenant_admin, unit_admin |
| `gedrules.rules:update` | 1 | 0 | — | super_admin, tenant_admin |
| `gedrules.templates:create` | 1 | 0 | — | super_admin, tenant_admin |
| `gedrules.templates:delete` | 1 | 0 | — | super_admin, tenant_admin |
| `gedrules.templates:read` | 2 | 0 | — | super_admin, tenant_admin |
| `gedrules.templates:update` | 1 | 0 | — | super_admin, tenant_admin |
| `spaces:read` | 2 | 0 | — | auditor, collaborator, manager, reader, super_admin, tenant_admin, unit_admin |
| `tenants:read` | 2 | 0 | — | collaborator, super_admin, tenant_admin |
| `workflows:assign` | 1 | 0 | — | manager, super_admin, tenant_admin, unit_admin |
| `workflows:resolve_review` | 2 | 0 | — | collaborator, manager, super_admin, tenant_admin, unit_admin |

## Classe B â€” Casbin + pÃ©rimÃ¨tre des donnÃ©es dans le code

Ouvrir le droit n'ouvre que la route : le code limite encore les lignes (unitÃ©, propriÃ©taire, institution). Ã€ exclure de la premiÃ¨re version, ou Ã  afficher avec une mention.

| Couple | Appels | Dont gardés | Signaux de garde | Rôles (policy.csv, `manage` inclus) |
|---|---|---|---|---|
| `org_units:create` | 1 | 1 | scope | super_admin, tenant_admin |
| `org_units:delete` | 1 | 1 | own_or_unit_cmp, scope | super_admin, tenant_admin |
| `org_units:update` | 1 | 1 | scope | super_admin, tenant_admin |
| `users:delete` | 1 | 1 | own_or_unit_cmp, scope | super_admin, tenant_admin |
| `users:update` | 3 | 3 | scope | super_admin, tenant_admin |
| `workflows:read` | 3 | 1 | scope | auditor, manager, reader, super_admin, tenant_admin, unit_admin |
| `workflows:read_own` | 2 | 1 | scope | collaborator, super_admin, tenant_admin, unit_admin |

## Classe C â€” garde de rÃ´le en plus (exclus de la surcharge)

Un contrÃ´le Ã©crit en Python sur le code du rÃ´le double Casbin : cocher la case ne change rien (le piÃ¨ge principal de l'Ã©lÃ©ment 13) ou change autre chose que prÃ©vu.

| Couple | Appels | Dont gardés | Signaux de garde | Rôles (policy.csv, `manage` inclus) |
|---|---|---|---|---|
| `analytics.tenant:read` | 6 | 1 | http403, role_code, role_set | auditor, collaborator, manager, super_admin, tenant_admin, unit_admin |
| `documents:archive` | 1 | 1 | http403 | super_admin, tenant_admin |
| `documents:create` | 6 | 4 | http403, own_or_unit_cmp, role_code, role_set, scope | collaborator, manager, super_admin, tenant_admin |
| `documents:manage` | 5 | 2 | http403 | super_admin |
| `documents:read` | 2 | 2 | own_or_unit_cmp, role_code, role_set | auditor, manager, reader, super_admin, tenant_admin, unit_admin |
| `documents:read_own` | 2 | 2 | own_or_unit_cmp, role_code, role_set | collaborator, super_admin |
| `org_units:read` | 3 | 3 | role_code, scope | auditor, super_admin, tenant_admin, unit_admin |
| `tenants:manage` | 8 | 5 | http403, own_or_unit_cmp, role_code, role_set, scope | super_admin |
| `tenants:update` | 1 | 1 | http403 | super_admin, tenant_admin |
| `users:None` | 1 | 1 | role_code, scope | super_admin, tenant_admin |
| `users:create` | 1 | 1 | role_code, scope | super_admin, tenant_admin |
| `users:read` | 4 | 2 | own_or_unit_cmp, role_code, scope | auditor, super_admin, tenant_admin, unit_admin |
| `workflows:None` | 1 | 1 | own_or_unit_cmp | super_admin, tenant_admin, unit_admin |
| `workflows:manage` | 2 | 1 | http403 | super_admin, tenant_admin, unit_admin |
