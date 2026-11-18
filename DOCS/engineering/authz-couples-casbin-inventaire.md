# Inventaire des couples (ressource, action) : décidés par Casbin seul ou avec un garde métier

Élément 13 (droits par institution), première tâche. Instruction : `gestion-projet/innovateur/instruction-element-13-droits-par-institution.md`. À relire par Q. Révisé après la relecture de l'innovateur (spaces, documents, appels dynamiques).

## Méthode

- Script réutilisable : `backend/scripts/inventory_casbin_pairs.py <backend/app>` (analyse AST, sortie JSON, lecture seule).
- Il recense les 106 appels à `authorize_or_403` / `can_perform` (83 + 23), répartis sur 17 fichiers. Les 2 appels à action variable sont dépliés en 2 couples chacun : 108 lignes, 51 couples.
- Pour chaque appel, il cherche des **gardes hors Casbin** dans la fonction, dans les aides locales qu'elle appelle (un niveau) et dans les aides **importées d'un autre module** de l'application :
  - `role_code` : `_role_code(...)`, `.role.code` ;
  - `role_set` : `ADMIN_ROLES`, `TENANT_WIDE_READ_ROLES`, `ORG_UNIT_READ_ROLES`, `VALIDATOR_ROLE_CODES`, `INSTITUTION_WIDE_ROLES` ;
  - `http403` : un `HTTPException` 403 écrit à la main ;
  - `scope` : `assert_org_unit_scope`, `tenant_guard`, `reports_scope` ;
  - `own_or_unit_cmp` : comparaison directe de `org_unit_id`, `owner_id` ou `created_by_id`.
- Les actions écrites `a if c else b`, ou lues dans une variable locale assignée une seule fois (`users.py:361` : `update_own` ou `update` ; `workflows.py:185` : `update_own` ou `manage`), sont dépliées : un couple par valeur.
- Un couple est classé selon **tous** ses appels : un seul appel gardé le sort de la classe A.
- Le contrôle d'institution et le contrôle `*_own` de la façade (`_authorize`) ne comptent pas comme garde : ils s'appliquent à tous les couples.

## Limites (à relire par Q)

- Analyse statique par motifs : un garde écrit autrement n'est pas vu (aide appelée à deux niveaux, requête filtrée par rôle sans ces motifs). Les couples de la classe A sont des **candidats** : Q rejoue un test par couple avant de les ouvrir à la surcharge.
- Reclassement manuel : `spaces:read` passe en B. `spaces.py` délègue à `list_workspace_documents` et `get_org_unit_tree`, importés de `documents.py`, qui filtrent selon `TENANT_WIDE_READ_ROLES` et `ORG_UNIT_READ_ROLES`.
- `documents:update` et `documents:delete` restent classés A (Casbin seul, puis statut et verrou) mais sont **exclus de la surcharge en V1.2** : ils chargent le document par institution seulement, alors que la lecture est limitée à l'unité pour manager et reader. Ouvrir ces droits donnerait une écriture plus large que la lecture. Aujourd'hui aucun rôle ne cumule ce défaut (seuls super_admin, tenant_admin et unit_admin les ont, et ils lisent toute l'institution). Le test d'invariant « écriture ⊆ lecture » protège toute future ouverture.
- `documents:update_own` et `trash_own` passent par des aides (`_can_mutate_document`, `_can_trash_document`, `_can_manage_lock`) qui ajoutent des règles de **statut et de verrou**, pas de rôle : classe A, mais une case cochée reste bornée par l'état du document. Le contrôle du propriétaire est fait par la façade.
- `tenants:manage` sert de test « administrateur » dans `documents.py` (`/stats`), `org_units.py` et `users.py` (liste), en plus d'un `_role_code` : classe C, et exclu de toute surcharge par l'instruction.

## Classe A — Casbin est le seul contrôle (candidats à la surcharge)

Exclus malgré tout de la surcharge en V1.2 : `analytics.platform:read` et `tenants:read` (pas d'élévation vers la plateforme), `documents:update` et `documents:delete` (voir Limites). Liste retenue : 24 couples, dans `backend/app/core/authz/overrides.py`.

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
| `tenants:read` | 2 | 0 | — | collaborator, super_admin, tenant_admin |
| `workflows:resolve_review` | 2 | 0 | — | collaborator, manager, super_admin, tenant_admin, unit_admin |

## Classe B — Casbin + périmètre des données dans le code

Ouvrir le droit n'ouvre que la route : le code limite encore les lignes (unité, propriétaire, institution, rôle). Exclus de la première version.

| Couple | Appels | Dont gardés | Signaux de garde | Rôles (policy.csv, `manage` inclus) |
|---|---|---|---|---|
| `workflows:update_own` | 1 | 1 | own_or_unit_cmp | collaborator, super_admin, tenant_admin, unit_admin |
| `spaces:read` | 2 | 1 | http403, own_or_unit_cmp, role_code, role_set | auditor, collaborator, manager, reader, super_admin, tenant_admin, unit_admin |

## Classe C — garde de rôle en plus (exclus de la surcharge)

Un contrôle écrit en Python sur le code du rôle double Casbin : cocher la case ne change rien (le piège principal de l'élément 13) ou change autre chose que prévu.

| Couple | Appels | Dont gardés | Signaux de garde | Rôles (policy.csv, `manage` inclus) |
|---|---|---|---|---|
| `analytics.tenant:read` | 6 | 5 | http403, role_code, role_set | auditor, collaborator, manager, super_admin, tenant_admin, unit_admin |
| `documents:archive` | 1 | 1 | http403 | super_admin, tenant_admin |
| `documents:create` | 6 | 4 | http403, own_or_unit_cmp, role_code, role_set, scope | collaborator, manager, super_admin, tenant_admin |
| `documents:manage` | 5 | 2 | http403 | super_admin |
| `documents:read` | 2 | 2 | own_or_unit_cmp, role_code, role_set | auditor, manager, reader, super_admin, tenant_admin, unit_admin |
| `documents:read_own` | 2 | 2 | own_or_unit_cmp, role_code, role_set | collaborator, super_admin |
| `org_units:create` | 1 | 1 | http403, role_code, scope | super_admin, tenant_admin |
| `org_units:delete` | 1 | 1 | http403, own_or_unit_cmp, role_code, scope | super_admin, tenant_admin |
| `org_units:read` | 3 | 3 | http403, role_code, scope | auditor, super_admin, tenant_admin, unit_admin |
| `org_units:update` | 1 | 1 | http403, role_code, scope | super_admin, tenant_admin |
| `tenants:manage` | 8 | 6 | http403, own_or_unit_cmp, role_code, role_set, scope | super_admin |
| `tenants:update` | 1 | 1 | http403 | super_admin, tenant_admin |
| `users:create` | 1 | 1 | http403, role_code, scope | super_admin, tenant_admin |
| `users:delete` | 1 | 1 | http403, own_or_unit_cmp, role_code, scope | super_admin, tenant_admin |
| `users:read` | 4 | 2 | http403, own_or_unit_cmp, role_code, scope | auditor, super_admin, tenant_admin, unit_admin |
| `users:update` | 4 | 4 | http403, role_code, scope | super_admin, tenant_admin |
| `users:update_own` | 1 | 1 | http403, role_code, scope | super_admin, tenant_admin |
| `workflows:assign` | 1 | 1 | http403 | manager, super_admin, tenant_admin, unit_admin |
| `workflows:manage` | 3 | 2 | http403, own_or_unit_cmp | super_admin, tenant_admin, unit_admin |
| `workflows:read` | 3 | 2 | http403, own_or_unit_cmp, role_code, role_set, scope | auditor, manager, reader, super_admin, tenant_admin, unit_admin |
| `workflows:read_own` | 2 | 1 | http403, role_code, scope | collaborator, super_admin, tenant_admin, unit_admin |
