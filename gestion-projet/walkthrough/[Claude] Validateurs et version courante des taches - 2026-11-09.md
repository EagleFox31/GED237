# Validateurs disponibles et version courante des tâches en attente

**Branche** : `fix/workflow-pending-validators` · **Statut** : EN REVUE · **Date** : 2026-11-09

## Contexte

Le cycle de validation côté UI (`fix/validation-cycle-ui`, dev-frontend) a besoin de deux
données que l'API ne fournissait pas (VAL-D1, VAL-D2 du plan de recette) :

- la liste des validateurs possibles du tenant pour lancer un workflow (D1) ;
- l'identifiant de la version courante du document dans chaque tâche de `GET /workflows/pending`,
  pour poster l'action sans appel supplémentaire (D2).

## Changements

| Fichier | Changement |
|---|---|
| `backend/app/schemas/workflow.py` | `DocumentSummary.current_version_id` (UUID, nullable) ; nouveau `ValidatorRead` (`id`, `full_name`). |
| `backend/app/api/v1/endpoints/workflows.py` | `GET /workflows/validators` : utilisateurs actifs du tenant appelant dont le rôle est `manager` ou `tenant_admin`, triés par nom ; requiert `documents create`. `GET /workflows/pending` renseigne `current_version_id`. |
| `backend/tests/api/test_workflow_validators.py` | 4 tests : liste bornée au tenant et aux rôles validateurs (inactifs, auteurs et autre tenant exclus) ; 403 pour un lecteur ; autre tenant → liste vide ; `current_version_id` exposé dans pending et accepté par `POST .../action`. |

Contrat transmis à dev-frontend le 2026-11-09 à 20:16 (PASSATION-dev-backend.md) : les noms
`full_name` et `current_version_id` ne changent plus sans le prévenir.

## Décisions

- Rôles validateurs figés dans `VALIDATOR_ROLE_CODES = ("manager", "tenant_admin")` : la politique
  Casbin n'a pas de notion de « peut valider » ; la constante est le seul point à modifier.
- L'autorisation du listing s'appuie sur `documents create` : qui peut déposer un document peut
  choisir son validateur ; aucun nouveau couple ressource/action dans la politique.
- `current_version_id` nullable : un document sans version (ancienne donnée) ne casse pas la liste.

## Preuves

- `tests/api/test_workflow_validators.py` + `tests/api/test_workflows.py` en Docker (`test-in-docker.sh`) : 19 passed, 8 warnings, 1 min 04 (2026-11-09 soir).
- pre-commit (ruff, ruff-format, bandit, gitleaks) : vert.

## Hors périmètre

- Choix du validateur par unité organisationnelle (filtre `org_unit_id`) : non demandé par l'UI.
- Pagination du listing : volumes démo et V1 très en deçà d'un besoin de pagination.

## RAIDER

- **R / A** : constante de rôles, requête ORM standard, aucun identifiant codé en dur.
- **I** : lecture seule, aucune écriture.
- **D** : champ ajouté nullable, aucune réponse existante modifiée ; `test_workflows.py` rejoué.
- **Failure memory** : aucun incident ; pas de nouvelle leçon.
- **E** : autorisation explicite par `authorize_or_403`, tri déterministe, tests d'isolation tenant.
- **Change-scoped** : backend et tests uniquement.
- **R (rétroactif)** : documents sans version courante tolérés.
