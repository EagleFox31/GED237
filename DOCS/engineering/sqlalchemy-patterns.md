# SQLAlchemy patterns

## Pattern: refresh after bulk relationship replacement

**Symptom:** the database contains the new children, but the API response still contains the old relationship values.

**Typical cause:** a loaded relationship remains in SQLAlchemy's identity map after a bulk `DELETE` followed by new `INSERT`s.

Bad assumption:

```python
await db.execute(Child.__table__.delete().where(Child.parent_id == parent.id))
# add new children
await db.commit()
return (await db.execute(select(Parent).options(selectinload(Parent.children)))).scalar_one()
```

The second query can still reuse the already-loaded collection.

Use one of these explicit refresh strategies:
- `execution_options(populate_existing=True)` on the reload query;
- `db.expire(parent, ["children"])` before re-reading;
- `await db.refresh(...)` when the relationship/loading strategy supports it.

Then add a test that replaces N children with M children and asserts the response contains exactly M current rows.

## Pattern: HTTP endpoints are wrappers, not reusable services

Do not call one route function directly from another route function when both contain authorization.

Bad shape:

```text
/spaces/tree -> authorize spaces:read -> call /org-units/tree function -> authorize org_units:read
```

This creates accidental double authorization and couples two public contracts.

Extract a non-HTTP helper/service that performs the query. Each endpoint authorizes its own resource once, then calls the shared helper.

## Pattern: one session lifecycle per ownership boundary

Code using `Depends(get_db)` follows the request session lifecycle. Code that intentionally opens its own session (listeners, background jobs, workers) owns that lifecycle and must:
- close the session deterministically;
- avoid reusing event-loop-bound connections in tests;
- expose a session factory that tests can replace.

## Pattern: reload what the response promises

After writes, reload the relationships required by the response model instead of depending on incidental in-memory state. This is especially important after:
- bulk SQL operations;
- relationship replacement;
- server defaults;
- database triggers;
- concurrent state transitions.

## Pattern: lock state-machine transitions

For workflow actions or other state machines, acquire the database lock before checking current state. Validate against the locked row, persist the transition and audit trace in one transaction, then dispatch external side effects after the durable state is known.
