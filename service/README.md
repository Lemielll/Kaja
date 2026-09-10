# Heavy Equipment Rental Backend Service

## Operations Tracking (A.3)

| Operation                           | Served by | Integration verification |
| :---------------------------------- | :-------- | :----------------------- |
| `GET /v1/equipments`                | mock      | Covered by stateless contract check; await service route mount |
| `GET /v1/rentals`                   | mock      | Invalid-query RFC 9457 check; await service route mount |
| `POST /v1/rentals`                  | mock      | Missing-key RFC 9457 check; live idempotency verification ready |
| `GET /v1/rentals/{id}`              | mock      | Await service route mount |
| `POST /v1/rentals/{id}/inspections` | mock      | Await service implementation and persistence |

## Error Catalogue Mapping (A.6)

| Cause inside Handler                       | Status Code | Type URI                                                    |
| :----------------------------------------- | :---------- | :---------------------------------------------------------- |
| Schema / Syntax Validation Failed          | 400         | `https://api.heavyrental.co/problems/invalid-request`       |
| Resource Not Found                         | 404         | `https://api.heavyrental.co/problems/resource-not-found`    |
| Idempotency Key Reused with Different Body | 409         | `https://api.heavyrental.co/problems/idempotency-key-reuse` |
| Unhandled Internal Exception               | 500         | `https://api.heavyrental.co/problems/internal-error`        |

## Integration checks

The common contract check works against Prism or the real service by changing
`BASE_URL` only. See [tests/contract/README.md](tests/contract/README.md) for
commands, and [scripts/verify_idempotency.sh](scripts/verify_idempotency.sh)
for the cURL demonstration of persisted idempotency.
