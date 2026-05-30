"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { dashboard } from "@/lib/client-api";

interface Stats {
  pending_kyc?: number;
  pending_payments?: number;
  pending_reviews?: number;
  open_reports?: number;
}

interface Item {
  href: string;
  label: string;
  badge?: keyof Stats;
}

const ITEMS: Item[] = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/kyc", label: "Verificaciones", badge: "pending_kyc" },
  { href: "/admin/pagos", label: "Pagos", badge: "pending_payments" },
  { href: "/admin/resenas", label: "Reseñas", badge: "pending_reviews" },
  { href: "/admin/reportes", label: "Reportes", badge: "open_reports" },
  { href: "/admin/modelos", label: "Modelos" },
  { href: "/admin/config", label: "Configuración" },
  { href: "/admin/auditoria", label: "Auditoría KYC" },
];

/**
 * Barra de navegación del panel admin.
 * - Desktop (md+): tabs horizontales con badges de pendientes.
 * - Móvil: botón hamburguesa que abre un drawer lateral.
 * Los badges se cargan en background; un fallo silencioso muestra 0.
 */
export function AdminNav() {
  const pathname = usePathname();
  const [stats, setStats] = useState<Stats>({});
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    dashboard
      .adminStats()
      .then((s) => alive && setStats(s as Stats))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pathname]);

  // Cierra el drawer al cambiar de ruta.
  useEffect(() => setOpen(false), [pathname]);

  const totalPending =
    (stats.pending_kyc ?? 0) +
    (stats.pending_payments ?? 0) +
    (stats.pending_reviews ?? 0) +
    (stats.open_reports ?? 0);

  return (
    <>
      {/* Mobile bar */}
      <div className="flex items-center justify-between md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative inline-flex items-center gap-2 rounded-full border border-neutral-700 px-4 py-2 text-sm hover:border-pink-500"
          aria-label="Abrir menú admin"
        >
          <span aria-hidden>☰</span>
          <span>Admin</span>
          {totalPending > 0 && (
            <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-pink-600 px-1.5 text-xs font-semibold text-white">
              {totalPending}
            </span>
          )}
        </button>
        <p className="font-display text-sm text-neutral-400">
          {ITEMS.find((i) => i.href === pathname)?.label ?? ""}
        </p>
      </div>

      {/* Drawer mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/70 md:hidden"
          onClick={() => setOpen(false)}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto border-r border-neutral-800 bg-neutral-950 p-4"
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="font-display text-lg font-semibold">Admin</p>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full px-2 py-1 text-xl text-neutral-400 hover:text-pink-300"
                aria-label="Cerrar menú"
              >
                ✕
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {ITEMS.map((it) => (
                <NavLink key={it.href} item={it} pathname={pathname} stats={stats} />
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Desktop tabs */}
      <nav className="hidden flex-wrap gap-2 md:flex">
        {ITEMS.map((it) => (
          <NavLink key={it.href} item={it} pathname={pathname} stats={stats} />
        ))}
      </nav>
    </>
  );
}

function NavLink({
  item,
  pathname,
  stats,
}: {
  item: Item;
  pathname: string;
  stats: Stats;
}) {
  const active =
    item.href === "/admin"
      ? pathname === "/admin"
      : pathname.startsWith(item.href);
  const count = item.badge ? stats[item.badge] ?? 0 : 0;
  return (
    <Link
      href={item.href}
      className={`flex items-center justify-between gap-3 rounded-full border px-4 py-2 text-sm transition ${
        active
          ? "border-pink-500 bg-pink-600/20 text-pink-200"
          : "border-neutral-800 text-neutral-300 hover:border-pink-500"
      }`}
    >
      <span>{item.label}</span>
      {count > 0 && (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-pink-600 px-1.5 text-xs font-semibold text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
