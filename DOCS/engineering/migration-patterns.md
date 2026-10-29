# Migration patterns

## Pattern: schema changes ship with forward migrations

Changing an ORM column is not a complete fix. Every persisted schema change needs an Alembic migration in the same change set.

Example: if a business identifier can legitimately exceed the historical `VARCHAR(20)`, widen both the ORM declaration and the database column.

## Pattern: size identifiers for evolution

Fields containing machine/business identifiers such as audit actions, event names, permission keys, and workflow codes should have reasonable headroom. Do not size them only for today's longest value.

Prefer a documented bound such as `String(64)`/`String(128)` when the domain is extensible.

## Pattern: defensive destructive operations

Historical environments can drift. When a migration drops a known legacy index/constraint or repairs previous drift, inspect the schema or use safe conditional operations where supported instead of assuming the object always exists.

Do not make every migration silently ignore every error. Defensive behavior should be intentional and limited to known drift.

## Pattern: repair forward, do not rewrite deployed history

Once migrations have been applied outside a disposable environment, prefer a new forward repair migration over editing old migration history. This keeps environments reproducible and audit-friendly.

## Pattern: validate both application and migration state

The CI migration gate should run:

```bash
python -m alembic upgrade head
python -m alembic check
```

`upgrade head` proves a clean database can reach the target schema. `alembic check` catches ORM/schema drift that still needs a migration.

## Pattern: preserve data semantics during type changes

When changing types or timezone semantics, write the conversion explicitly. A migration is not merely DDL; it defines how existing production values are interpreted.
