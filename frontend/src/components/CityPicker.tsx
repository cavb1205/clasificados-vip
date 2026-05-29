"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { City } from "@/lib/types";
import { DEFAULT_GENDER_SLUG } from "@/lib/types";

/**
 * Selector global de comuna: dropdown con búsqueda en cliente.
 * Lo usamos tanto en la home como en la cabecera de la página de comuna
 * ("Cambiar comuna") para que el usuario salte directo a otra ciudad sin
 * tener que pasar por la jerarquía región → ciudad.
 */
export function CityPicker({
  cities,
  label = "Elige una comuna",
  currentCitySlug,
}: {
  cities: City[];
  label?: string;
  currentCitySlug?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return cities;
    return cities.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        c.region.name.toLowerCase().includes(needle),
    );
  }, [cities, q]);

  function go(c: City) {
    setOpen(false);
    setQ("");
    router.push(`/chile/${c.region.slug}/${c.slug}/${DEFAULT_GENDER_SLUG}`);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 rounded-full border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm hover:border-pink-500"
        aria-expanded={open}
      >
        <span className="truncate">
          <span className="text-neutral-500">📍 </span>
          {label}
        </span>
        <span aria-hidden className="text-neutral-500">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-2 max-h-80 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 shadow-xl">
          <div className="border-b border-neutral-800 p-2">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar comuna o región…"
              className="w-full rounded-lg bg-neutral-900 px-3 py-2 text-sm outline-none placeholder:text-neutral-500"
            />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-neutral-500">
                Sin resultados.
              </li>
            ) : (
              filtered.map((c) => {
                const active = c.slug === currentCitySlug;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => go(c)}
                      className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm hover:bg-neutral-900 ${
                        active ? "bg-neutral-900 text-pink-300" : ""
                      }`}
                    >
                      <span>{c.name}</span>
                      <span className="text-xs text-neutral-500">
                        {c.region.name}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
