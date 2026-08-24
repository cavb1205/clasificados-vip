#!/usr/bin/env bash
# Ejecuta las tareas periódicas de mantenimiento dentro de un contenedor
# separado. El scheduler debe fallar ruidosamente para que Docker lo reinicie.
set -euo pipefail

INTERVAL_SECONDS="${SCHEDULER_INTERVAL_SECONDS:-900}"
JOB_TIMEOUT_SECONDS="${SCHEDULER_JOB_TIMEOUT_SECONDS:-600}"
HEARTBEAT_FILE=/tmp/scheduler-heartbeat

for value in "$INTERVAL_SECONDS" "$JOB_TIMEOUT_SECONDS"; do
  if ! [[ "$value" =~ ^[1-9][0-9]*$ ]]; then
    echo "ERROR: intervalo/timeout inválido: $value" >&2
    exit 2
  fi
done

run_job() {
  local job="$1"
  echo "→ scheduler: $job"
  if timeout "${JOB_TIMEOUT_SECONDS}s" python manage.py "$job"; then
    echo "✓ scheduler: $job terminado"
    return 0
  fi
  echo "✗ scheduler: $job falló" >&2
  return 1
}

touch "$HEARTBEAT_FILE"
echo "→ scheduler activo (cada ${INTERVAL_SECONDS}s; timeout ${JOB_TIMEOUT_SECONDS}s)"

while true; do
  failed=0
  run_job expire_publications || failed=1
  run_job expire_rooms || failed=1
  run_job delete_expired_stories || failed=1
  touch "$HEARTBEAT_FILE"

  if [[ "$failed" == "1" ]]; then
    echo "ERROR: una tarea periódica falló; Docker reiniciará el scheduler." >&2
    exit 1
  fi
  sleep "$INTERVAL_SECONDS"
done
