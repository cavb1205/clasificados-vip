#!/usr/bin/env bash
# Entrypoint que prepara la app antes de arrancar gunicorn.
set -e

echo "→ esperando a Postgres en ${POSTGRES_HOST:-postgres}:${POSTGRES_PORT:-5432}..."
python <<'PY'
import os, socket, time
host = os.getenv("POSTGRES_HOST", "postgres")
port = int(os.getenv("POSTGRES_PORT", "5432"))
for i in range(30):
    try:
        with socket.create_connection((host, port), timeout=2):
            print(f"  ✓ Postgres responde tras {i*2}s")
            break
    except OSError:
        time.sleep(2)
else:
    print("  ✗ Postgres no responde tras 60s")
    raise SystemExit(1)
PY

echo "→ migrate"
python manage.py migrate --noinput

echo "→ collectstatic"
python manage.py collectstatic --noinput

# Seed idempotente (no daña si ya estaba cargado).
if [[ "${SEED_ON_START:-0}" == "1" ]]; then
  echo "→ seed_chile + seed_plans + seed_room_plans"
  python manage.py seed_chile || true
  python manage.py seed_plans || true
  python manage.py seed_room_plans || true
fi

echo "→ arrancando: $@"
exec "$@"
