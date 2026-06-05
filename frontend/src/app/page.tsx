import Link from "next/link";
import { getAllPopulatedCities } from "@/lib/api";
import { CityPicker } from "@/components/CityPicker";
import { DEFAULT_GENDER_SLUG } from "@/lib/types";

// Renderiza por request (no pre-render en build): evita que el build falle si
// el backend está reiniciándose, y mantiene el listado siempre fresco.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const cities = await getAllPopulatedCities();

  // Orden por región y luego nombre: las comunas de una misma región quedan
  // juntas en la nube de pastillas, sin necesidad de encabezados.
  const sorted = [...cities].sort(
    (a, b) =>
      a.region.name.localeCompare(b.region.name) || a.name.localeCompare(b.name),
  );

  return (
    <div>
      <section className="mb-8 text-center sm:text-left">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          <span className="mr-2 align-middle text-vip" aria-hidden>✦</span>
          Anuncios{" "}
          <span className="text-gold">verificados</span>{" "}
          en Chile
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg text-neutral-400 sm:mx-0">
          Elige tu comuna y explora perfiles con identidad verificada.
        </p>
      </section>

      {cities.length === 0 ? (
        <p className="text-center text-sm text-neutral-400">
          Aún no hay anuncios activos. Vuelve pronto.
        </p>
      ) : (
        <section>
          <div className="mb-6 text-center">
            <h2 className="font-display text-2xl font-semibold tracking-tight">
              <span className="text-vip" aria-hidden>📍</span> Elige tu comuna
            </h2>
            <div className="mx-auto mt-3 w-full max-w-xs">
              <CityPicker cities={cities} label="Buscar comuna…" />
            </div>
          </div>

          <ul className="flex flex-wrap justify-center gap-2.5 sm:gap-3">
            {sorted.map((city) => (
              <li key={city.id}>
                <Link
                  href={`/chile/${city.region.slug}/${city.slug}/${DEFAULT_GENDER_SLUG}`}
                  className="block rounded-full bg-gradient-to-b from-[#e23744] to-[#bb2230] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_3px_12px_-4px_rgba(226,55,68,0.65)] ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_6px_18px_-4px_rgba(226,55,68,0.8)]"
                >
                  {city.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
