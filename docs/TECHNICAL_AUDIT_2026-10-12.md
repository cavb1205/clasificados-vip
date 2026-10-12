# Auditoría técnica — 12 de octubre de 2026

## Alcance y límites

Revisión de documentación, configuración, dependencias, endpoints y componentes de
autenticación, cuentas, KYC, perfiles, fotos/video, publicaciones, pagos, habitaciones,
reseñas, favoritos, reportes, notificaciones, administración, SEO y operación.
Correcciones verificadas con pruebas automatizadas y datos ficticios aislados.
No es una certificación de seguridad, dictamen jurídico ni prueba de carga de producción.
No se cambiaron identidad del operador, dominio, proveedor de correo, datos bancarios
ni política de retención. No se borraron archivos históricos ni datos de producción.

## Correcciones incluidas

### Seguridad y privacidad

- Una cuenta suspendida ya no permanece visible en perfiles/publicaciones/favoritos ni
  como anfitrión de habitaciones. Las lecturas de reseñas y rating también verifican visibilidad.
- Las fotos de habitaciones en borrador, pausadas, suspendidas o vencidas no se pueden
  recuperar por ID con una cuenta de modelo activa. Dueño y moderación mantienen su preview.
- `/media/` devuelve 404: las copias antiguas no deben saltarse los endpoints privados.
- Deshabilitado el optimizador global de imágenes de Next para evitar un caché paralelo
  de fotos revocadas, incluido el acceso directo a `/_next/image`.
- Login exige y rota CSRF. Una cookie de acceso inválida no impide obtener CSRF, iniciar
  sesión, registrarse ni recuperar contraseña. Suspender/cambiar rol revoca sesiones anteriores.
- Registro normaliza correo y valida similitud de contraseña con atributos de la cuenta.
- Inputs estructurados/malformados en acciones administrativas, reportes, recuperación
  y respuestas de reseñas generan 400 en lugar de 500. Límites explícitos de longitud.
- Comprobantes validan formato real/tamaño/dimensiones, eliminan metadatos y se comprimen
  sin watermark sobre datos bancarios. Las fotos respetan orientación móvil y el pipeline
  evita crear listas Python de millones de píxeles. Uploads grandes se vuelcan a disco.
- Soporte solo permite usuarios de Telegram válidos; no adjunta correo privado en la URL.
- Next 16.3.6 → 16.3.8 y actualización de dependencias indirectas de producción.
  [Aviso publicado por Next.js](https://github.com/vercel/next.js/security/advisories/GHSA-cjq9-62q9-8jv4).

### Pagos y funcionamiento

- Snapshot del plan en cada nuevo comprobante: precio, días, destacado y cupos no cambian
  porque un administrador edite el catálogo antes de aprobarlo.
- Bloqueo de filas en PostgreSQL: aprobar dos veces el mismo recibo no duplica días;
  aprobar recibos distintos del mismo anuncio no pierde extensiones concurrentes.
- Un recibo pendiente por anuncio/anfitrión. No se permite cambiar de plan con pago
  pendiente ni contratar un plan de habitaciones para una publicación de modelo.
- Historial de publicaciones con recibos protegido frente al borrado ordinario.
- Renovación del mismo plan de anfitrión conserva días ya pagados. Un downgrade con
  exceso de habitaciones devuelve conflicto sin aprobar el pago ni modificar la suscripción.
- Cupos cuentan habitaciones pausadas/suspendidas, pero no vencidas aunque cron aún no
  haya marcado su estado. Publicar serializa la comprobación de cupos y bloquea suspendidas.
- Perfiles con varios anuncios activos no se duplican ni multiplican reseñas: consulta EXISTS.
- Ingresos mensuales incluyen modelos y habitaciones; utilizan snapshots cuando existen,
  respetan monto cero y el inicio del mes en horario de Chile. Son importes declarados,
  no conciliación bancaria ni contabilidad tributaria. Recibos antiguos pueden usar precio actual.
- Decisiones de reseñas/stories registran auditoría; respuesta pública de la modelo ahora visible.

### UX, móvil, accesibilidad y SEO

- Renovación automática de sesión también en `/auth/me/` y opciones de cuenta; refresh
  y preparación CSRF deduplicados. Expirar no provoca bucles de actualización de sesión.
- Login conserva el destino solicitado con validación contra redirecciones externas.
- Favoritos muestran error recuperable, no confunden una caída temporal con logout y
  no reutilizan información de otra cuenta ni respuestas antiguas tras cambiar sesión.
- Listado de habitaciones descarta respuestas obsoletas al cambiar filtros; muestra
  errores recuperables con botón Reintentar, no redirige un error de red a login.
- Navegación/títulos/precios flexibles; campos de 16 px en móvil y controles de 44 px
  de alto. Estrellas de reseñas son radios nativos con interacción por teclado.
- Drawer de filtros libera scroll al pasar a escritorio; textos legales accesibles antes del gate.
- Filtros conservan “disponibles ahora” y tienen nombres accesibles para edades/tarifas.
- Comunas inexistentes usan not-found/noindex; páginas malformadas se normalizan y
  404 de paginación no se presentan como error 500.
- Perfil individual vuelve a comprobar visibilidad sin caché entre peticiones; React.cache
  deduplica lectura de metadata/página. Catálogos/listados siguen con revalidación finita.

## Validación

- Backend Python 3.12, Django 5.2.17 y requirements del proyecto: **218 pruebas** en
  PostgreSQL, incluidas concurrencia real. SQLite: **218**, con dos de concurrencia
  omitidas porque SQLite no proporciona esos bloqueos.
- Migraciones sin cambios pendientes en modelos; `manage.py check` sin incidencias.
- Frontend: **54 pruebas Vitest**, TypeScript y build de Next 16.3.8 verificados. ESLint sin errores;
  quedan siete warnings de efectos existentes, registrados como deuda de refactor.
- `pip-audit -r requirements.txt`: sin vulnerabilidades conocidas. `npm audit --omit=dev`:
  sin vulnerabilidades conocidas. Auditoría completa npm: cinco avisos altos de la cadena
  de lint por braces 3.0.3, sin parche compatible publicado al revisar; no se usa en runtime
  de producción. No ejecutar `npm audit fix --force`: propone degradar Next/eslint-config.
  [Aviso de braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
- CI ampliada a SQLite/PostgreSQL 17; Node 24 para pruebas del frontend.
- Chrome y WebKit locales con base/archivos temporales: login conserva destino a habitaciones;
  responsive a 360/390/768/1024 px; filtros recuperan scroll al redimensionar;
  aprobación UI → API → PostgreSQL → perfil público. No se aprobaron pagos reales.
- El navegador local usa CSP bypass exclusivamente para acceder a la API HTTP de prueba.
  No demuestra funcionamiento de cookies entre dominios de producción ni sustituye
  Safari/iPhone físico, lectores de pantalla o mediciones de Core Web Vitals reales.

## Pendientes, en orden recomendado

### P0 — Antes de abrir a usuarios reales

1. **Sesiones same-site.** Frontend `vercel.app` y API `nip.io` utilizan cookies entre
   sitios. Safari bloquea cookies de terceros: puede fallar login/upload/preview en
   iPhone aunque Chrome funcione. Inferencia del diseño actual y la
   [política oficial de WebKit](https://webkit.org/tracking-prevention/).
   Solución preferida: dominio propio para web y API bajo el mismo dominio registrable;
   alternativa: BFF/reverse proxy same-origin con revisión de cookies, CSRF, uploads y
   permisos. No basta con poner SameSite=None. Probar Safari normal y privado.
2. **Operador/legal.** Operador aún no definido. Completar identificación, fiscalidad,
   retención, atención de derechos y revisión local siguiendo `LEGAL_READINESS.md`.
   Definir y probar activación de aceptación legal vigente; no declarar cumplimiento total.
3. **SMTP verificado y recuperación real**, con pruebas de entrega, expiración y
   privacidad. Sin entrega, perder la contraseña puede dejar a una persona sin acceso.
4. **Backup off-site y alertas**, con restore de DB, medios y claves KYC en entorno
   aislado. Hoy las copias en el mismo VPS no protegen de la pérdida completa del VPS.

### P1 — Próximo bloque funcional

1. **2FA para administración** y recuperación segura, sesiones/dispositivos visibles,
   alertas por cambio de rol, accesos KYC y decisiones de pago. Cubrir Django Admin y API,
   no solo ocultar botones en Next.
2. **Verificación de correo**: enlaces de un uso, caducidad, reenvío limitado, estados claros.
   No hacer pasar KYC manual o moderación de reseñas por verificación del correo.
3. **Cola duradera de trabajos** para correo/video, reintentos, estado processing/ready/failed,
   límites de concurrencia/duración y limpieza de huérfanos. Hoy hay hilos daemon que pueden
   perder trabajo al reiniciar el worker; watermark de video es opcional si falla.
4. **Panel de cobros más operativo**: referencia/fecha de transferencia, búsqueda,
   detección orientativa de duplicados, historial por usuario, conciliación y exportación
   restringida. No integrar procesador sin confirmar que acepta la actividad del sitio.
5. **Vencimientos y moderación**: recordatorios antes de expirar, centro de estado con
   explicación “no visible por…”, seguimiento/apelación de reportes y plazos de atención.

### P2 — Rendimiento, descubrimiento y evolución

- Miniaturas privadas responsivas (p.ej. 320/640/1280) con revocación; evaluar WebP/AVIF.
  El cierre del caché de Next protege privacidad pero aumenta bytes frente a un resize CDN.
- Paginar browse de habitaciones y colas/listas aún sin paginación, con orden estable y
  búsqueda. Añadir filtro de periodo/precio y orden de resultados en la UI de habitaciones.
- Refactorizar dashboard grande y formularios KYC duplicados; separar hooks/secciones,
  corregir warnings restantes y reducir consultas N+1 administrativas con anotaciones.
- Observabilidad real: errores con request ID, redacción de PII, alertas uptime/cron/SMTP,
  presupuesto de errores y revisión de acceso. `/healthz/` solo confirma app viva, no DB/SMTP.
- Medir Core Web Vitals en dispositivos/red móvil, accesibilidad teclado/lector/contraste,
  estados vacíos/offline y protección contra abuso (cache compartido de throttling, bot/edge).
- Revisar CSP para restringir connect/form e incorporar nonce sin romper streaming;
  el script inline actual permanece permitido. Probar cargas, upload y video en iOS/Android.
- Retención automática por categoría y solicitudes de privacidad con ejecución auditable;
  resolver manualmente no equivale a haber anonimizado DB, archivos y backups.
- SEO: ajustar sitemap a inventario útil y comprobar Google Search Console tras dominio;
  reseñas son moderadas, no equivalen a una reserva/servicio verificado.
- Considerar favoritos de habitaciones y alertas de disponibilidad después de consentimiento
  y canales de entrega fiables. Evitar chat interno, pagos intermediados y reservas hasta
  resolver su coste operativo, seguridad y encaje jurídico.

## Reglas para continuar

Arreglar primero los P0/P1 y verificar con usuarios de prueba de cada rol. Las nuevas
integraciones requieren elegir proveedor y criterios de aceptación antes de activarlas.
Cada entrega publica frontend y backend del mismo commit y comprueba migraciones,
healthchecks y endpoints privados. El estado de deploy se confirma por SHA, no solo HTTP 200.
