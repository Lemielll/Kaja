#!/usr/bin/env bash
set -e

PRISM_URL="http://127.0.0.1:4010"

echo "=== Running Contract Smoke Test against Prism Mock Server ==="

# 1. Test GET Collection (Expect 200 OK)
echo "[1/3] Testing GET /equipments..."
STATUS_GET=$(curl -s -o /dev/null -w "%{http_code}" "${PRISM_URL}/equipments")
if [ "$STATUS_GET" -ne 200 ]; then
  echo "FAILED: GET /equipments returned $STATUS_GET (expected 200)"
  exit 1
fi
echo "PASSED: GET /equipments ($STATUS_GET)"

# 2. Test POST with Idempotency-Key (Expect 201 Created)
echo "[2/3] Testing POST /rentals WITH Idempotency-Key..."
STATUS_POST_VALID=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${PRISM_URL}/rentals" \
  -H 'Idempotency-Key: 0f7c1b9e-3d21-4a6f-9c05-8e2b7d41a9f0' \
  -H 'Content-Type: application/json' \
  -d '{
    "equipmentId": "eqp_8X2kAB",
    "contractorId": "ctr_72Xp9C",
    "warehouseAdminId": "adm_19Lq2f",
    "startTime": "2026-09-15T08:00:00Z",
    "endTime": "2026-09-18T17:00:00Z",
    "depositAmount": 150000,
    "currency": "USD"
  }')
if [ "$STATUS_POST_VALID" -ne 201 ]; then
  echo "FAILED: POST /rentals with key returned $STATUS_POST_VALID (expected 201)"
  exit 1
fi
echo "PASSED: POST /rentals with key ($STATUS_POST_VALID)"

# 3. Test POST WITHOUT Idempotency-Key (Expect 400 or 422)
echo "[3/3] Testing POST /rentals WITHOUT Idempotency-Key..."
STATUS_POST_INVALID=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${PRISM_URL}/rentals" \
  -H 'Content-Type: application/json' \
  -d '{
    "equipmentId": "eqp_8X2kAB",
    "contractorId": "ctr_72Xp9C",
    "warehouseAdminId": "adm_19Lq2f",
    "startTime": "2026-09-15T08:00:00Z",
    "endTime": "2026-09-18T17:00:00Z",
    "depositAmount": 150000,
    "currency": "USD"
  }')

if [ "$STATUS_POST_INVALID" -ne 400 ] && [ "$STATUS_POST_INVALID" -ne 422 ]; then
  echo "FAILED: POST /rentals without key returned $STATUS_POST_INVALID (expected 400 or 422)"
  exit 1
fi
echo "PASSED: POST /rentals without key ($STATUS_POST_INVALID)"

echo "=== ALL SMOKE TESTS PASSED SUCCESSFULLY ==="