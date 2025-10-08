#!/bin/bash
set -e

PG_SOCKETS="/home/runner/.postgresql/sockets"
PG_BIN="/nix/store/07s64wxjzk6z1glwxvl3yq81vdn42k40-postgresql-15.7/bin"

# Ensure PostgreSQL is running
if ! $PG_BIN/pg_ctl -D /home/runner/.postgresql/data status &>/dev/null; then
  echo "Starting PostgreSQL..."
  /home/runner/workspace/start-postgres.sh > /tmp/postgres.log 2>&1 &
  sleep 3
fi

# Start Node.js dev server with logs redirected
echo "🚀 Starting dev server with logs at /tmp/dev-server.log..."
echo "Run: tail -f /tmp/dev-server.log to view logs"
cd /home/runner/workspace
NODE_ENV=development tsx server/index.ts >> /tmp/dev-server.log 2>&1
