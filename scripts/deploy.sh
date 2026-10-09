#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BRANCH="${DEPLOY_BRANCH:-main}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
SKIP_PULL="${SKIP_PULL:-false}"

cd "$APP_DIR"

if [[ ! -f "server/.env" ]]; then
  echo "Missing server/.env. Copy server/.env.production.example and fill production secrets." >&2
  exit 1
fi

if [[ -z "${VITE_API_BASE_URL:-}" ]]; then
  echo "VITE_API_BASE_URL must be set for the production frontend build." >&2
  exit 1
fi

if [[ "$SKIP_PULL" != "true" ]]; then
  git fetch origin "$BRANCH"
  git checkout "$BRANCH"
  git pull --ff-only origin "$BRANCH"
fi

npm ci
npm run lint
npm test
npm run build

npm ci --prefix server
npm run check --prefix server
npm test --prefix server

docker compose -f "$COMPOSE_FILE" build --pull
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans
docker compose -f "$COMPOSE_FILE" ps

echo "Deployment complete."
