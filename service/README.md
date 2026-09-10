# Heavy Equipment Rental Backend Service

## Operations Tracking (A.3)

| Operation                           | Served by | Integration verification |
| :---------------------------------- | :-------- | :----------------------- |
| `GET /v1/equipments`                | service   | Covered by stateless contract check and DB queries |
| `GET /v1/rentals`                   | service   | Invalid-query RFC 9457 check; DB store integration |
| `POST /v1/rentals`                  | service   | Missing-key RFC 9457 check; live idempotency verification ready |
| `GET /v1/rentals/{id}`              | service   | Covered by schema validation & DB store retrieval |
| `POST /v1/rentals/{id}/inspections` | service   | DB persistence, idempotency replay, conflict & rule enforcement |

## Error Catalogue Mapping (A.6)

| Cause inside Handler                       | Status Code | Type URI                                                    |
| :----------------------------------------- | :---------- | :---------------------------------------------------------- |
| Schema / Syntax Validation Failed          | 400         | `https://api.heavyrental.co/problems/invalid-request`       |
| Resource Not Found                         | 404         | `https://api.heavyrental.co/problems/resource-not-found`    |
| Idempotency Key Reused with Different Body | 409         | `https://api.heavyrental.co/problems/idempotency-key-reuse` |
| Duplicate / Conflicting Inspection State   | 409         | `https://api.heavyrental.co/problems/inspection-conflict`   |
| Business Rule Violation (Inspection)       | 422         | `https://api.heavyrental.co/problems/inspection-rule-violation` |
| Unhandled Internal Exception               | 500         | `https://api.heavyrental.co/problems/internal-error`        |

## Integration checks

The common contract check works against Prism or the real service by changing
`BASE_URL` only. See [tests/contract/README.md](tests/contract/README.md) for
commands, and [scripts/verify_idempotency.sh](scripts/verify_idempotency.sh)
for the cURL demonstration of persisted idempotency.
Use `npm run verify:inspections` to verify inspection persistence, conflict detection, and business rules.

