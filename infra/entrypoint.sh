#!/bin/sh
set -e

# If bootstrap username is set but password is missing, provide fallback so Keycloak does not crash
if [ -n "$KC_BOOTSTRAP_ADMIN_USERNAME" ] && [ -z "$KC_BOOTSTRAP_ADMIN_PASSWORD" ]; then
  export KC_BOOTSTRAP_ADMIN_PASSWORD="admin123"
fi

# If explicitly running import command, execute directly
if [ "$1" = "import" ]; then
  exec /opt/keycloak/bin/kc.sh "$@"
fi

# Auto-import realm if not present
echo "[KEYCLOAK INIT] Ensuring realm-export.json is imported..."
/opt/keycloak/bin/kc.sh import --optimized --file /opt/keycloak/import/realm-export.json --override=false || true
echo "[KEYCLOAK INIT] Realm import completed."

if [ $# -gt 0 ]; then
  exec /opt/keycloak/bin/kc.sh "$@"
else
  exec /opt/keycloak/bin/kc.sh start --optimized
fi
