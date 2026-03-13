#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR"

PORT="${PORT:-3003}"
FRONTEND_PORT="${FRONTEND_PORT:-3002}"
DATABASE_URL="${DATABASE_URL:-postgres://neiljones@localhost:5432/cds_dev}"

echo "Starting CDS backend (PORT=$PORT, DATABASE_URL=$DATABASE_URL)"
(
  cd "$BACKEND_DIR"
  PORT="$PORT" DATABASE_URL="$DATABASE_URL" pnpm run dev
) &
BACKEND_PID=$!

echo "Starting frontend (Vite on http://localhost:$FRONTEND_PORT)"
(
  cd "$FRONTEND_DIR"
  FRONTEND_PORT="$FRONTEND_PORT" pnpm run dev
) &
FRONTEND_PID=$!

trap 'echo "Shutting down..."; kill $BACKEND_PID $FRONTEND_PID' INT TERM

wait
