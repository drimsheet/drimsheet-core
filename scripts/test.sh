#!/usr/bin/env bash
set -e

# Load env vars
if [ -f .env.test ]; then
  set -a
  source .env.test
  set +a
fi

export NODE_ENV=test

yarn test:db:reset
echo "Starting test server..."
npx cross-env NODE_ENV=test concurrently \
  "nodemon" \
  "nodemon -x 'npm run build:routes'"
