# Heavy Equipment Rental Backend Service

## Operations Tracking (A.3)

| Operation                           | Served by | Remaining Work                      |
| :---------------------------------- | :-------- | :---------------------------------- |
| `GET /v1/equipments`                | mock      | Replace with service implementation |
| `GET /v1/rentals`                   | mock      | Replace with service implementation |
| `POST /v1/rentals`                  | mock      | Replace with service implementation |
| `GET /v1/rentals/{id}`              | mock      | Replace with service implementation |
| `POST /v1/rentals/{id}/inspections` | mock      | Replace with service implementation |

## Error Catalogue Mapping (A.6)

| Cause inside Handler                       | Status Code | Type URI                                                    |
| :----------------------------------------- | :---------- | :---------------------------------------------------------- |
| Schema / Syntax Validation Failed          | 400         | `https://api.heavyrental.co/problems/bad-request`           |
| Resource Not Found                         | 404         | `https://api.heavyrental.co/problems/not-found`             |
| Idempotency Key Reused with Different Body | 409         | `https://api.heavyrental.co/problems/idempotency-key-reuse` |
| Unhandled Internal Exception               | 500         | `https://api.heavyrental.co/problems/internal-server-error` |
