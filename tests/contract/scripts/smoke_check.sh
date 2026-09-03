#!/usr/bin/env bash

set -euo pipefail

BASE_URL=${BASE_URL:-http://localhost:4010}

echo "Running smoke checks against $BASE_URL"

curl -s -o /dev/null -w "%{http_code}\n" -X GET "$BASE_URL/" || true

echo "Done. Use README.md for more comprehensive checks."
