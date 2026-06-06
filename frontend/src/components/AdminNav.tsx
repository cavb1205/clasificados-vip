"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { auth, dashboard } from "@/lib/client-api";

interface Stats {
  pending_kyc?: number;
  pending_payments?: number;
  pending_room_payments?: number;
  pending_reviews?: number;
  open_reports?: number;
  pending_photo_review?: number;
}

interface Item {
  href: string;
  label: string;
  badge?: keyof Stats;
  /** Si true, solo visible para usuarios con is_staff. */
  adminOnly?: boolean;
}

const ITEMS: Item[] = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/kyc", label: "Verificaciones", badge: "pending_kyc", adminOnly: true },
  { href: "/admin/pagos", label: "Pagos", badge: "pending_payments", adminOnly: true },
  { href: "/admin/resenas", label: "Reseñas", badge: "pending_reviews" },
  { href: "/admin/reportes", label: "Reportes", badge: "open_reports" },
  { href: "/admin/modelos", label: "Modelos", badge: "pending_photo_review" },
  { href: "/admin/anfitriones", label: "Anfitriones" },
  { href: "/admin/habitaciones", label: "Habitaciones", badge: "pending_room_payments" },
  { href: "/admin/usuarios", label: "Usuarios", adminOnly: true },
  { href: "/admin/config", label: "Configuración", adminOnly: true },
  { href: "/admin/bitacora", label: "Bitácora", adminOnly: true },
  { href: "/admin/auditoria", label: "Auditoría KYC", adminOnly: true },
];

/**
 * Nav del panel admin con visibilidad por rol:
 * - is_staff (admin) ve todo.
 * - role=moderator ve solo lo no marcado adminOnly (reseñas, reportes,
 *   modelos en lectura, resumen).
 */
export function AdminNav() {
  const pathname = usePathname();
  const [stats, setStats] = useState<Stats>({});
  const [isStaff, setIsStaff] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    auth
      .me()
      .then((me) => {
        const u = me as { is_staff?: boolean } | null;
        if (alive) setIsStaff(!!u?.is_staff);
      })
      .catch(() => alive && setIsStaff(false));
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

  const visibleItems = ITEMS.filter((i) => !i.adminOnly || isStaff);

  const totalPending =
    (stats.pending_kyc ?? 0) +
    (stats.pending_payments ?? 0) +
    (stats.pending_room_payments ?? 0) +
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
          {visibleItems.find((i) => i.href === pathname)?.label ?? ""}
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
              <p className="font-display text-lg font-semibold">
                {isStaff ? "Admin" : "Moderación"}
              </p>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full px-2 py-1 text-xl text-neutral-400 hover:text-pink-300"
                aria-label="Cerrar menú"
              >
                ✕
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {visibleItems.map((it) => (
                <NavLink key={it.href} item={it} pathname={pathname} stats={stats} />
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Desktop tabs */}
      <nav className="hidden flex-wrap gap-2 md:flex">
        {visibleItems.map((it) => (
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
