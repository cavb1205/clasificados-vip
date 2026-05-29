import Link from "next/link";
import type { Metadata } from "next";
import { searchProfiles } from "@/lib/api";
import { ProfileCard } from "@/components/ProfileCard";

type Search = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: "Buscar",
  description: "Busca perfiles verificados por nombre o descripción.",
  robots: { index: false },
};

function pick(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SearchPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const q = pick(sp.q) ?? "";
  const page = pick(sp.page);

  const data = q ? await searchProfiles({ q, page }) : null;
  const pageNum = Number(page ?? "1");
  const totalPages = data ? Math.max(1, Math.ceil(data.count / 12)) : 0;

  const withPage = (n: number) => {
    const p = new URLSearchParams({ q });
    if (n > 1) p.set("page", String(n));
    return `/buscar?${p.toString()}`;
  };

  return (
    <div className="space-y-6">
      <form method="get" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre o descripción…"
          className="w-full rounded-full border border-neutral-700 bg-neutral-900 px-4 py-2"
          autoFocus
        />
        <button className="rounded-full bg-pink-600 px-5 py-2 font-medium hover:bg-pink-500">
          Buscar
        </button>
      </form>

      {!q && (
        <p className="text-neutral-500">Escribe un término para empezar a buscar.</p>
      )}

      {data && (
        <>
          <p className="text-sm text-neutral-500">
            {data.count} resultado{data.count === 1 ? "" : "s"} para &quot;{q}&quot;
          </p>
          {data.results.length === 0 ? (
            <p className="text-neutral-400">Ningún perfil coincide con esa búsqueda.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
              {data.results.map((p) => (
                <li key={p.slug}>
                  <ProfileCard profile={p} />
                </li>
              ))}
            </ul>
          )}
          {totalPages > 1 && (
            <nav className="flex items-center justify-between text-sm">
              {data.previous ? (
                <Link
                  href={withPage(pageNum - 1)}
                  className="rounded-full border border-neutral-700 px-4 py-1.5 hover:border-pink-600"
                >
                  ← Anterior
                </Link>
              ) : (
                <span />
              )}
              <span className="text-neutral-500">
                Página {pageNum} de {totalPages}
              </span>
              {data.next ? (
                <Link
                  href={withPage(pageNum + 1)}
                  className="rounded-full border border-neutral-700 px-4 py-1.5 hover:border-pink-600"
                >
                  Siguiente →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
