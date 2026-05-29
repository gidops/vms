#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL must be set}"

# Parse host and port out of a postgresql://user:pass@host:port/db URL.
host_port_db="${DATABASE_URL##*@}"
host_port="${host_port_db%%/*}"
case "$host_port" in
  *:*)
    DB_HOST="${host_port%%:*}"
    DB_PORT="${host_port##*:}"
    ;;
  *)
    DB_HOST="$host_port"
    DB_PORT="5432"
    ;;
esac

echo "Waiting for database at ${DB_HOST}:${DB_PORT}..."
attempts=0
max_attempts=60
until node -e "
const net = require('net');
const s = net.createConnection({ host: '${DB_HOST}', port: ${DB_PORT}, timeout: 2000 });
s.once('connect', () => { s.end(); process.exit(0); });
s.once('error', () => process.exit(1));
s.once('timeout', () => { s.destroy(); process.exit(1); });
" >/dev/null 2>&1; do
  attempts=$((attempts + 1))
  if [ "$attempts" -ge "$max_attempts" ]; then
    echo "Database not reachable after ${max_attempts} attempts; aborting." >&2
    exit 1
  fi
  sleep 1
done
echo "Database reachable after ${attempts} attempt(s)."

echo "Applying Prisma migrations (prisma migrate deploy)..."
npx prisma migrate deploy

echo "Starting backend..."
exec node dist/main.js
