# Frontend — Clasificados VIP (Next.js 16, App Router)

Interfaz SSR optimizada para SEO. Consume la API del backend Django.

## Stack
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4.

## Puesta en marcha
```bash
npm install
# .env.local ya define API_URL / NEXT_PUBLIC_API_URL apuntando a localhost:8000
npm run dev      # http://localhost:3000
```
Requiere el backend corriendo en `http://localhost:8000` (ver `../backend/README.md`).

## Estructura
```
src/
├── app/
│   ├── layout.tsx              # nav + gate de edad 18+ + metadata base
│   ├── page.tsx                # home: regiones (ISR 1h)
│   ├── chile/[region]/         # comunas de una región (SSR)
│   ├── chile/[region]/[city]/  # anuncios por comuna (SSR + generateMetadata)
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
- **SSR/SEO:** rutas `/chile/[region]/[city]` y `/perfil/[slug]` se renderizan en servidor
  con `generateMetadata` (canonical, OG) y JSON-LD de rating. Sitemap dinámico por
  región/comuna. La home usa ISR (revalidate 1h).
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
- `next.config.ts` declara `remotePatterns` para `localhost:8000/media/**`. En **dev** se
  activa `images.dangerouslyAllowLocalIP` porque Next 16 bloquea por SSRF la optimización de
  imágenes desde IPs privadas/localhost; en producción ese guard queda activo y la media debe
  servirse desde un dominio público (S3/R2) — actualizar `remotePatterns` con ese host.

## Pendiente / mejoras
- Filtros por servicio/precio, paginación, y subida de comprobante con previsualización.
