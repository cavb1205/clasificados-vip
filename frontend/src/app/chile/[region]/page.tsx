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
  const cities = await getCities(region);
  if (cities.length === 0) notFound();

  const regionName = cities[0].region.name;

  return (
    <div>
      <p className="text-sm text-neutral-500">
        <Link href="/" className="hover:text-pink-400">
          Chile
        </Link>{" "}
        / {regionName}
      </p>
      <h1 className="mt-1 text-2xl font-bold">Comunas en {regionName}</h1>
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
    </div>
  );
}
