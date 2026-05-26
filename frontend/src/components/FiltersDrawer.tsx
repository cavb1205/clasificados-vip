"use client";

import { useEffect, useState } from "react";

interface Props {
  /** Cantidad de filtros activos — se muestra como badge en el trigger. */
  activeCount: number;
  children: React.ReactNode;
}

/**
 * Sidebar de filtros que en pantallas chicas se comporta como drawer:
 * - Mobile (<md): off-screen por defecto, botón "Filtros" lo abre, backdrop lo cierra.
 * - Desktop (≥md): sidebar fija, sin trigger ni backdrop.
 *
 * Misma instancia de los children en ambos modos → no duplicamos el form.
 */
export function FiltersDrawer({ activeCount, children }: Props) {
  const [open, setOpen] = useState(false);

  // Bloquear scroll del body cuando el drawer está abierto en mobile.
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  // Cerrar con Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Trigger: solo en mobile */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden inline-flex w-full items-center justify-center gap-2 rounded-full border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm font-medium hover:border-pink-600"
      >
        <span aria-hidden>⚙</span>
        Filtros
        {activeCount > 0 && (
          <span className="rounded-full bg-pink-600 px-2 py-0.5 text-xs font-semibold text-white">
            {activeCount}
          </span>
        )}
      </button>

      {/* Backdrop: solo en mobile con drawer abierto */}
      {open && (
        <button
          type="button"
          aria-label="Cerrar filtros"
          onClick={() => setOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        />
      )}

      {/* Panel */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] overflow-y-auto
          border-r border-neutral-800 bg-neutral-950 p-4 transition-transform
          ${open ? "translate-x-0" : "-translate-x-full"}
          md:static md:z-auto md:w-auto md:max-w-none md:translate-x-0
          md:overflow-visible md:border-0 md:bg-transparent md:p-0
        `}
        aria-hidden={!open}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="md:hidden mb-4 inline-flex items-center gap-2 text-sm text-neutral-400"
        >
          ✕ Cerrar
        </button>
        {children}
      </aside>
    </>
  );
}
