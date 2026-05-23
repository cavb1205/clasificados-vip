import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getProfiles } from "@/lib/api";

type Params = Promise<{ region: string; city: string }>;

function titleize(slug: string) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { region, city } = await params;
  const cityName = titleize(city);
  return {
    title: `Anuncios en ${cityName}`,
    description: `Perfiles verificados con anuncios activos en ${cityName}.`,
    alternates: { canonical: `/chile/${region}/${city}` },
  };
}

export default async function CityPage({ params }: { params: Params }) {
  const { region, city } = await params;
  const profiles = await getProfiles(region, city);
  const cityName = titleize(city);

  return (
    <div>
      <p className="text-sm text-neutral-500">
        <Link href={`/chile/${region}`} className="hover:text-pink-400">
          {titleize(region)}
        </Link>{" "}
        / {cityName}
      </p>
      <h1 className="mt-1 text-2xl font-bold">Anuncios en {cityName}</h1>

      {profiles.length === 0 ? (
        <p className="mt-6 text-neutral-400">
          Aún no hay anuncios verificados en esta comuna.
        </p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {profiles.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/perfil/${p.slug}`}
                className="block overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 hover:border-pink-600"
              >
                {p.cover_photo ? (
                  <Image
                    src={p.cover_photo}
                    alt={p.stage_name}
                    width={600}
                    height={400}
                    sizes="(max-width: 640px) 100vw, 50vw"
                    className="aspect-[3/2] w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-[3/2] items-center justify-center bg-neutral-800 text-neutral-600">
                    Sin foto
                  </div>
                )}
                <div className="p-5">
                  <h2 className="text-lg font-semibold">{p.stage_name}</h2>
                  <p className="mt-1 text-sm text-neutral-400">{p.age} años</p>
                  {p.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-neutral-500">{p.description}</p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
