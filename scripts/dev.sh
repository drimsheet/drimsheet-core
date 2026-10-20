#!/usr/bin/env bash
set -e

# Load env vars
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

# Start dev services
# NOTE: Infrastructure (Postgres and Redis) should be started
# separately via drimsheet-platforms: bash bin/start.sh
exec npx concurrently --names http,routes \
  "nodemon --signal SIGTERM" \
  "nodemon -x 'npm run build:routes'"
