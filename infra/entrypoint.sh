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

# On single-container deployments (e.g. Railway), auto-import realm on initial startup
if [ ! -f /opt/keycloak/data/realm_imported.lock ]; then
  echo "[KEYCLOAK INIT] First run detected. Importing realm-export.json..."
  /opt/keycloak/bin/kc.sh import --optimized --file /opt/keycloak/import/realm-export.json || true
  touch /opt/keycloak/data/realm_imported.lock 2>/dev/null || true
  echo "[KEYCLOAK INIT] Realm import completed."
fi

if [ $# -gt 0 ]; then
  exec /opt/keycloak/bin/kc.sh "$@"
else
  exec /opt/keycloak/bin/kc.sh start --optimized
fi
