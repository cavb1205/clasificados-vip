import type { MetadataRoute } from "next";
import { getCities, getRegions } from "@/lib/api";

const BASE = "https://clasificados.vip";

// Si el backend está abajo en el momento del build, devolvemos solo la home en
// vez de romper el deploy — el sitemap se regenera en el próximo build/revalidate.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [{ url: BASE, priority: 1 }];

  try {
    const regions = await getRegions();
    for (const region of regions) {
      entries.push({ url: `${BASE}/chile/${region.slug}`, priority: 0.8 });
      try {
        const cities = await getCities(region.slug);
        for (const city of cities) {
          entries.push({
            url: `${BASE}/chile/${region.slug}/${city.slug}`,
            priority: 0.6,
          });
        }
      } catch {
        // Cities falló para esta región; sigue con la siguiente.
      }
    }
  } catch (err) {
    console.error("sitemap: backend no respondió, devolviendo entradas mínimas", err);
  }

  return entries;
}
