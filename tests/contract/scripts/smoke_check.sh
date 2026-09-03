#!/usr/bin/env bash

set -euo pipefail

base_url="${BASE_URL:-http://127.0.0.1:4010}"
payload='{"equipmentId":"eqp_8X2kAB","contractorId":"ctr_72Xp9C","warehouseAdminId":"adm_19Lq2f","startTime":"2026-09-15T08:00:00Z","endTime":"2026-09-18T17:00:00Z","depositAmount":150000,"currency":"USD"}'
key='0f7c1b9e-3d21-4a6f-9c05-8e2b7d41a9f0'

expect_status() {
  local expected="$1"
  shift
  local actual
  actual="$(curl -sS -o /dev/null -w '%{http_code}' "$@")"
  test "$actual" = "$expected" || {
    echo "Expected HTTP $expected, received $actual: $*" >&2
    exit 1
  }
}

echo "Checking Prism mock at $base_url"
expect_status 200 "$base_url/equipments"
expect_status 201 -X POST "$base_url/rentals" -H "Idempotency-Key: $key" -H 'Content-Type: application/json' --data "$payload"
expect_status 422 -X POST "$base_url/rentals" -H 'Content-Type: application/json' --data "$payload"
echo "Smoke checks passed."
