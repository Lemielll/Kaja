# Heavy Equipment Rental Backend Service

## Deployment

Public service: [https://kaja-service-7dp9.onrender.com](https://kaja-service-7dp9.onrender.com)

Health check: [https://kaja-service-7dp9.onrender.com/health](https://kaja-service-7dp9.onrender.com/health)

API base URL: `https://kaja-service-7dp9.onrender.com/v1`

## Authentication scope vocabulary (Session 4)

The service uses OAuth scopes as capability groups, not as a separate scope for
each endpoint. Scope checks answer whether a principal may perform an action;
object ownership checks remain a separate layer and return the same `404` for a
missing object or an object owned by another principal.

| Scope | Capability | Contractor | Warehouse admin | Field operator |
| :---- | :---------- | :---------: | :-------------: | :-------------: |
| `equipment:read` | Read equipment availability and details for scheduling. | Yes | Yes | No |
| `rentals:read` | Read rental records visible to the principal's tenant or assignment. | Yes | Yes | No |
| `rentals:write` | Create a rental contract. | Yes | No | No |
| `inspections:write` | Submit a field inspection for an assigned rental. | No | No | Yes |

### Actor capabilities

- **Contractor**: browse equipment, read owned rental records, and create a
	rental contract.
- **Warehouse admin**: browse equipment and read rental records in the active
	tenant context for warehouse workflows.
- **Field operator**: submit inspections for assigned rentals. Inspection
	object access is constrained by assignment and ownership checks.

The vocabulary is intentionally limited to these four scopes. A future
operation such as rental approval must add or revise a capability here before
its route is protected; it must not silently reuse `rentals:write` for a
different business action.

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

