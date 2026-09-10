# Contract conformance checks

The checks use the public API only. Set `BASE_URL` to switch targets; no test
code needs to change.

```bash
# Prism mock (start Prism separately using the root openapi.yaml)
BASE_URL=http://127.0.0.1:4010/v1 npm run test:contract

# Real service
BASE_URL=http://127.0.0.1:3000/v1 npm run test:contract
```

`test:contract` is deliberately stateless, so it can run against both Prism
and the real service. It checks a successful collection response and RFC 9457
responses for invalid input.

Idempotency requires persistent storage and therefore runs only against the
real service:

```bash
BASE_URL=http://127.0.0.1:3000/v1 npm run verify:idempotency
# or
BASE_URL=http://127.0.0.1:3000/v1 bash scripts/verify_idempotency.sh
```

The verification submits the same request twice with one generated key (both
responses must be `201` and have the same rental ID), then changes the payload
with the same key (must return `409` and `idempotency-key-reuse`).
