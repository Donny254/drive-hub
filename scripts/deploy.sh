#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/opt/drive-hub"
BRANCH="${DEPLOY_BRANCH:-main}"

cd "$APP_DIR"

if [[ ! -f .env.deploy ]]; then
  echo "Missing .env.deploy" >&2
  exit 1
fi

set -a
source .env.deploy
set +a

: "${DB_PASSWORD:?DB_PASSWORD is missing from .env.deploy}"

export DATABASE_URL
DATABASE_URL="$(python3 -c '
import os
from urllib.parse import quote
password = quote(os.environ["DB_PASSWORD"], safe="")
print(f"postgresql://app:{password}@db:5432/drivehub")
')"

export VITE_API_BASE_URL="${VITE_API_BASE_URL:-https://wheelsnation.co.ke}"

if [[ "${SKIP_PULL:-false}" != "true" ]]; then
  git fetch origin "$BRANCH"
  git checkout "$BRANCH"
  git pull --ff-only origin "$BRANCH"
fi

COMPOSE=(
  docker compose
  -f docker-compose.prod.yml
  -f docker-compose.override.yml
)

echo "Validating production configuration..."
"${COMPOSE[@]}" config --quiet

echo "Building and deploying API and frontend..."
"${COMPOSE[@]}" up -d --build api web

echo "Waiting for API health check..."
healthy=false

for attempt in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8080/api/health >/dev/null; then
    healthy=true
    break
  fi
  sleep 5
done

if [[ "$healthy" != "true" ]]; then
  echo "API did not become healthy. Recent logs:" >&2
  docker logs --tail 100 drive-hub-api-1 >&2
  exit 1
fi

echo "Checking frontend..."
curl -fsS http://127.0.0.1:4173/ >/dev/null

echo "Deployment successful."
"${COMPOSE[@]}" ps
