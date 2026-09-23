import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Las rutas privadas ya publican `noindex`; deben poder rastrearse para
      // que el buscador lea esa directiva en lugar de ver una URL bloqueada.
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
