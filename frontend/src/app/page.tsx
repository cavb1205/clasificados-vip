import Link from "next/link";
import { getRegions } from "@/lib/api";

// Renderiza por request (no pre-render en build): evita que el build falle si
// el backend está reiniciándose, y mantiene el listado siempre fresco.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const regions = await getRegions();

  return (
    <div>
      <section className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">
          Anuncios verificados en Chile
        </h1>
        <p className="mt-2 max-w-2xl text-neutral-400">
          Explora perfiles por región y comuna. Todos los anuncios activos pertenecen a
          perfiles con identidad verificada.
        </p>
      </section>

      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Regiones
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {regions.map((region) => (
          <li key={region.id}>
            <Link
              href={`/chile/${region.slug}`}
              className="block rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm hover:border-pink-600"
            >
              {region.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
