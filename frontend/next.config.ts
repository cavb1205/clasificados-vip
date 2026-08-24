import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
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
