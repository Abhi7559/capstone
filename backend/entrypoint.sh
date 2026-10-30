#!/bin/sh
set -e

# Run migrations and seed data if database URL is configured
if [ -n "$DATABASE_URL" ]; then
    echo "Applying database migrations with Alembic..."
    alembic upgrade head

    echo "Seeding initial Administrator user..."
    python -m database.seed
fi

PORT="${PORT:-8000}"
HOST="${HOST:-0.0.0.0}"

# If standard uvicorn command is passed, ensure it binds to Render's dynamic $PORT
if [ "$1" = 'uvicorn' ]; then
    exec uvicorn main:app --host "$HOST" --port "$PORT"
fi

exec "$@"
