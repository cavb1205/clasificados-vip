import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCities, getRegions } from "@/lib/api";

type Params = Promise<{ region: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { region } = await params;
  const regions = await getRegions();
  const found = regions.find((r) => r.slug === region);
  const name = found?.name ?? region;
  return {
    title: `Anuncios en ${name}`,
    description: `Comunas de la región de ${name} con anuncios verificados.`,
    alternates: { canonical: `/chile/${region}` },
  };
}

export default async function RegionPage({ params }: { params: Params }) {
  const { region } = await params;
  // Solo comunas con perfiles visibles. Si no hay ninguna, mostramos un
  // estado vacío en vez de 404 (la región existe pero no hay anuncios).
  const cities = await getCities(region, { onlyPopulated: true });
  const allCities = cities.length === 0 ? await getCities(region) : cities;
  if (allCities.length === 0) notFound();

  const regionName = allCities[0].region.name;

  return (
    <div>
      <p className="text-sm text-neutral-500">
        <Link href="/" className="hover:text-pink-400">
          Chile
        </Link>{" "}
        / {regionName}
      </p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
        Comunas en {regionName}
      </h1>
      {cities.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-400">
          Aún no hay anuncios activos en esta región. Vuelve pronto.
        </p>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {cities.map((city) => (
            <li key={city.id}>
              <Link
                href={`/chile/${region}/${city.slug}`}
                className="block rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm hover:border-pink-600"
              >
                {city.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
