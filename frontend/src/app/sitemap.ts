import type { MetadataRoute } from "next";
import { getCities, getProfileSlugs, getRegions } from "@/lib/api";
import { SITE_URL } from "@/lib/site";
import { DEFAULT_GENDER_SLUG } from "@/lib/types";

const BASE = SITE_URL;

// Si el backend está abajo en el momento del build, devolvemos solo la home en
// vez de romper el deploy — el sitemap se regenera en el próximo build/revalidate.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: BASE, priority: 1 },
    { url: `${BASE}/publica`, priority: 0.7 },
  ];

  try {
    const regions = await getRegions();
    entries.push(...regions.map((region) => ({ url: `${BASE}/chile/${region.slug}`, priority: 0.8 })));
    const cityEntries = await Promise.all(
      regions.map(async (region) => {
        try {
          const cities = await getCities(region.slug);
          return cities.map((city) => ({
            // La ruta sin género redirige; el sitemap debe apuntar al canonical.
            url: `${BASE}/chile/${region.slug}/${city.slug}/${DEFAULT_GENDER_SLUG}`,
            priority: 0.6,
          }));
        } catch {
          return [];
        }
      }),
    );
    entries.push(...cityEntries.flat());
  } catch (err) {
    console.error("sitemap: backend no respondió, devolviendo entradas mínimas", err);
  }

  // Perfiles públicos (las páginas que más buscan en Google).
  try {
    const slugs = await getProfileSlugs();
    for (const p of slugs) {
      entries.push({
        url: `${BASE}/perfil/${p.slug}`,
        lastModified: p.updated_at,
        priority: 0.7,
      });
    }
  } catch {
    // Si falla, el sitemap igual sale con regiones/comunas.
  }

  return entries;
}
