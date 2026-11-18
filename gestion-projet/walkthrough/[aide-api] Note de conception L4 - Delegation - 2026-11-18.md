# Note de conception L4 — Délégation pendant une absence (aide-api, 18/11)

- Base : `feat/v11-api-delegation`, empilée sur la PR #429 (81364027).
- Décision : DEC-2026-007, § 2 et § 5. Le fichier vit sur la branche des documents de scénario : `gestion-projet/decisions/DEC-2026-007 - Delegation pendant une absence.md`.

## Constats préalables

- **Aucune action de circuit n'est journalisée aujourd'hui.** Les libellés `workflow_approved`, `workflow_rejected` et `workflow_returned` existent dans `audit.py`, mais aucun code n'écrit ces lignes. Pour tracer « par X au nom de Y », il faut donc ajouter cette écriture dans `SubmitWorkflowActionUseCase`.
- **Quand le chef de service s'absente, seul le `tenant_admin` peut désigner son intérimaire.** Le créateur d'une délégation ne peut être ni l'absent ni l'intérimaire (DEC § 2.1).
- **Pas de contrainte d'exclusion PostgreSQL.** Elle exigerait l'extension `btree_gist`, que n'installe ni Alembic ni le `create_all` des tests. Le chevauchement est donc contrôlé par l'application, avec un verrou sur la ligne de l'agent absent.

## 1. Modèle de données et migration

### Table `delegations`

Classe `Delegation(Base, UUIDMixin)`, dans `backend/app/models/delegation.py`.

| Colonne | Type | Règle |
|---|---|---|
| `tenant_id` | UUID | FK `tenants.id` CASCADE, NOT NULL, index |
| `org_unit_id` | UUID | FK `org_units.id`, NOT NULL. Service de l'agent absent, figé à la création |
| `delegator_id` | UUID | FK `users.id` CASCADE, NOT NULL. L'agent absent (Y) |
| `delegate_id` | UUID | FK `users.id` CASCADE, NOT NULL. L'intérimaire (X) |
| `created_by`, `revoked_by` | UUID | FK `users.id` SET NULL |
| `starts_at`, `ends_at` | timestamptz | NOT NULL. Période semi-ouverte [début, fin) |
| `revoked_at` | timestamptz | NULL |
| `created_at` | timestamptz | `server_default=now()` |

Contraintes et index, déclarés dans `__table_args__` :
- `ck_delegations_period` : `ends_at > starts_at`.
- `ck_delegations_distinct_users` : `delegator_id <> delegate_id`.
- Index partiel `(delegate_id, ends_at)` WHERE `revoked_at IS NULL`. C'est le chemin chaud de la clause.
- Index `(delegator_id, starts_at, ends_at)`, pour le contrôle de chevauchement.
- Index `(tenant_id, org_unit_id)`, pour la liste.

Il faut aussi importer le modèle dans `app/models/__init__.py`, sinon `create_all` ne crée pas la table.

### Journal : `audit_logs.on_behalf_of`

- Nouvelle colonne UUID nullable, FK `users.id` SET NULL.
- Index partiel `(on_behalf_of, created_at)` WHERE `on_behalf_of IS NOT NULL`.

### Migration `7680f303299d`

- Identifiant tiré au hasard (LESSON-2026-068).
- `down_revision` provisoire : a7c8d9e0f1b2. À rechaîner sur la tête de main au moment de la fusion. Le test de tête unique le signale.
- La migration ne modifie aucune donnée existante.
- Le downgrade supprime la colonne, les index et la table (DEC § 6).

### Une seule délégation active par agent absent

À la création :
1. verrouiller la ligne de l'agent absent avec `SELECT … FOR UPDATE` ;
2. chercher un chevauchement : `revoked_at IS NULL AND starts_at < :fin AND ends_at > :début`.

Un même intérimaire peut couvrir plusieurs absents.

## 2. Une seule source de vérité : `services/workflow_assignee.py`

Ce module n'importe que des modèles, il ne crée donc aucun cycle d'import. Il expose quatre fonctions :

- `active_delegators(user)` : sous-requête des `delegator_id` dont la délégation vers `user` est active à `now()`, dans le même tenant.
- `_pending_assignee_clause(user)` : signature inchangée. Vraie si `assigned_to = user.id` ou si `assigned_to` fait partie de `active_delegators(user)`.
- `actionable_step_clause(user)` : la clause précédente, plus `status = 'current'`.
- `resolve_step_actor(db, user, step)` renvoie `(peut_agir, au_nom_de)` :
  - si l'utilisateur est l'assigné : `(True, None)`, sans requête ;
  - sinon : une requête sur l'étape avec la clause ; si elle trouve l'étape, `(True, step.assigned_to)`.

Deux propriétés découlent de ce choix :
- **Fin automatique et révocation immédiates.** La comparaison à `now()` se fait dans la requête, sans tâche planifiée.
- **Pas de redélégation.** La requête n'est jamais récursive, donc la délégation n'est pas transitive.

### Branchements

- **`endpoints/workflows.py`** : la clause est importée depuis le service et réexportée sous le même nom, car `get_my_workflow_counters` (B) l'importe. La liste des tâches et les compteurs suivent sans autre changement.
- **`endpoints/documents.py`, `_has_workflow_step_access`** : la condition devient « (assigné ET statut qui ouvre la lecture) OU `actionable_step_clause(user)` ».
  - Par délégation, seule l'étape en cours ouvre la lecture. Les autres étapes de Y et ses autres documents restent fermés (moindre privilège).
- **`workflow_service.py`, `check_can_perform_action(..., db=None)`** : renvoie `on_behalf`.
  - Sans `db`, le comportement actuel est inchangé.
  - L'ordre des contrôles est conservé : le statut (400) passe avant le droit (403).
  - L'appel a lieu après le `FOR UPDATE` de l'étape. Si X et Y valident en même temps, le second reçoit donc 400.

## 3. Points d'accès : `endpoints/delegations.py`

Le module ne contient que les routes. Les schémas vont dans `schemas/delegation.py` et la logique dans `services/delegation_service.py`.

### Droits Casbin

Aucune nouvelle action n'est créée, le vocabulaire existant suffit :

```
p, tenant_admin, delegations, manage
p, manager, delegations, read
p, manager, delegations, create
p, manager, delegations, update
```

Ni `super_admin`, car une délégation ne traverse jamais deux institutions, ni `unit_admin`.

Périmètre :
- le manager agit dans son propre service ;
- le `tenant_admin` agit sur toute son institution.

### POST `/delegations` (201)

Codes de refus :

| Cas | Réponse |
|---|---|
| Agent absent ou d'une autre institution | 404, sans indice de son existence |
| Manager hors de son service | 403 |
| Créateur égal à l'absent ou à l'intérimaire | 403 |
| Les deux agents dans des services différents | 422 |
| Absent égal à l'intérimaire | 422 |
| Intérimaire inactif ou sans `workflows:resolve_review` | 422 |
| Dates sans fuseau, fin avant début, ou fin déjà passée | 422 |
| Chevauchement avec une autre délégation | 409 |

- Un début dans le passé est ramené à maintenant : c'est le cas d'une absence imprévue.
- Idempotence : renvoyer exactement la même délégation, encore valide, répond 200 avec l'existante. Rien n'est écrit, pas même au journal.

### GET `/delegations`

- Filtres : `status`, `delegator_id`, `delegate_id`.
- Le manager voit son service, le `tenant_admin` son institution.
- `status` est calculé : `scheduled`, `active`, `ended` ou `revoked`.

### GET `/delegations/mine`

- Renvoie les délégations actives ou à venir où l'utilisateur est l'absent ou l'intérimaire.
- Pas de contrôle Casbin : le filtre porte strictement sur l'utilisateur courant, comme `/users/me`.

### POST `/delegations/{id}/revoke` (200)

- Délégation hors périmètre : 404.
- Pose un `FOR UPDATE` sur la délégation.
- Délégation déjà révoquée ou terminée : 200, sans écriture.

### Mention à l'écran

Dans `/workflows/pending`, une tâche dont `assigned_to` n'est pas l'utilisateur courant est une tâche « au nom de ». La route de B n'a pas à changer.

## 4. Journal

- **`audit_entry`** reçoit un paramètre facultatif `on_behalf_of`. Les appels existants ne changent pas.
- **Création et révocation** : actions `delegation_created` et `delegation_revoked` sur la table `delegations`. Les détails gardent un instantané des noms et des dates.
- **Chaque action de circuit** est journalisée dans `SubmitWorkflowActionUseCase`, avant le commit. Les actions faites sans délégation le sont aussi, avec `on_behalf_of` vide, pour que l'auditeur puisse comparer.
  - La ligne porte `user_id = X`, `on_behalf_of = Y`, `table_name = documents` et `record_id = document`.
  - L'action reprend les libellés existants : `accepted` donne `workflow_approved`, `rejected` donne `workflow_rejected`, `returned` donne `workflow_returned`, `acknowledged` donne `workflow_step_completed`.
- **`audit.py`, hors des fonctions de B** :
  - ajouter les libellés de la table et des deux actions ;
  - le sérialiseur renvoie `on_behalf_of` et `on_behalf_of_name` ;
  - `_load_references` charge aussi l'utilisateur `on_behalf_of`.

## 5. Tests (en conteneur)

### `tests/api/test_delegation_access.py`

- **Paramétré sur l'état** de la délégation (active, expirée, à venir, révoquée) :
  - délégation active : la tâche est dans la liste, la lecture du document et des versions répond 200, l'action aussi ;
  - les trois autres états : rien dans la liste, lecture refusée, action en 403.
  - Variantes : intérimaire `collaborator`, et `manager` d'une autre unité.
- **Lecture limitée** : une étape de Y en attente, une étape de Y terminée, ou un document de Y sans étape ne donnent rien à X.
- **Pas de redélégation** : avec A vers B et B vers C, C ne voit rien de A.
- **Isolation** : une délégation forgée en base entre deux institutions ne donne rien.
- **Journal** : après une action de X, la ligne porte `user_id = X` et `on_behalf_of = Y`. Après une action de Y, `on_behalf_of` est vide.
- **Concurrence** : après l'action de X, celle de Y reçoit 400.

### `tests/api/test_delegations_api.py`

- **Création** :
  - périmètre : manager, autre service ou même service ; `tenant_admin` ;
  - rôles non autorisés : 403 ;
  - règles d'auto-désignation, de dates et de rôle de l'intérimaire ;
  - 409 en cas de chevauchement ; 200 sur un nouvel essai identique ; des périodes bout à bout sont acceptées.
- **Révocation** :
  - elle est idempotente ;
  - un manager d'un autre service reçoit 404 ;
  - on peut recréer une délégation après une révocation.
- **Liste** : filtres par service et par statut ; `/mine`.
- **Contraintes CHECK** : une insertion directe invalide lève `IntegrityError`.

### Non-régression

- `test_backend_engineering_patterns.py` : le chemin rapide et le refus sans `db` restent identiques.
- Relancer `test_workflows.py`, `test_document_read_by_workflow_step.py` et `test_authz*.py`.

## 6. Risques et points ouverts

### Risques

- **X perd la lecture du document après son action**, puisque l'étape n'est plus en cours. C'est voulu ; l'écran doit alors revenir à la liste.
- **Rôle de X changé en cours de délégation** : la tâche reste visible dans sa liste, mais l'action répond 403.
- **Mode `AUTHZ_BACKEND=sql`** : il faut injecter les quatre lignes Casbin en base (`scripts/restore_policies.py`).
- **Écart antérieur, hors périmètre** : `GET /workflows/document/{id}/steps` refuse un assigné qui n'est pas dans l'unité du document.

### Points ouverts (O ou PO)

- Prévenir l'intérimaire à la création et à chaque nouvelle étape.
- Durée maximale d'une délégation : aucune pour l'instant.
- Modifier les dates : pour l'instant, révoquer puis recréer.

## 7. Commits

1. Modèle, colonne `on_behalf_of` et migration.
2. Déplacement de la clause vers le service, avec réexport. Aucun changement de comportement.
3. Accès de l'intérimaire : liste, lecture, action et journal. Avec les tests d'accès.
4. Points d'accès et droits Casbin, avec leurs tests.
5. Affichage de « au nom de » dans le journal. À annoncer à B.
6. Walkthrough avec la checklist RAIDER.
