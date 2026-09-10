#!/usr/bin/env bash
set -euo pipefail

# cURL equivalent of tests/contract/verify_idempotency.js for a live service.
# Example: BASE_URL=http://127.0.0.1:4010/v1 ./scripts/verify_idempotency.sh
BASE_URL="${BASE_URL:-http://127.0.0.1:4010/v1}"
BASE_URL="${BASE_URL%/}"
KEY="${IDEMPOTENCY_KEY:-$(node -e 'console.log(require("crypto").randomUUID())')}"

BODY='{"equipmentId":"eqp_8X2kAB","contractorId":"ctr_72Xp9C","warehouseAdminId":"adm_19Lq2f","startTime":"2026-09-15T08:00:00Z","endTime":"2026-09-18T17:00:00Z","depositAmount":150000,"currency":"USD"}'
CHANGED_BODY='{"equipmentId":"eqp_8X2kAB","contractorId":"ctr_72Xp9C","warehouseAdminId":"adm_19Lq2f","startTime":"2026-09-15T08:00:00Z","endTime":"2026-09-18T17:00:00Z","depositAmount":150001,"currency":"USD"}'

post() {
  curl --silent --show-error --write-out '\nHTTP %{http_code}\n' --request POST "$BASE_URL/rentals" \
    --header 'Content-Type: application/json' \
    --header "Idempotency-Key: $KEY" \
    --data "$1"
}

echo "Idempotency-Key: $KEY"
echo 'First request (expect 201):'
post "$BODY"
echo 'Identical replay (expect 201 with the same rental id):'
post "$BODY"
echo 'Changed body with same key (expect 409 idempotency-key-reuse):'
post "$CHANGED_BODY"
