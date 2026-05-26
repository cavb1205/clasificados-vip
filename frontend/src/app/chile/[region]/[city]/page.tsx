import Link from "next/link";
import type { Metadata } from "next";
import { getProfiles, getServices, type ProfileQuery } from "@/lib/api";
import { ProfileCard } from "@/components/ProfileCard";
import { CATEGORY_LABEL, type ServiceCategory } from "@/lib/types";

type Params = Promise<{ region: string; city: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

function titleize(slug: string) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function pickString(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
function pickArray(v: string | string[] | undefined): string[] | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v : [v];
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

export default async function CityPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { region, city } = await params;
  const sp = await searchParams;

  const query: ProfileQuery = {
    tag: pickArray(sp.tag) ?? pickArray(sp.service),  // 'service' por compatibilidad
    min_age: pickString(sp.min_age),
    max_age: pickString(sp.max_age),
    min_rate: pickString(sp.min_rate),
    max_rate: pickString(sp.max_rate),
    page: pickString(sp.page),
  };

  const [data, services] = await Promise.all([
    getProfiles(region, city, query),
    getServices(),
  ]);

  const page = Number(query.page ?? "1");
  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(data.count / pageSize));
  const cityName = titleize(city);
  const selectedTags = new Set(query.tag ?? []);

  // Agrupar el catálogo por categoría para mostrar fieldsets distintos.
  const byCategory = services.reduce<Record<ServiceCategory, typeof services>>(
    (acc, s) => {
      (acc[s.category] ||= []).push(s);
      return acc;
    },
    { service: [], extra: [], feature: [] },
  );

  // Helper para construir URL preservando filtros (cambiando página o limpiando).
  const baseHref = `/chile/${region}/${city}`;
  const withParams = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    query.tag?.forEach((s) => p.append("tag", s));
    for (const k of ["min_age", "max_age", "min_rate", "max_rate", "page"] as const) {
      if (query[k]) p.set(k, query[k] as string);
    }
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) p.delete(k);
      else p.set(k, v);
    }
    const s = p.toString();
    return s ? `${baseHref}?${s}` : baseHref;
  };

  return (
    <div className="grid gap-8 md:grid-cols-[16rem_1fr]">
      <aside>
        <p className="text-sm text-neutral-500">
          <Link href={`/chile/${region}`} className="hover:text-pink-400">
            {titleize(region)}
          </Link>{" "}
          / {cityName}
        </p>
        <h1 className="mt-1 text-2xl font-bold">{cityName}</h1>
        <p className="mt-1 text-xs text-neutral-500">{data.count} resultado(s)</p>

        <form method="get" className="mt-6 space-y-5 text-sm">
          {(["service", "extra", "feature"] as const).map((cat) =>
            byCategory[cat].length === 0 ? null : (
              <fieldset key={cat} className="space-y-1">
                <legend className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  {CATEGORY_LABEL[cat]}
                </legend>
                <div className="flex flex-wrap gap-1.5">
                  {byCategory[cat].map((s) => {
                    const checked = selectedTags.has(s.slug);
                    return (
                      <label
                        key={s.id}
                        className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-xs ${
                          checked
                            ? "border-pink-500 bg-pink-600/20 text-pink-200"
                            : "border-neutral-700 text-neutral-400 hover:border-pink-500"
                        }`}
                      >
                        <input
                          type="checkbox"
                          name="tag"
                          value={s.slug}
                          defaultChecked={checked}
                          className="sr-only"
                        />
                        {s.name}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ),
          )}

          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Edad
            </legend>
            <div className="mt-1 flex gap-2">
              <input
                name="min_age"
                type="number"
                min={18}
                placeholder="Desde"
                defaultValue={query.min_age}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1"
              />
              <input
                name="max_age"
                type="number"
                min={18}
                placeholder="Hasta"
                defaultValue={query.max_age}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1"
              />
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Tarifa (CLP)
            </legend>
            <div className="mt-1 flex gap-2">
              <input
                name="min_rate"
                type="number"
                min={0}
                step={1000}
                placeholder="Mínimo"
                defaultValue={query.min_rate}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1"
              />
              <input
                name="max_rate"
                type="number"
                min={0}
                step={1000}
                placeholder="Máximo"
                defaultValue={query.max_rate}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1"
              />
            </div>
          </fieldset>

          <div className="flex gap-2">
            <button className="flex-1 rounded-full bg-pink-600 px-4 py-1.5 font-medium hover:bg-pink-500">
              Filtrar
            </button>
            <Link
              href={baseHref}
              className="rounded-full border border-neutral-700 px-3 py-1.5 text-neutral-400 hover:text-neutral-100"
            >
              Limpiar
            </Link>
          </div>
        </form>
      </aside>

      <section>
        {data.results.length === 0 ? (
          <p className="text-neutral-400">
            No hay perfiles que coincidan con los filtros.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {data.results.map((p) => (
              <li key={p.slug}>
                <ProfileCard profile={p} />
              </li>
            ))}
          </ul>
        )}

        {totalPages > 1 && (
          <nav className="mt-8 flex items-center justify-between text-sm">
            {data.previous ? (
              <Link
                href={withParams({ page: page > 2 ? String(page - 1) : undefined })}
                className="rounded-full border border-neutral-700 px-4 py-1.5 hover:border-pink-600"
              >
                ← Anterior
              </Link>
            ) : (
              <span />
            )}
            <span className="text-neutral-500">
              Página {page} de {totalPages}
            </span>
            {data.next ? (
              <Link
                href={withParams({ page: String(page + 1) })}
                className="rounded-full border border-neutral-700 px-4 py-1.5 hover:border-pink-600"
              >
                Siguiente →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
    </div>
  );
}
