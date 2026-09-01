# Backend engineering patterns

This folder turns production and CI failures into reusable engineering rules.

The loop is deliberately simple:

1. **Observe the failure** from the real CI log.
2. **Identify the failure class**, not only the failing line.
3. **Fix the root cause** without weakening authorization, migrations, tests, or coverage gates.
4. **Add a regression test** that expresses the public or persistence contract.
5. **Record the pattern** here when it can recur in another module or another backend.

These patterns are intended for FastAPI + SQLAlchemy + PostgreSQL projects, but most of the principles are framework-independent.

## Pattern catalog

- [Testing patterns](testing-patterns.md)
- [SQLAlchemy patterns](sqlalchemy-patterns.md)
- [Migration patterns](migration-patterns.md)
- [API contract patterns](api-contract-patterns.md)

## CI rule

A green test suite is not enough if the configured quality gate still fails. Keep the gate meaningful: improve the tests or design instead of lowering the threshold to make a run green.
