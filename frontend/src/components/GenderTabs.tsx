import Link from "next/link";
import {
  ALL_GENDER_SLUGS,
  GENDER_LABEL,
  type GenderSlug,
} from "@/lib/types";

/**
 * Tabs de categoría (Mujeres / Trans / Hombres). Cada tab es un Link a la
 * misma comuna con el slug de género distinto, manteniendo cualquier filtro.
 */
export function GenderTabs({
  region,
  city,
  current,
  searchParams,
}: {
  region: string;
  city: string;
  current: GenderSlug;
  /** querystring (sin el "?") que se quiere preservar al cambiar de tab. */
  searchParams?: string;
}) {
  const suffix = searchParams ? `?${searchParams}` : "";
  return (
    <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Categorías">
      {ALL_GENDER_SLUGS.map((slug) => {
        const active = slug === current;
        return (
          <Link
            key={slug}
            href={`/chile/${region}/${city}/${slug}${suffix}`}
            className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition ${
              active
                ? "border-pink-500 bg-pink-600/20 text-pink-200"
                : "border-neutral-700 text-neutral-300 hover:border-pink-500"
            }`}
            aria-current={active ? "page" : undefined}
          >
            {GENDER_LABEL[slug]}
          </Link>
        );
      })}
    </nav>
  );
}
