#!/bin/sh
# entrypoint.sh: Inject runtime env variables into a JS file for Vite

RUNTIME_ENV_FILE="/app/dist/runtime-env.js"

echo "window.__RUNTIME_CONFIG__ = {" > $RUNTIME_ENV_FILE
# List all required env vars here
for VAR in \
  VITE_PUBLIC_KEYCLOAK_URL \
  VITE_PUBLIC_KEYCLOAK_REALM \
  VITE_PUBLIC_KEYCLOAK_CLIENT_ID \
  VITE_PUBLIC_KEYCLOAK_ENABLED \
  VITE_API_BASE_URL \
  VITE_BACKEND_API_BASE_URL \
  VITE_PUBLIC_CLUSTER_CREATION_METHOD \
  VITE_API_VERIFY_URL
do
  VALUE=$(printenv $VAR)
  if [ ! -z "$VALUE" ]; then
    echo "  $VAR: '$(echo $VALUE | sed "s/'/\\'/g")'," >> $RUNTIME_ENV_FILE
  fi
done
echo "};" >> $RUNTIME_ENV_FILE

exec "$@"
