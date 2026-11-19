# [Innovateur] Éléments 11 et 12 — arbre hiérarchique et organigramme enrichi

- **Statut** : EN COURS (tests Docker en attente du créneau QA)
- **Branche** : `feat/v12-11-12-hierarchy-tree`, partie de `feat/post-rc1-277-my-team` (#285) ; re-ciblage sur `main` après fusion de #285
- **Effort** : 1 h-s (0,5 + 0,5)

## Élément 11 — `GET /api/v1/users/{id}/hierarchy-tree?depth=1..6`

- `depth` vaut 2 par défaut ; hors bornes : 422.
- Réponse : `{root: Node}`, avec Node = `{id, full_name, matricule, role_label, reports_count, children}`.
  - `children = null` : pas encore chargé (`reports_count > 0`). On rappelle la route avec ce nœud pour racine.
  - `children = []` : aucun subordonné visible.
- **Droits** (règle #285) :
  - sans `users:read`, on voit soi et ses N-1, rien au-delà ;
  - les N-1 apparaissent avec `reports_count = 0` et `children = []`, donc l'existence d'un N-2 n'est pas révélée ;
  - toute autre racine renvoie 404 (#247).
- **Plafond de 200 nœuds**, racine comprise.
  - Parcours en largeur : on compte d'abord, puis on ne charge que les équipes qui tiennent dans le reste.
  - Une équipe trop grande reste à `children = null`, à déplier ensuite.
  - Un cycle de rattachement ne boucle pas.
- Code : `app/services/hierarchy_tree.py` (logique pure, testée sans base) et la route dans `endpoints/users.py`.

## Élément 12 — `GET /api/v1/org-units/tree` enrichi

- Chaque nœud ajoute :
  - `users_count` : membres **actifs rattachés directement** à l'unité, sans cumul des sous-unités ;
  - `head {id, full_name}` ou `null`.
- **Responsable déduit, sans migration** (règle commentée dans `app/services/org_unit_staff.py`) :
  - un candidat est un membre actif dont le N+1 n'est pas membre actif de la même unité ;
  - exactement un candidat : c'est le responsable ;
  - aucun ou plusieurs (unité vide, cycle, intérim, rattachements manquants) : `null`, on ne devine pas.
  - Limite connue : un membre seul rattaché ailleurs est affiché comme responsable.
- **Droits inchangés** :
  - l'auditor garde l'arbre complet du tenant ;
  - manager et reader restent bornés à leur unité.
- `/spaces/tree` est inchangé : son schéma `OrgUnitTreeNode` n'est pas touché, et l'élément 12 a son propre `OrgUnitStaffTreeNode`.
- **Suite** : périmètre de `unit_admin` sur l'organigramme à trancher avec l'élément 13.

## Commits

| Commit | Contenu |
| --- | --- |
| 1c65ef2 | Élément 11 : service, schémas, route, tests unitaires et API |
| 839dd93 | Élément 12 : règle du responsable, schéma, route, tests unitaires et API |

## Vérifications

| Vérification | Résultat |
| --- | --- |
| pre-commit (ruff, ruff-format, bandit, secrets) | OK |
| pytest `tests/services/test_hierarchy_tree.py`, `tests/services/test_org_unit_staff.py` | à lancer (Docker, go QA) |
| pytest `tests/api/test_users_hierarchy_tree.py`, `tests/api/test_org_units_staff.py`, `tests/api/test_org_units.py`, `tests/api/test_users_my_team.py` | à lancer (Docker, go QA) |

## RAIDER

- **R** :
  - le constructeur d'arbre est générique : il reçoit `can_expand`, `load_reports` et `count_reports` ;
  - la règle du responsable est une fonction pure.
- **A** : rien de propre à un tenant ou à un rôle en dur, hors des règles de droits existantes.
- **I** : lectures seules ; aucune écriture, aucune migration.
- **D** :
  - routes et schémas existants inchangés pour leurs consommateurs ; les champs ajoutés à `/org-units/tree` sont optionnels ;
  - les tests `test_org_units.py` et #285 sont à relancer.
- **Failure memory** :
  - fuite d'existence (#247) : couverte par les tests de 404 et de cascade ;
  - aucun nouvel incident.
- **E** :
  - plafond de 200 nœuds ;
  - une requête de comptage groupée par niveau, sans N+1 requêtes ;
  - la règle et les cas ambigus sont documentés.
- **Exécution ciblée** : backend seulement.
- **Reuse-first** : on adopte `_authorize_hierarchy_read` (#285) et `can_perform`. Il n'y a pas de colonne responsable, donc on construit une déduction à partir des rattachements existants.
- **Rétroactif** : marche sur les données actuelles sans reprise.
