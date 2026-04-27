# Task Tracker: GEDRules Routing Engine

- `[x]` **Phase 1: Foundations & Models**
    - `[x]` Créer `backend/app/models/gedrules.py` avec SQLAlchemy (`RoutingRule`, `WorkflowTemplate`, `WorkflowTemplateStep`).
    - `[x]` Créer `backend/app/models/routing_audit.py` avec `DocumentRoutingDecision`.
    - `[x]` Générer la migration Alembic pour les nouvelles tables.
    - `[x]` Créer les schémas Pydantic associés (`backend/app/schemas/gedrules.py`).

- `[x]` **Phase 2: Use Cases & Policies**
    - `[x]` Créer `backend/app/services/gedrules_service.py`.
    - `[x]` Implémenter `AssignmentPolicy` avec résolution organisationnelle stricte et fallback non structurant (Option 2: assignement `null` silencieux pour le user, tracké par audit/alarme).
    - `[x]` Implémenter l'algorithme complet de routage dans `ApplyRoutingRulesToDocumentUseCase` (Lecture `Document` -> `RoutingRule` priority -> Template -> Policy -> `WorkflowStep` creation -> Traceability Audit Log).

- `[x]` **Phase 3: Integration & Tests**
    - `[x]` Connecter l'upload/soumission du document pour déclencher le GEDRules métier au bon instant.
    - `[x]` Paramétrer `db_seed` dans `tests/conftest.py` pour un template de test et une règle par défaut.
    - `[x]` Créer un suite de tests E2E `test_gedrules.py` validant tous les chemins métier y compris les Fallbacks et les Priorités.

- `[x]` **Phase 4: Consolidation Production & Sécurité**
    - `[x]` Protéger l'accès de `gedrules.py` (Templates/Routes) avec un middleware RBAC (`_require_admin`).
    - `[x]` Assurer la stabilité Eventual Consistency de l'upload: Ne pas injecter la `_db_session` au dispatch sauf pour les tests automatiques (`sys.modules`).
    - `[x]` Fixer les contrats de mutation: `exclude_unset=True` sur les mises à jour PUT pour permettre l'effacement de contexte par `null`.
    - `[x]` Poser un garde-fou sur `update_template` et `update_rule`: Bloquer les modifications d'arbre (étapes) si le modèle est utilisé en prod ou si la règle pointe vers le vide.

- `[x]` **Phase 5: Stabilisation P0 backend (2026-04-17)**
    - `[x]` Dispatcher async : `asyncio.create_task` fire-and-forget remplacé par `asyncio.gather(_safe_call)` — listeners toujours awaités, erreurs loguées via `logging`, comportement unifié test/prod.
    - `[x]` `org_unit_id` nullable : garde HTTP 400 explicite dans `upload_new_version()` + autorisation cross-unit HTTP 403 dans `list_workspace_documents()`.
    - `[x]` Suppressions métier : `DELETE /users/{id}` bloque sur documents actifs ou workflow steps actifs (HTTP 409). `DELETE /org-units/{id}` bloque sur enfants, utilisateurs actifs, documents actifs (HTTP 409). Rôle admin requis sur les deux (HTTP 403).
