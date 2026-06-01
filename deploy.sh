#!/usr/bin/env bash
# Despliegue del backend en el VPS por git pull.
#
#   Flujo:  push a main  →  CI verde  →  en el VPS:  cd /opt/vip && ./deploy.sh
#
# El working tree de /opt/vip se fuerza a coincidir EXACTAMENTE con origin/main
# (reset --hard), así el código desplegado siempre es un commit git trazable y
# nunca queda drift. `.env.production` está gitignored → no se toca. Los datos
# (Postgres + volúmenes Docker) viven fuera del repo, no se ven afectados.
set -euo pipefail

cd "$(dirname "$0")"

echo "→ actualizando código desde origin/main…"
git fetch --quiet origin main
git reset --hard origin/main

echo "→ desplegando $(git rev-parse --short HEAD): $(git log -1 --format=%s)"
cd backend
sudo docker compose -f docker-compose.production.yml up -d --build

echo "✓ deploy listo ($(git -C .. rev-parse --short HEAD))"
