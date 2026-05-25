# Backend — Clasificados VIP (Django + DRF)

Portal de clasificados premium para Chile. Cobro de tarifa plana por publicación;
**no** intermedia transacciones financieras. Fase 1 (MVP núcleo) implementada.

## Stack
Django 4.2 · DRF · SimpleJWT (cookies HttpOnly) · PostgreSQL (SQLite fallback) ·
Pillow · cryptography (Fernet).

## Puesta en marcha
```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
cp .env.example .env      # completar DJANGO_SECRET_KEY y KYC_ENCRYPTION_KEY
.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_chile      # regiones y comunas de Chile
.venv/bin/python manage.py createsuperuser
.venv/bin/python manage.py runserver
```
Sin `POSTGRES_DB` en `.env` se usa SQLite (arranque rápido). Para Postgres,
descomentar las variables `POSTGRES_*`.

## Decisiones clave
- **Almacenamiento migrable:** API `STORAGES` de Django. Hoy `FileSystemStorage`
  (local); migrar a S3/R2 cambia solo el `BACKEND` en `settings.STORAGES`, sin tocar
  modelos ni vistas. Media pública (`/media`) y KYC privado (`/private_media`) separados.
- **KYC cifrado:** cédula y selfie se cifran con Fernet antes de escribirse al almacén
  privado (`core/encryption.py`). Solo un admin las descifra en memoria vía vista
  protegida, y cada acceso queda en `VerificationAccessLog`.
- **Privacidad multimedia:** toda foto pasa por `core/image_processing.py` →
  strip EXIF/GPS + watermark + JPEG optimizado. Límites 6 fotos / 1 video validados
  en backend.
- **Auth:** JWT en cookies HttpOnly; las escrituras exigen token CSRF
  (`apps/users/authentication.py`). Sembrar cookie CSRF en `GET /api/v1/auth/csrf/`.
- **Visibilidad:** los perfiles nacen `pending` e invisibles; el endpoint público solo
  expone `verified` (aprobación manual del admin).

## API (prefijo `/api/v1/`)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `auth/csrf/` | Siembra cookie CSRF |
| POST | `auth/register/` · `auth/login/` · `auth/logout/` · `auth/refresh/` | Auth |
| GET | `auth/me/` | Usuario actual |
| GET | `regions/` · `cities/?region=<slug>` | Catálogo geográfico |
| CRUD | `me/profile/` | Perfil propio de la modelo |
| CRUD | `me/media/` | Multimedia propia (con pipeline + límites) |
| POST | `verification/submit/` | Subir documentos KYC |
| GET | `profiles/?region=&city=&service=&min_age=&max_age=&min_rate=&max_rate=&page=` | Listado público paginado (12/pág) con filtros |
| GET | `profiles/<slug>/` | Detalle público |
| GET | `services/` | Catálogo de servicios (filtros) |
| CRUD | `me/publications/` | Anuncios propios |
| POST | `me/publications/<pk>/receipt/` | Subir comprobante → `pending_payment` |
| GET | `publications/?region=&city=` | Anuncios vigentes (públicos) |
| GET | `plans/` | Planes de suscripción disponibles |
| POST | `reviews/` | Cliente (email verificado) deja reseña (queda pendiente) |
| GET | `profiles/<slug>/reviews/` · `profiles/<slug>/rating/` | Reseñas aprobadas + rating agregado |

## Tests
```bash
.venv/bin/python manage.py test
```
Cubren: cookies HttpOnly + rechazo CSRF, strip EXIF/GPS + compresión, límites de media,
cifrado KYC round-trip, aprobación admin → perfil verificado, visibilidad pública.

## Planes de suscripción (configurables por el admin)
- `SubscriptionPlan` define duración (en días), precio y si incluye destacado. El admin
  crea/edita planes desde el panel (diario, semanal, mensual, 90 días… lo que quiera) sin
  tocar código. Cargar ejemplos: `python manage.py seed_plans`.
- La modelo elige un plan al crear/editar su publicación (`plan_id`).

## Pagos y expiración (Fase 2)
- La modelo crea un anuncio (`draft`) con un plan, sube comprobante (`pending_payment`).
- El admin aprueba el `PaymentReceipt` → `Publication.activate()`: pasa a `active` y fija
  `expires_at = now + plan.duration_days` (30 días si no hay plan). Si el plan incluye
  destacado, marca `is_featured`.
- Cron de expiración:
  ```
  */15 * * * *  cd /ruta/backend && .venv/bin/python manage.py expire_publications
  ```
  (`--dry-run` para simular).

## Reseñas (Fase 3)
- Solo clientes con `email_verified=True` pueden reseñar; 1 reseña por (cliente, perfil).
- Nace `pending`; el admin la aprueba/rechaza. Solo las aprobadas se muestran y cuentan en
  el rating agregado.

## Pendiente
- Frontend Next.js (App Router, SSR).
