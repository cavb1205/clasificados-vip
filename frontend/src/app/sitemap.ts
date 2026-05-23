import type { MetadataRoute } from "next";
import { getCities, getRegions } from "@/lib/api";

const BASE = "https://clasificados.vip";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const regions = await getRegions();
  const entries: MetadataRoute.Sitemap = [{ url: BASE, priority: 1 }];

  for (const region of regions) {
    entries.push({ url: `${BASE}/chile/${region.slug}`, priority: 0.8 });
    const cities = await getCities(region.slug);
    for (const city of cities) {
      entries.push({ url: `${BASE}/chile/${region.slug}/${city.slug}`, priority: 0.6 });
    }
  }
  return entries;
}
