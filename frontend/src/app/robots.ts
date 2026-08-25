import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/admin", "/anfitrion", "/cuenta", "/favoritos", "/login", "/registro", "/recuperar", "/buscar"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
