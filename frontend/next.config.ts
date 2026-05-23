import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Backend Django local (media pública). En producción reemplazar por el
      // dominio del backend o del object storage (S3/R2).
      { protocol: "http", hostname: "localhost", port: "8000", pathname: "/media/**" },
    ],
    // Next 16 bloquea por seguridad (SSRF) optimizar imágenes desde IPs privadas
    // /localhost. Solo lo permitimos en desarrollo; en producción la media vendrá
    // de un dominio público real, así que el guard queda activo.
    dangerouslyAllowLocalIP: isDev,
  },
};

export default nextConfig;
