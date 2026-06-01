# Clasificados VIP

[![CI](https://github.com/cavb1205/clasificados-vip/actions/workflows/ci.yml/badge.svg)](https://github.com/cavb1205/clasificados-vip/actions/workflows/ci.yml)

Portal de clasificados premium para Chile, con verificación de identidad, tarifa plana por
publicación y planes configurables. **No** intermedia transacciones financieras.

## Monorepo
- [`backend/`](./backend) — Django 4.2 + DRF + PostgreSQL (SQLite fallback en dev). Auth JWT
  en cookies HttpOnly, KYC cifrado en reposo (Fernet), pipeline de imágenes (EXIF/watermark),
  planes de suscripción configurables y comando cron de expiración. Detalle en
  [`backend/README.md`](./backend/README.md).
- [`frontend/`](./frontend) — Next.js 16 (App Router, React 19, TypeScript, Tailwind 4).
  SSR para SEO en `/chile/[region]/[city]` y `/perfil/[slug]`, gate 18+, dashboard de la
  modelo. Detalle en [`frontend/README.md`](./frontend/README.md).

## Arranque rápido
```bash
# Backend (puerto 8000)
cd backend
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
cp .env.example .env       # completar secretos
.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_chile
.venv/bin/python manage.py seed_plans
.venv/bin/python manage.py runserver

# Frontend (puerto 3000), en otra terminal
cd frontend
npm install
npm run dev
```

## Stack
Django · DRF · SimpleJWT · Pillow · cryptography · PostgreSQL · Next.js · React 19 · Tailwind.

## Estado
Backend: 21 tests OK · Frontend: build OK · Flujo end-to-end verificado contra HTTP real
(registro → verificación → pago → activación → visibilidad pública). Mejoras pendientes en
los READMEs por carpeta.
