# Testing patterns

## Pattern: test the public contract, not an old implementation detail

**Use when:** a test fails because the API or model evolved.

Assert status codes, response fields, authorization boundaries, state transitions, and durable side effects. Do not preserve obsolete scalar fields, old error envelopes, or internal Enum objects just because an old test expected them.

Examples:
- API Enums are asserted using their serialized string value.
- Error tests assert the current problem/error contract.
- Many-to-many models are seeded using their current relationships.

## Pattern: fixtures must obey production invariants

Test data created directly in the database must obey the same normalization and relationship rules as data created through the API.

If production normalizes a code before persistence, a direct seed must use the same normalizer or a shared factory. Otherwise the test can create states that production cannot create.

## Pattern: authorize before business validation

When an endpoint requires an administrator role, business-validation tests must use an authorized client. Do not move authorization after validation merely so an unauthorized test can reach a `400`.

Use:
- unauthorized client -> assert `403`;
- authorized client + invalid business payload -> assert `400`.

## Pattern: isolate async database sessions per test engine

FastAPI dependency overrides only affect code that uses the overridden dependency. Listeners, workers, or services that open their own `AsyncSession` need explicit test wiring.

In async pytest suites, bind those independent session factories to the per-test engine. This prevents pooled asyncpg connections from leaking across event loops.

## Pattern: regression test every failure class

A fix is incomplete until a test protects the behavior that failed. Prefer a focused test close to the layer where the invariant belongs:
- serializer bug -> API contract test;
- identity-map bug -> persistence/reload test;
- migration drift -> migration check;
- async session leak -> fixture/lifecycle test.

## Pattern: use `-x` for diagnosis, then inspect ahead

`pytest -x` is useful because it gives one high-signal failure. After fixing it, inspect the remaining tests and nearby code for the same outdated assumption before starting another CI cycle.

The objective is to avoid one-failure-per-run churn.

## Pattern: coverage is a risk signal, not a target to game

Do not lower `--cov-fail-under` to make CI green. Add tests around high-risk, low-covered behavior:
- authorization and tenant isolation;
- state machines/workflows;
- file operations;
- migrations and persistence;
- classification/routing;
- failure and rollback paths.

Prefer tests that cover decisions and invariants over line-filling assertions.
