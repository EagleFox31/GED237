# API contract patterns

## Pattern: serialize domain Enums at the boundary

Domain/services may return Enum instances. Response DTOs should receive the public representation expected by the API contract.

When a schema expects a literal string, pass `enum_value.value` (or centralize the conversion) rather than relying on incidental coercion.

## Pattern: keep one error contract

Global exception handling can transform framework exceptions into a problem/error document. Tests and clients must target that final public envelope, not the pre-handler `HTTPException.detail` object.

Keep stable fields for machine handling (for example `status` and `error_code`) and a human-readable detail.

## Pattern: authorization belongs to the endpoint boundary

Every public endpoint authorizes the resource/action it exposes. Shared query/business logic should live below the HTTP layer and should not accidentally introduce a second unrelated permission check.

This keeps permissions explicit and makes internal reuse safe.

## Pattern: tenant scope is part of every lookup contract

For tenant-owned resources, query by both resource identity and tenant identity unless the code is intentionally platform-wide. Return the same not-found behavior for cross-tenant access when disclosure itself would leak information.

## Pattern: validate response models, not only request models

A route can execute successfully and still fail with `422`/response validation if the returned object shape does not match the declared response model.

Tests should exercise serialization for:
- Enums and literals;
- optional relationships;
- nested ORM models;
- dates/UUIDs;
- empty collections and missing optional fields.

## Pattern: separate authorization tests from business tests

Keep two explicit test classes of behavior:
- permission matrix: who can call the endpoint;
- business contract: what an authorized caller can/cannot do.

This prevents a `403` from hiding the business condition a test intended to exercise.
