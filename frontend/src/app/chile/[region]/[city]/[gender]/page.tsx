import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getAllPopulatedCities,
  getProfiles,
  getServices,
  type ProfileQuery,
} from "@/lib/api";
import { ProfileCard } from "@/components/ProfileCard";
import { FiltersDrawer } from "@/components/FiltersDrawer";
import { GenderTabs } from "@/components/GenderTabs";
import { CityPicker } from "@/components/CityPicker";
import {
  CATEGORY_LABEL,
  GENDER_BY_SLUG,
  GENDER_LABEL,
  type GenderSlug,
  type ServiceCategory,
} from "@/lib/types";

type Params = Promise<{ region: string; city: string; gender: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

function isGenderSlug(s: string): s is GenderSlug {
  return s === "todos" || s === "mujeres" || s === "trans" || s === "hombres";
}

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
  const { region, city, gender } = await params;
  if (!isGenderSlug(gender)) return {};
  const cityName = titleize(city);
  const title =
    gender === "todos"
      ? `Anuncios en ${cityName}`
      : `${GENDER_LABEL[gender]} en ${cityName}`;
  const description =
    gender === "todos"
      ? `Perfiles con identidad verificada en ${cityName}.`
      : `${GENDER_LABEL[gender]} con identidad verificada en ${cityName}.`;
  return {
    title,
    description,
    alternates: { canonical: `/chile/${region}/${city}/${gender}` },
  };
}

export default async function CityPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { region, city, gender } = await params;
  if (!isGenderSlug(gender)) notFound();
  const sp = await searchParams;

  const query: ProfileQuery = {
    // `todos` no envía filtro → backend devuelve mujeres + trans + hombres.
    gender: GENDER_BY_SLUG[gender],
    tag: pickArray(sp.tag) ?? pickArray(sp.service),
    min_age: pickString(sp.min_age),
    max_age: pickString(sp.max_age),
    min_rate: pickString(sp.min_rate),
    max_rate: pickString(sp.max_rate),
    page: pickString(sp.page),
    available_now: pickString(sp.available_now),
  };
  const availableNow = query.available_now === "true";

  const [data, services, allCities] = await Promise.all([
    getProfiles(region, city, query),
    getServices(),
    getAllPopulatedCities(),
  ]);

  const page = Number(query.page ?? "1");
  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(data.count / pageSize));
  const cityName = titleize(city);
  const selectedTags = new Set(query.tag ?? []);

  const byCategory = services.reduce<Record<ServiceCategory, typeof services>>(
    (acc, s) => {
      (acc[s.category] ||= []).push(s);
      return acc;
    },
    { service: [], extra: [], feature: [] },
  );

  // Cuántos filtros activos hay → badge en el botón "Filtros" móvil.
  const activeCount =
    (query.tag?.length ?? 0) +
    (["min_age", "max_age", "min_rate", "max_rate"] as const).filter((k) => query[k]).length +
    (availableNow ? 1 : 0);

  const baseHref = `/chile/${region}/${city}/${gender}`;
  const withParams = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    query.tag?.forEach((s) => p.append("tag", s));
    for (const k of ["min_age", "max_age", "min_rate", "max_rate", "page", "available_now"] as const) {
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
    <>
      {/* Header siempre primero (en mobile y desktop). */}
      <div className="mb-4">
        <p className="text-sm text-neutral-500">
          <Link href="/" className="hover:text-pink-400">
            Chile
          </Link>{" "}
          /{" "}
          <Link href={`/chile/${region}`} className="hover:text-pink-400">
            {titleize(region)}
          </Link>{" "}
          / {cityName}
        </p>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {gender === "todos"
              ? `Anuncios en ${cityName}`
              : `${GENDER_LABEL[gender]} en ${cityName}`}
          </h1>
          <p className="text-xs text-neutral-500">
            {data.count} resultado{data.count === 1 ? "" : "s"}
          </p>
        </div>
        <div className="mt-3 max-w-xs">
          <CityPicker
            cities={allCities}
            label={`Cambiar comuna · ${cityName}`}
            currentCitySlug={city}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <GenderTabs region={region} city={city} current={gender} />
          <Link
            href={withParams({
              available_now: availableNow ? undefined : "true",
              page: undefined,
            })}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
              availableNow
                ? "border-emerald-500 bg-emerald-600/20 text-emerald-200"
                : "border-neutral-700 text-neutral-400 hover:border-emerald-500"
            }`}
          >
            <span className="relative flex h-2 w-2">
              {availableNow && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${
                  availableNow ? "bg-emerald-400" : "bg-neutral-500"
                }`}
              />
            </span>
            Disponibles ahora
          </Link>
        </div>
      </div>

      <div className="md:grid md:grid-cols-[18rem_1fr] md:gap-8">
        <FiltersDrawer activeCount={activeCount}>
        <form method="get" className="space-y-5 text-sm">
          {(["service", "extra", "feature"] as const).map((cat) =>
            byCategory[cat].length === 0 ? null : (
              <fieldset key={cat} className="space-y-2">
                <legend className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  {CATEGORY_LABEL[cat]}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {byCategory[cat].map((s) => {
                    const checked = selectedTags.has(s.slug);
                    return (
                      <label
                        key={s.id}
                        className={`cursor-pointer select-none rounded-full border px-3 py-1.5 text-sm transition ${
                          checked
                            ? "border-pink-500 bg-pink-600/20 text-pink-200"
                            : "border-neutral-700 text-neutral-300 active:scale-95 hover:border-pink-500"
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
            <div className="mt-2 flex gap-2">
              <input
                name="min_age"
                type="number"
                inputMode="numeric"
                min={18}
                placeholder="Desde"
                defaultValue={query.min_age}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base"
              />
              <input
                name="max_age"
                type="number"
                inputMode="numeric"
                min={18}
                placeholder="Hasta"
                defaultValue={query.max_age}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base"
              />
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Tarifa (CLP)
            </legend>
            <div className="mt-2 flex gap-2">
              <input
                name="min_rate"
                type="number"
                inputMode="numeric"
                min={0}
                step={1000}
                placeholder="Mínimo"
                defaultValue={query.min_rate}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base"
              />
              <input
                name="max_rate"
                type="number"
                inputMode="numeric"
                min={0}
                step={1000}
                placeholder="Máximo"
                defaultValue={query.max_rate}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base"
              />
            </div>
          </fieldset>

          <div className="flex gap-2 pt-2">
            <button className="flex-1 rounded-full bg-pink-600 px-4 py-2.5 text-sm font-medium hover:bg-pink-500">
              Aplicar
            </button>
            <Link
              href={baseHref}
              className="rounded-full border border-neutral-700 px-4 py-2.5 text-sm text-neutral-400 hover:text-neutral-100"
            >
              Limpiar
            </Link>
          </div>
        </form>
      </FiltersDrawer>

      <section className="mt-4 md:mt-0">
        {data.results.length === 0 ? (
          <p className="text-neutral-400">No hay perfiles que coincidan con los filtros.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:gap-4">
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
                className="rounded-full border border-neutral-700 px-4 py-2 hover:border-pink-600"
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
                className="rounded-full border border-neutral-700 px-4 py-2 hover:border-pink-600"
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
    </>
  );
}
