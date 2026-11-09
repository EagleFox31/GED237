# Guide de travail — rôle `dev-backend` (GED237)

Périmètre du rôle (cf. `gestion-projet/EQUIPE_AGENTS.md`) : FastAPI/PostgreSQL + tests ; lot C
« filtres serveur », migrations, pytest dans Docker ; ne touche pas `frontend/`. Stack : FastAPI,
SQLAlchemy 2.0 async + asyncpg, PostgreSQL 16, Alembic, Redis, pytest-asyncio ; multi-tenant par
`tenant_id`. Standard RAIDER : `RAIDER.md` ; mémoire d'échecs : `DOCS/engineering/lessons-learned.md`.
Sources consultées le 2026-11-09 (liste complète en fin de document).

## Checklist avant PR

- [ ] Toute requête `select(...)` porte `tenant_id == current_user.tenant_id` **et** `deleted_at.is_(None)` (jamais déduit du client).
- [ ] `limit` borné (`Query(ge=1, le=200)`), `skip`/curseur validé ; aucune liste non bornée.
- [ ] Filtres de liste déclarés via une dépendance réutilisable (classe + `Annotated`), enum/`Literal` pour les valeurs fermées → 422 automatique.
- [ ] Tri : liste blanche de colonnes (pas de `getattr(Model, user_input)`), ordre stable (`..., id`).
- [ ] Relations chargées explicitement (`selectinload`/`joinedload`) ; aucun accès lazy hors `await` (cf. `_document_load_options()`).
- [ ] `count` séparé et uniquement si l'UI en a besoin ; `EXPLAIN (ANALYZE, BUFFERS)` joint pour toute nouvelle requête filtrée sur > 10⁴ lignes.
- [ ] Nouvel index = composite `(tenant_id, …)` ; ordre égalité → tri → intervalle ; partiel si `deleted_at IS NULL` est systématique.
- [ ] Migration Alembic : `upgrade` **et** `downgrade` réels, un seul head, `alembic check` vide, `upgrade head` rejouable (LESSON-2026-006).
- [ ] Tests : cas nominal, filtre combiné, pagination (page 1/2, dernière page vide), **tenant étranger → 0 ligne**, rôle restreint, 422 sur valeur hors contrat.
- [ ] Tests lancés dans Docker (jamais `create_all` en CI à la place de `upgrade head`), couverture ≥ 70 % (`.coveragerc`) sans tests vides.
- [ ] Aucune propriété Python dans `select()` (LESSON-2026-004) ; `model_dump(mode="json")` prudent sur FK (LESSON-2026-007).
- [ ] Mass assignment : schémas Pydantic `Create`/`Update` distincts ; `tenant_id`, `owner_id`, `id` jamais pris du corps.
- [ ] Dépendances épinglées (`==`), `pip-audit` vert ; secrets/JWT jamais loggés.
- [ ] Commits Conventional Commits (`feat(api): …`, `fix(db): …`), un sujet par commit, description PR avec section « RAIDER review ».
- [ ] Si incident ou near-miss : entrée `LESSON-2026-NNN` avec prévention vérifiable.

## 1. FastAPI — paramètres, dépendances, erreurs

**1.1 `Annotated` + `Query` pour toute contrainte.** Bornes (`ge/le`), longueur (`max_length`), motif
(`pattern`) ; FastAPI renvoie 422 avec le chemin du champ fautif. L'état actuel de `list_documents`
(`skip: int = 0, limit: int = 100` sans borne, `documents.py` l.589-592) est à corriger.
```python
limit: Annotated[int, Query(ge=1, le=200)] = 50
q: Annotated[str | None, Query(max_length=120)] = None
```
https://fastapi.tiangolo.com/tutorial/query-params-str-validations/ (2026-11-09)

**1.2 Valeurs fermées : `Enum(str)` ou `Literal`.** Remplace `document_status: Optional[str]` par un
enum partagé avec le modèle ; une valeur inconnue devient un 422 au lieu d'un filtre silencieusement vide.
```python
class DocStatus(str, Enum): draft = "draft"; validated = "validated"; archived = "archived"
status: Annotated[DocStatus | None, Query(alias="status")] = None
```
https://fastapi.tiangolo.com/tutorial/path-params/#predefined-values (2026-11-09)

**1.3 Une classe-dépendance par famille de filtres.** `Annotated[DocumentFilters, Depends()]`
regroupe filtres + pagination + tri, documente OpenAPI et se réutilise sur `/`, `/workspace`, `/search`.
```python
class DocumentFilters:
    def __init__(self, status: DocStatus | None = None, org_unit_id: UUID | None = None,
                 q: Annotated[str | None, Query(max_length=120)] = None,
                 sort: Literal["created_at", "-created_at", "title"] = "-created_at",
                 limit: Annotated[int, Query(ge=1, le=200)] = 50,
                 skip: Annotated[int, Query(ge=0, le=10_000)] = 0): ...
```
https://fastapi.tiangolo.com/tutorial/dependencies/classes-as-dependencies/ (2026-11-09)

**1.4 `response_model` enveloppé pour les listes.** Renvoyer `{"items": [...], "total": n|null,
"next_cursor": ...}` plutôt que `List[DocumentRead]` : ajouter un champ plus tard ne casse pas le contrat
(RAIDER « Durable »). Versionner par préfixe `/api/v1` ; un changement de forme = nouveau champ optionnel
ou `/v2`, jamais une mutation silencieuse. Transition : nouveau endpoint ou paramètre `envelope=true`
tant que le front consomme `List[DocumentRead]`.
https://fastapi.tiangolo.com/tutorial/response-model/ (2026-11-09)

**1.5 Erreurs actionnables.** `HTTPException(detail=...)` avec un message qui dit quoi corriger
(« `sort` doit être l'un de … »), code stable, pas de trace SQL. Les 422 de FastAPI suffisent pour
la validation ; garder 400 pour la logique (ex. « No org unit specified », `documents.py` l.814).
https://fastapi.tiangolo.com/tutorial/handling-errors/ (2026-11-09)

## 2. SQLAlchemy 2.0 async — requêtes composables

**2.1 Construire les filtres par accumulation de `where`.** `select()` est immuable : chaque
`.where()` renvoie un nouveau statement ; on part du socle tenant + soft-delete + rôle (déjà en place
l.595-605) puis on empile les filtres optionnels.
```python
stmt = select(Document).where(Document.tenant_id == tid, Document.deleted_at.is_(None))
if f.status: stmt = stmt.where(Document.status == f.status)
if f.q:      stmt = stmt.where(Document.title.ilike(f"%{f.q}%"))
```
https://docs.sqlalchemy.org/en/20/tutorial/data_select.html (2026-11-09)

**2.2 Tri par liste blanche.** Dictionnaire `{"created_at": Document.created_at, ...}` ; le signe
`-` donne `desc()` ; toujours terminer par `Document.id` pour un ordre total (pagination stable).

**2.3 `selectinload` pour les collections, `joinedload` pour les many-to-one.** `joinedload` sur une
collection multiplie les lignes et impose `.unique()` ; `selectinload` fait un second `SELECT … IN`.
Conserver le pattern `_document_load_options()` et ne jamais accéder à une relation non chargée
(`MissingGreenlet`). Option défensive : `lazy="raise"` sur les relations du modèle.
https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html (2026-11-09)

**2.4 N+1.** Symptôme : une requête par ligne dans `echo=True`. Remède : eager load explicite ou
requête agrégée. Test de garde : compter les statements émis (`event.listen(engine.sync_engine,
"before_cursor_execute", ...)`) et asserter `<= 3` sur un listing de 50 documents.

**2.5 Pagination offset vs keyset.**
- *Offset* : `OFFSET n LIMIT k` ; simple, « aller à la page 47 », mais coût linéaire en n et
  doublons/trous si insertions entre deux pages.
- *Keyset (seek)* : `WHERE (created_at, id) < (:last_created, :last_id) ORDER BY created_at DESC,
  id DESC LIMIT k` ; coût constant, résultats stables, index `(tenant_id, created_at DESC, id DESC)`,
  mais pas de saut arbitraire et curseur à encoder (base64 du tuple).
- **Verdict GED237** : offset borné (`skip <= 10 000`) pour les listes paginées de l'UI actuelle,
  keyset pour le scroll infini et les exports ; exposer `next_cursor` dès maintenant dans l'enveloppe.
https://use-the-index-luke.com/no-offset ; https://blog.jooq.org/faster-sql-pagination-with-keysets-continued/ (2026-11-09)

**2.6 `count` séparé.** `select(func.count()).select_from(stmt.order_by(None).subquery())` sur le
même statement filtré, sans `options()` ni tri ; exécuter seulement si `with_total=true` ou en
première page. Pas de `len(result.all())`.

**2.7 Pièges `AsyncSession`.** `expire_on_commit=False` (déjà dans `get_db`/conftest) sinon chaque
attribut lu après `commit()` déclenche un refresh implicite impossible en async ; une session par
tâche concurrente ; `await db.refresh(obj, ["relation"])` pour forcer un chargement ciblé.
https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html (2026-11-09)

## 3. PostgreSQL — index, texte, isolation, identifiants

**3.1 Index composites : égalité → tri → intervalle, `tenant_id` en tête.** Le modèle a déjà
`idx_documents_status (tenant_id, status)` ; une liste filtrée sur statut et triée par date veut
`(tenant_id, status, created_at DESC, id DESC)`. Un index `(a, b)` ne sert pas un filtre sur `b` seul
(skip scan seulement à partir de PG 18).
https://www.postgresql.org/docs/16/indexes-multicolumn.html (2026-11-09)

**3.2 Index partiels.** `WHERE deleted_at IS NULL` reproduit exactement le prédicat de toutes les
requêtes de liste : index plus petit, planner plus rapide. Le prédicat de la requête doit correspondre
mot pour mot à celui de l'index.
```python
Index("idx_documents_tenant_created_live", "tenant_id", text("created_at DESC"), "id",
      postgresql_where=text("deleted_at IS NULL"))
```
https://www.postgresql.org/docs/16/indexes-partial.html (2026-11-09)

**3.3 Recherche texte : ILIKE + pg_trgm vs tsvector.**
- *ILIKE nu* : seq scan, inutilisable au-delà de quelques dizaines de milliers de lignes.
- *pg_trgm + GIN (`gin_trgm_ops`)* : accélère `ILIKE '%mot%'`, tolère les fautes, idéal pour titres,
  références, noms de dossier ; ignore la notion de mot.
- *tsvector + GIN* : lemmatisation (`french`), pertinence `ts_rank`, multi-mots ; pas de
  sous-chaîne ni de typo. GED237 a déjà `ocr_content_vector TSVECTOR`.
- **Verdict GED237** : `q` sur titre/référence → pg_trgm (migration `CREATE EXTENSION IF NOT EXISTS pg_trgm` + GIN) ;
  recherche plein texte OCR → tsvector existant ; ne pas mélanger les deux dans un même paramètre.
https://www.postgresql.org/docs/16/pgtrgm.html ; https://www.postgresql.org/docs/16/textsearch-indexes.html (2026-11-09)

**3.4 `EXPLAIN (ANALYZE, BUFFERS)` avant de conclure.** Vérifier `Index Scan`/`Index Only Scan`
sur l'index attendu, `rows` estimées vs réelles, absence de `Sort` externe. Joindre le plan dans la PR
pour toute requête nouvelle ; `ANALYZE` la table après chargement d'un jeu de test.
https://www.postgresql.org/docs/16/using-explain.html (2026-11-09)

**3.5 Contraintes CHECK nommées.** `CheckConstraint("status IN ('draft','validated','archived')",
name="ck_documents_status")` ; nommer explicitement sinon Alembic ne les suit pas (cf. 4.2).
https://www.postgresql.org/docs/16/ddl-constraints.html (2026-11-09)

**3.6 Isolation tenant : RLS vs filtre applicatif.**
- *Filtre applicatif* (actuel) : explicite, portable, testable, mais un `where` oublié = fuite.
- *RLS* : `CREATE POLICY ... USING (tenant_id = current_setting('app.tenant_id')::uuid)` ; filet de
  sécurité côté base ; exige `FORCE ROW LEVEL SECURITY`, un rôle applicatif non propriétaire, et
  `SET LOCAL app.tenant_id` à chaque transaction (pool asyncpg !) ; les contraintes FK/unicité la
  contournent (canal caché) ; plus dur à déboguer.
- **Verdict GED237** : filtre applicatif reste la source de vérité, verrouillé par un test « tenant
  étranger » obligatoire sur chaque endpoint de liste ; RLS étudiée comme filet (ADR) après le lot C,
  pas pendant.
https://www.postgresql.org/docs/16/ddl-rowsecurity.html (2026-11-09)

**3.7 UUID v4 vs v7.** v4 (actuel, `gen_random_uuid`) disperse les insertions dans le B-tree ; v7
(ordonné par temps, natif PG 18, générable côté Python avec `uuid6`/`uuid-utils` sur PG 16) réduit
fragmentation et sert directement de clé de keyset. **Verdict** : garder v4 sur les tables existantes
(aucune migration de PK), générer v7 côté application pour les nouvelles tables volumineuses
(audit, événements) ; aucune hypothèse de tri sur les ids v4.
https://www.postgresql.org/docs/18/functions-uuid.html ; https://www.credativ.de/en/blog/postgresql-en/a-deeper-look-at-old-uuidv4-vs-new-uuidv7-in-postgresql-18/ (2026-11-09)

## 4. Alembic — migrations sûres

**4.1 Réversibles et rejouables.** `downgrade` écrit et testé (`upgrade head` → `downgrade -1` →
`upgrade head`) ; `upgrade head` deux fois = no-op (RAIDER « Idempotent »). Index lourds :
`op.create_index(..., postgresql_concurrently=True)` à l'intérieur de `with op.get_context().autocommit_block():`.
https://alembic.sqlalchemy.org/en/latest/api/runtime.html#alembic.runtime.migration.MigrationContext.autocommit_block (2026-11-09)

**4.2 Autogenerate : relire toujours.** Détecte tables/colonnes/nullabilité/index nommés/FK ; ne
détecte **pas** les renommages (drop + add !), les contraintes anonymes, les expressions CHECK
modifiées, les `server_default` sans `compare_server_default=True`. Nommer toute contrainte et
tout index.
https://alembic.sqlalchemy.org/en/latest/autogenerate.html (2026-11-09)

**4.3 Expand / contract.** Changement de colonne en deux migrations : *expand* (ajouter la colonne
nullable + backfill par lots), déployer le code qui écrit les deux, puis *contract* (NOT NULL, drop
de l'ancienne). Jamais de `ALTER ... NOT NULL` sur une table chargée sans backfill préalable.
https://docs.data.ccat.uni-koeln.de/ops-db/docs/source/operations/migrations.html (2026-11-09)

**4.4 Schéma à `head` vérifié en CI.** `alembic check` (vide), `alembic heads` (une seule ligne),
puis `pytest`. Ne jamais remplacer `upgrade head` par `create_all` en CI (le `prepare_database`
des tests est un reset local acceptable, mais la CI doit d'abord migrer, cf. LESSON-2026-006).
```sh
alembic upgrade head && alembic check && test "$(alembic heads | wc -l)" -eq 1
```
https://alembic.sqlalchemy.org/en/latest/autogenerate.html#running-alembic-check-to-test-for-new-upgrade-operations (2026-11-09)

## 5. Tests — pytest-asyncio dans Docker

**5.1 Boucle d'événements.** `asyncio_mode = auto` est en place ; les engines pooled d'un test
précédent ne doivent pas fuir (d'où `NullPool` + `bind_gedrules_listener_session_to_test_engine` dans
`tests/api/conftest.py`). Toute nouvelle session « hors `get_db` » doit être rebranchée de la même façon.
https://pytest-asyncio.readthedocs.io/en/latest/concepts.html (2026-11-09)

**5.2 Fixtures transactionnelles (optionnel, perf).** Alternative au drop/create par test :
connexion + `begin()` + `async_sessionmaker(bind=conn, join_transaction_mode="create_savepoint")`,
rollback en teardown ; les `commit()` du code ne libèrent que des savepoints.
https://docs.sqlalchemy.org/en/20/orm/session_transaction.html#joining-a-session-into-an-external-transaction-such-as-for-test-suites (2026-11-09)

**5.3 Factories plutôt que seeds géants.** `db_seed` reste le socle (tenant, rôles, users) ; pour les
filtres, créer `make_document(db, tenant_id, status=..., created_at=...)` paramétrable, et des
données **dans un second tenant** pour chaque test de liste.

**5.4 Tests de contrat de liste (minimum par endpoint).**
```python
async def test_list_filters_status(auth_client, docs):   # 3 drafts, 2 validated
    r = await auth_client.get("/api/v1/documents/?status=validated&limit=10")
    assert r.status_code == 200 and {d["status"] for d in r.json()["items"]} == {"validated"}
async def test_list_rejects_unknown_status(auth_client):
    assert (await auth_client.get("/api/v1/documents/?status=bogus")).status_code == 422
async def test_list_hides_foreign_tenant(auth_client, foreign_doc):
    assert foreign_doc.id not in {d["id"] for d in (await auth_client.get("/api/v1/documents/")).json()["items"]}
async def test_pagination_is_stable(auth_client, docs):   # page1 ∪ page2 = tout, ∩ = ∅
```
Ajouter : `limit=0` et `limit=999` → 422 ; dernière page vide → 200 `items: []`.

**5.5 Docker uniquement.** `docker compose run --rm backend sh -c "alembic upgrade head && python -m
pytest -q tests/"` avec `DATABASE_URL` de la base `test_ged` ; mémoire/CPU bornés sur le conteneur
de test ; jamais le `venv` hôte comme preuve de PR.

**5.6 Couverture utile vs vaniteuse.** Seuil 70 % (`.coveragerc`) : viser les branches de filtres,
rôles et erreurs, pas les getters. Un test sans assertion sur la base ou sur le code HTTP ne compte pas.
https://coverage.readthedocs.io/en/latest/config.html (2026-11-09)

## 6. Méthodes de travail

**6.1 Characterization test d'abord.** Avant de toucher `list_documents`, figer le comportement
actuel par un test (statut, rôle, `skip/limit`) ; puis TDD : test rouge pour le filtre, code, vert,
refactor. Protège le contrat consommé par le front (RAIDER « Durable »).
https://martinfowler.com/bliki/CharacterizationTest.html (2026-11-09)

**6.2 Petits commits Conventional Commits.** `feat(api): filtres statut/org_unit sur GET
/documents`, `perf(db): index partiel tenant/created_at`, `test(api): tenant étranger sur /documents`.
Un commit = une intention réversible ; les messages décrivent le changement technique uniquement.
https://www.conventionalcommits.org/en/v1.0.0/ (2026-11-09)

**6.3 Checklist de revue PR** (à coller dans la description) : contrat non rompu ? tenant filtré ?
bornes ? index + plan ? migration réversible et `check` vide ? tests tenant étranger + 422 ?
section « RAIDER review » renseignée (couvert / N/A / dérogation).
https://google.github.io/eng-practices/review/reviewer/ (2026-11-09)

**6.4 Scripts idempotents.** Seeds en `INSERT ... ON CONFLICT DO UPDATE` sur clé naturelle ;
extensions avec `IF NOT EXISTS` ; relancer = zéro écriture.
https://www.postgresql.org/docs/16/sql-insert.html#SQL-ON-CONFLICT (2026-11-09)

**6.5 Lecture de code économe.** `grep -n` pour localiser, lire la fonction et pas le fichier ;
relire `DOCS/engineering/lessons-learned.md` (titres) avant tout travail proche d'un incident connu.

**6.6 Plan → review → apply.** Pour toute migration ou changement de contrat : plan court
(cibles, index, downgrade, tests) dans le walkthrough, relecture, puis exécution ; état distant
(base prod, protections) jamais modifié sans `plan` relu.

## 7. Sécurité backend

**7.1 OWASP API Top 10 2023 appliqué aux listes.** API1 BOLA : tout accès par id passe par
`tenant_id` + rôle (pattern `/workspace`, l.841-854) ; API3 BOPLA : schémas d'entrée sans `tenant_id`
/`owner_id`, schémas de sortie sans champs internes ; API4 consommation : `limit` borné, `skip`
plafonné, rate-limit `slowapi` déjà présent (`@limiter.limit("60/minute")`, l.964) ; API8 injection :
jamais de `text()` interpolé avec une entrée utilisateur ; ILIKE via paramètre lié uniquement
(échapper `%` et `_` du terme saisi).
https://api-security.owasp.org/editions/2023/en/0x11-t10/ (2026-11-09)

**7.2 Mass assignment.** `DocumentUpdate` avec champs explicites et `model_config =
ConfigDict(extra="forbid")` ; appliquer `payload.model_dump(exclude_unset=True)` sur une liste
blanche de colonnes.
https://docs.pydantic.dev/latest/api/config/#pydantic.config.ConfigDict.extra (2026-11-09)

**7.3 Dépendances.** `requirements*.txt` épinglés `==` (ou lock) ; `pip-audit -r requirements.txt`
dans la gate backend ; mises à jour Dependabot regroupées (DEC-2026-001).
https://pypi.org/project/pip-audit/ (2026-11-09)

**7.4 Secrets et journaux.** Jamais de JWT/OTP/`DATABASE_URL` dans les logs ni les messages
d'erreur ; `echo=False` en prod ; erreurs 500 génériques côté client, détail dans le log serveur.

## Sources

- FastAPI — Query Parameters and String Validations : https://fastapi.tiangolo.com/tutorial/query-params-str-validations/
- FastAPI — Classes as Dependencies : https://fastapi.tiangolo.com/tutorial/dependencies/classes-as-dependencies/
- FastAPI — Response Model / Handling Errors / Path params (Enum) : https://fastapi.tiangolo.com/tutorial/
- SQLAlchemy 2.0 — Asyncio Integration : https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html
- SQLAlchemy 2.0 — Using SELECT Statements : https://docs.sqlalchemy.org/en/20/tutorial/data_select.html
- SQLAlchemy 2.0 — Joining a Session into an External Transaction : https://docs.sqlalchemy.org/en/20/orm/session_transaction.html
- Use The Index, Luke — We need tool support for keyset pagination : https://use-the-index-luke.com/no-offset
- jOOQ blog — Faster SQL Pagination with Keysets, Continued : https://blog.jooq.org/faster-sql-pagination-with-keysets-continued/
- PostgreSQL 16 — Multicolumn Indexes : https://www.postgresql.org/docs/16/indexes-multicolumn.html
- PostgreSQL 16 — Partial Indexes : https://www.postgresql.org/docs/16/indexes-partial.html
- PostgreSQL 16 — pg_trgm : https://www.postgresql.org/docs/16/pgtrgm.html
- PostgreSQL 16 — Text Search Indexes : https://www.postgresql.org/docs/16/textsearch-indexes.html
- PostgreSQL 16 — Using EXPLAIN : https://www.postgresql.org/docs/16/using-explain.html
- PostgreSQL 16 — Row Security Policies : https://www.postgresql.org/docs/16/ddl-rowsecurity.html
- PostgreSQL 16 — INSERT ... ON CONFLICT : https://www.postgresql.org/docs/16/sql-insert.html
- PostgreSQL 18 — UUID Functions (uuidv7) : https://www.postgresql.org/docs/18/functions-uuid.html
- credativ — UUIDv4 vs UUIDv7 in PostgreSQL 18 : https://www.credativ.de/en/blog/postgresql-en/a-deeper-look-at-old-uuidv4-vs-new-uuidv7-in-postgresql-18/
- Aiven — Different ways to search text in PostgreSQL : https://aiven.io/blog/different-ways-to-search-text-in-postgresql
- Alembic — Auto Generating Migrations (incl. `alembic check`) : https://alembic.sqlalchemy.org/en/latest/autogenerate.html
- Alembic — Runtime API (autocommit_block) : https://alembic.sqlalchemy.org/en/latest/api/runtime.html
- CCAT ops-db — Database Migrations (expand/contract) : https://docs.data.ccat.uni-koeln.de/ops-db/docs/source/operations/migrations.html
- pytest-asyncio — Concepts : https://pytest-asyncio.readthedocs.io/en/latest/concepts.html
- coverage.py — Configuration reference : https://coverage.readthedocs.io/en/latest/config.html
- Martin Fowler — Characterization Test : https://martinfowler.com/bliki/CharacterizationTest.html
- Conventional Commits 1.0.0 : https://www.conventionalcommits.org/en/v1.0.0/
- Google Engineering Practices — Code Review : https://google.github.io/eng-practices/review/reviewer/
- OWASP API Security Top 10 (2023) : https://api-security.owasp.org/editions/2023/en/0x11-t10/
- Pydantic — ConfigDict.extra : https://docs.pydantic.dev/latest/api/config/
- pip-audit : https://pypi.org/project/pip-audit/
- Mergify — Application vs database: where should permissions live : https://mergify.com/blog/application-vs-database-where-should-permissions-live
