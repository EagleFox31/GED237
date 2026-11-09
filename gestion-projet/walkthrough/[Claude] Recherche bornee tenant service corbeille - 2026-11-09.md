# [Claude] Recherche bornée (tenant, périmètre service, corbeille exclue) — 2026-11-09

> Statut : EN REVUE
> Session : ged-dev-backend
> Référence : DEC-2026-002 ordre 2 ; `AUDIT.md` recherche ; `gestion-projet/EQUIPE_AGENTS.md`
> Branche : `fix/search-scoped` (worktree `../GED237-search`)
> Guide appliqué : `gestion-projet/dev-backend/GUIDE_BACKEND_BD.md`

## Ce qui va être fait

`GET /api/v1/search/` ne filtrait que sur `tenant_id` : un lecteur voyait les documents des autres
services et les documents en corbeille remontaient. Aligner la recherche sur le périmètre de lecture
de `GET /documents` et exclure la corbeille, avec des tests qui le prouvent.

## Changements

| Fichier | Changement |
|---|---|
| `backend/app/core/search/interfaces.py` | `SearchQuery` : `scope_org_unit_id`, `scope_owner_id`, `include_deleted=False` (périmètre décidé par l'appelant, filtres utilisateur ne peuvent que restreindre). |
| `backend/app/core/search/postgres_engine.py` | Filtre `deleted_at IS NULL` sauf `include_deleted` ; filtres de périmètre ; **correctif latent** : `doc.category` n'existait pas → `AttributeError` dès le premier résultat ; code catégorie sélectionné via jointure `DocumentCategory`, filtre `category` sur `DocumentCategory.code`. |
| `backend/app/api/v1/endpoints/search.py` | Périmètre selon le rôle, mêmes constantes que `documents.py` : rôles tenant-wide → tenant ; `manager`/`reader` → leur unité ; sinon → propriétaire. |
| `backend/tests/api/test_search_scope.py` | 5 tests : corbeille jamais retournée ; rôle unité borné à son unité et `org_unit_id` étranger ne l'élargit pas ; rôle tenant voit le tenant sans la corbeille ; autre tenant → 0 ; code catégorie exposé + filtre catégorie (régression). |
| `backend/pip-audit-ignore.txt` + `.github/workflows/security.yml` | Exception datée (expire 2026-12-15) sur les 6 avis PYSEC starlette 0.48.0 (12 lignes pip-audit, 6 identifiants), lue par le job pip-audit via `--ignore-vuln`. |
| Walkthrough Lot C | Statut → DONE (#38 fusionnée, c7fc5bd). |
| `DOCS/engineering/lessons-learned.md` | LESSON-2026-022 : tests de recherche sans résultat = vert trompeur ; prévention : un test par moteur avec des données qui doivent remonter. |

## Constats hors périmètre (à décider)

- **DEBUG** : `core/config.py:15` → `DEBUG: bool = True` par défaut et `docker-compose.yml:110` → `DEBUG: "true"`.
  Avec cette valeur, slowapi passe à 1000/min sur login/OTP (`auth.py:35/71/98`) au lieu de 5/min.
  Toute pile de démo issue de ce compose tourne donc **sans** limitation réelle : passer `DEBUG: "false"`
  (et défaut `False`). Accepté par le PO dans les amendements de DEC-2026-002 → PR séparée juste après celle-ci.
- `postgres_engine.py` : le repli `title ILIKE %q%` n'échappe pas `%`/`_` (pas une faille, un résultat
  élargi). Réutiliser `_escape_like` de Lot C si on veut le corriger.

## Preuves

- Tests ciblés en conteneur (`test_search_scope.py` + `test_search.py`) : 7 passed.
- Suite Docker complète (2026-11-09) : **248 passed** (243 + 5 nouveaux), 9 warnings, 11 min 22 ; couverture 85,30 % (gate 70 %).
- `test_search.py` historique inchangé et vert ; lint/format via pre-commit (ruff v0.6.9) au commit.
