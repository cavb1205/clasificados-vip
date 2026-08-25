# Frontend — Clasificados VIP (Next.js 16, App Router)

Interfaz SSR optimizada para SEO. Consume la API del backend Django.

## Stack
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4.

## Puesta en marcha
```bash
npm install
# .env.local ya define API_URL / NEXT_PUBLIC_API_URL apuntando a localhost:8000
# En producción definir NEXT_PUBLIC_SITE_URL con el dominio canónico (por ejemplo,
# https://portalvip.cl) para metadata, sitemap y robots.
npm run dev      # http://localhost:3000
```
Requiere el backend corriendo en `http://localhost:8000` (ver `../backend/README.md`).

## Estructura
```
src/
├── app/
│   ├── layout.tsx              # nav + gate de edad 18+ + metadata base
│   ├── page.tsx                # home: comunas pobladas (ISR 5 min)
│   ├── chile/[region]/         # comunas de una región (SSR)
│   ├── chile/[region]/[city]/[gender]/ # anuncios por comuna (SSR + filtros)
│   ├── perfil/[slug]/          # detalle: reseñas + rating + JSON-LD AggregateRating
│   ├── login · registro        # auth (client)
│   ├── dashboard/              # panel de la modelo (perfil, KYC, media, anuncios)
│   ├── robots.ts · sitemap.ts  # SEO
├── components/AgeGate.tsx
└── lib/
    ├── api.ts          # lecturas públicas SSR (fetch con revalidate)
    ├── client-api.ts   # escrituras autenticadas (cookies HttpOnly + CSRF)
    └── types.ts
```

## Decisiones
- **SSR/SEO:** rutas `/chile/[region]/[city]/[gender]` y `/perfil/[slug]` se renderizan en servidor
  con `generateMetadata` (canonical, OG) y JSON-LD de rating. Sitemap dinámico por
  región/comuna. La home usa ISR (revalidate 5 min).
- **Auth por cookie:** el JWT vive en cookies HttpOnly; el cliente usa
  `credentials: "include"` y adjunta el token CSRF (sembrado en `GET /auth/csrf/`) en
  cada escritura. El dashboard verifica sesión con `/auth/me/` y redirige a login si no hay.
- **Gate 18+:** overlay bloqueante (localStorage) antes de mostrar contenido.

## Verificado
`npm run build` compila limpio. SSR probado end-to-end contra el backend: home, región,
comuna y robots responden con datos reales.

## Imágenes
- `cover_photo` en las tarjetas de comuna y galería de `photos` en el perfil, vía
  `next/image` (responsive `sizes`, `priority` en la primera). OG image usa la portada.
- `next.config.ts` declara `remotePatterns` para los endpoints gateados de perfiles, multimedia,
  stories y habitaciones. El dashboard usa `unoptimized` para archivos privados, de modo que
  las cookies HttpOnly lleguen al endpoint protegido; las imágenes públicas sí pueden pasar por
  el optimizador de Next. En **dev** se activa `images.dangerouslyAllowLocalIP` porque Next 16
  bloquea por SSRF la optimización desde IPs privadas/localhost; en producción ese guard queda
  activo y la media debe servirse desde un dominio público (S3/R2) — actualizar `remotePatterns`
  con ese host.

## Filtros y paginación
- `/chile/[region]/[city]/[gender]` lee `searchParams` (`service`, `min_age`, `max_age`, `min_rate`,
  `max_rate`, `page`) y los pasa al backend.
- Barra de filtros lateral (`<form method="get">`), submit recarga la URL — sin
  JavaScript del lado cliente para los filtros (full SSR).
- Paginación Anterior/Siguiente con texto "Página N de M". 12 perfiles por página.

## Búsqueda global
- Input en el nav (cabecera) que apunta a `/buscar?q=`. Página SSR con
  paginación; queda excluida del sitemap y `robots.txt`.

## Producción y seguridad
- Definir `NEXT_PUBLIC_SITE_URL` con el dominio canónico. El valor controla metadata,
  canonical, sitemap y robots; no dejar el fallback de Vercel si el dominio real ya está activo.
- El frontend aplica CSP, `X-Frame-Options`, `nosniff`, Referrer-Policy y desactiva
  `x-powered-by`.
- El backend exige `DJANGO_SECRET_KEY` y `KYC_ENCRYPTION_KEY` con `DJANGO_DEBUG=False`,
  y sus dependencias se revisan con `pip-audit` en CI. Los uploads validan tamaño, tipo,
  dimensiones y, para imágenes, el contenido real antes de procesarse.
- El drag-and-drop de fotos ya está disponible en el panel; también tiene controles ↑/↓
  para teclado y touch.
- Pendiente operativo: hosting backend, Postgres, dominio de media, SMTP real y backups
  off-site.
