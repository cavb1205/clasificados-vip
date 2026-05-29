import Link from "next/link";
import { getAllPopulatedCities } from "@/lib/api";
import { CityPicker } from "@/components/CityPicker";
import { DEFAULT_GENDER_SLUG } from "@/lib/types";

// Renderiza por request (no pre-render en build): evita que el build falle si
// el backend está reiniciándose, y mantiene el listado siempre fresco.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const cities = await getAllPopulatedCities();

  // Agrupamos por región para que la grilla mantenga contexto geográfico,
  // pero el selector de arriba permite saltar directo a cualquier comuna.
  const byRegion = new Map<string, { name: string; cities: typeof cities }>();
  for (const c of cities) {
    const entry = byRegion.get(c.region.slug) ?? { name: c.region.name, cities: [] };
    entry.cities.push(c);
    byRegion.set(c.region.slug, entry);
  }

  return (
    <div>
      <section className="mb-8">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          Anuncios verificados en Chile
        </h1>
        <p className="mt-2 max-w-2xl text-neutral-400">
          Elige tu comuna y explora perfiles con identidad verificada.
        </p>
      </section>

      {cities.length > 0 && (
        <div className="mb-8 max-w-md">
          <CityPicker cities={cities} label="Elige una comuna" />
        </div>
      )}

      {cities.length === 0 ? (
        <p className="text-sm text-neutral-400">
          Aún no hay anuncios activos. Vuelve pronto.
        </p>
      ) : (
        <>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Comunas con anuncios activos
          </h2>
          <div className="space-y-6">
            {Array.from(byRegion.entries()).map(([regionSlug, { name, cities: rc }]) => (
              <section key={regionSlug}>
                <h3 className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
                  {name}
                </h3>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {rc.map((city) => (
                    <li key={city.id}>
                      <Link
                        href={`/chile/${regionSlug}/${city.slug}/${DEFAULT_GENDER_SLUG}`}
                        className="block rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm hover:border-pink-600"
                      >
                        {city.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
