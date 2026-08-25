import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const scriptSources = ["'self'", "'unsafe-inline'", "https://va.vercel-scripts.com"];
if (isDev) scriptSources.push("'unsafe-eval'");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `script-src ${scriptSources.join(" ")}`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' https: data: blob:",
              "media-src 'self' https: blob:",
              "font-src 'self' https: data:",
              "connect-src 'self' https: ws: wss:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self' https:",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      // Backend Django local (dev).
      { protocol: "http", hostname: "localhost", port: "8000", pathname: "/media/**" },
      // Fotos de habitaciones: se sirven gateadas fuera de /media/.
      { protocol: "http", hostname: "localhost", port: "8000", pathname: "/api/v1/room-photos/**" },
      { protocol: "http", hostname: "localhost", port: "8000", pathname: "/api/v1/profiles/**" },
      { protocol: "http", hostname: "localhost", port: "8000", pathname: "/api/v1/profile-media/**" },
      { protocol: "http", hostname: "localhost", port: "8000", pathname: "/api/v1/me/profile/**" },
      { protocol: "http", hostname: "localhost", port: "8000", pathname: "/api/v1/me/media/**" },
      { protocol: "http", hostname: "localhost", port: "8000", pathname: "/api/v1/admin/profiles/**" },
      { protocol: "http", hostname: "localhost", port: "8000", pathname: "/api/v1/admin/media/**" },
      // Comprobantes privados visibles solo en colas administrativas.
      { protocol: "http", hostname: "localhost", port: "8000", pathname: "/api/v1/admin/payments/**" },
      { protocol: "http", hostname: "localhost", port: "8000", pathname: "/api/v1/admin/room-payments/**" },
      { protocol: "http", hostname: "localhost", port: "8000", pathname: "/api/v1/stories/**" },
      { protocol: "http", hostname: "localhost", port: "8000", pathname: "/api/v1/admin/story-reports/**" },
      // Backend en VPS (producción interina, dominio nip.io). Cuando se compre
      // el dominio real, agregar la regla equivalente; mantener este durante la
      // transición no hace daño.
      { protocol: "https", hostname: "api-165-22-154-95.nip.io", pathname: "/media/**" },
      { protocol: "https", hostname: "api-165-22-154-95.nip.io", pathname: "/api/v1/room-photos/**" },
      { protocol: "https", hostname: "api-165-22-154-95.nip.io", pathname: "/api/v1/profiles/**" },
      { protocol: "https", hostname: "api-165-22-154-95.nip.io", pathname: "/api/v1/profile-media/**" },
      { protocol: "https", hostname: "api-165-22-154-95.nip.io", pathname: "/api/v1/me/profile/**" },
      { protocol: "https", hostname: "api-165-22-154-95.nip.io", pathname: "/api/v1/me/media/**" },
      { protocol: "https", hostname: "api-165-22-154-95.nip.io", pathname: "/api/v1/admin/profiles/**" },
      { protocol: "https", hostname: "api-165-22-154-95.nip.io", pathname: "/api/v1/admin/media/**" },
      { protocol: "https", hostname: "api-165-22-154-95.nip.io", pathname: "/api/v1/admin/payments/**" },
      { protocol: "https", hostname: "api-165-22-154-95.nip.io", pathname: "/api/v1/admin/room-payments/**" },
      { protocol: "https", hostname: "api-165-22-154-95.nip.io", pathname: "/api/v1/stories/**" },
      { protocol: "https", hostname: "api-165-22-154-95.nip.io", pathname: "/api/v1/admin/story-reports/**" },
    ],
    // Next 16 bloquea optimizar imágenes desde IPs privadas/localhost (SSRF).
    // En prod la media viene de un dominio público real → el guard queda activo.
    dangerouslyAllowLocalIP: isDev,
  },
};

export default nextConfig;
