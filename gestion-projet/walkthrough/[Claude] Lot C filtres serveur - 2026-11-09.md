# [Claude] Lot C — filtres serveur GET /spaces/documents — 2026-11-09

> Statut : EN REVUE
> Session : ged-dev-backend
> Référence : `AUDIT.md` Lot C items 9-10 ; `gestion-projet/EQUIPE_AGENTS.md` S1
> Branche : `feat/spaces-server-filters` (worktree `../GED237-lotc-backend`)
> Guide appliqué : `gestion-projet/dev-backend/GUIDE_BACKEND_BD.md`

## Ce qui va être fait

Porter côté serveur les filtres que `SpacesPage` appliquait côté client, avec pagination
optionnelle et total, sans casser le contrat existant.

## Contrat figé avec ged-dev-frontend (2026-11-09)

`GET /api/v1/spaces/documents` (et `GET /api/v1/documents/workspace`, même implémentation) :

| Paramètre | Type / contrainte | Colonne |
|---|---|---|
| `org_unit_id`, `recursive` | inchangés | — |
| `domain_id` | UUID | `classification_domain_id` |
| `activity_id` | UUID | `classification_activity_id` |
| `year` | int, 1900..2100 | `classification_year` |
| `status` | `draft\|in_review\|validated\|signed\|archived\|rejected\|returned` | `status` |
| `classification_status` | `pending\|classified\|needs_review\|rejected` | `classification_status` |
| `q` | texte ≤ 120, ILIKE échappé (`%`, `_`, `\`) | titre, tags, nom de domaine, nom d'activité, nom de catégorie |
| `limit` | optionnel, 1..200 ; absent = comportement historique (tout) | — |
| `offset` | ≥ 0, défaut 0 | — |

- Corps : tableau `DocumentRead` inchangé (non cassant). Tri stable `created_at desc, id`.
- En-tête `X-Total-Count` : total après filtres, avant pagination ; exposé via `expose_headers` du CORS.
- Valeur hors contrat → 422 FastAPI standard. Pas de `sort` dans ce lot.

## Comment

- `WorkspaceDocumentFilters` (dépendance FastAPI, `documents.py`) : un seul contrat réutilisé par les
  deux routes ; `apply()` empile les `where`, `paginate()` n'agit que si `limit` est fourni.
- Socle invariant conservé : `tenant_id`, `deleted_at IS NULL`, filtre de rôle existant ; les filtres
  s'ajoutent après, le `count` est calculé sur la requête filtrée (`select(func.count()).select_from(subquery)`).
- Pas de migration : les colonnes filtrées existent ; index `idx_documents_status (tenant_id, status)`
  déjà présent. Un index composite supplémentaire sera proposé seulement sur mesure (`EXPLAIN`) avec
  des volumes réels.
- Tests `backend/tests/api/test_spaces_filters.py` : historique intact, filtres unitaires, combinaison,
  échappement `%`, pagination (pages disjointes, total constant, dernière page vide), tenant étranger → 0,
  10 valeurs invalides → 422.

## Preuves

- Lint : `ruff check` + `py_compile` en conteneur sur les 4 fichiers → OK.
- Suite Docker complète (2026-11-09, avant rebase) : **243 passed** (227 existants + 16 nouveaux), 9 warnings,
  18 min 33 ; couverture 85,17 % (gate 70 %). `test_spaces.py` historique inchangé et vert.
- Branche rebasée sur `origin/main` (après fusion de #37) avant ouverture de la PR ; la CI de la PR rejoue la suite.

## Checklist RAIDER

- **Reusable** : dépendance de filtres partagée `/documents/workspace` et `/spaces/documents`.
- **Agnostic** : aucune hypothèse de tenant/UI ; paramètres optionnels.
- **Idempotent** : lecture seule ; s.o.
- **Durable / Non-regressive** : corps inchangé, `limit` absent = tout ; `test_spaces.py` existant conservé.
- **Failure memory** : s.o. sauf incident.
- **Engineering-grade** : validation 422 déclarative, bornes, échappement LIKE, total séparé.
- **Reuse-first** : pattern FastAPI « classe de dépendance pour query params » (doc officielle) ; `Literal` déjà présents dans `schemas/document.py`.
- **Retroactive** : aucune donnée touchée, pas de migration.
