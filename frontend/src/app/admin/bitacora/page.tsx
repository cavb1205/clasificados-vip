"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, dashboard } from "@/lib/client-api";
import { Pager } from "@/components/Pager";

interface LogRow {
  id: number;
  actor_email: string;
  action: string;
  target: string;
  note: string;
  created_at: string;
}

const ACTIONS = [
  ["", "Todas las acciones"],
  ["kyc.approve", "KYC aprobado"],
  ["kyc.reject", "KYC rechazado"],
  ["payment.approve", "Pago aprobado"],
  ["payment.reject", "Pago rechazado"],
  ["room_payment.approve", "Pago habitación aprobado"],
  ["room_payment.reject", "Pago habitación rechazado"],
  ["model.suspend", "Modelo suspendida"],
  ["model.unsuspend", "Modelo reactivada"],
  ["host.suspend", "Anfitrión suspendido"],
  ["host.unsuspend", "Anfitrión reactivado"],
  ["room.suspend", "Habitación suspendida"],
  ["user.suspend", "Usuario suspendido"],
  ["user.unsuspend", "Usuario reactivado"],
] as const;

export default function AdminBitacoraPage() {
  const router = useRouter();
  const [action, setAction] = useState("");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<LogRow[]>([]);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [ready, setReady] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const reload = useCallback(async (a: string, query: string, p = 1) => {
    const d = await dashboard.adminActionLog(a, query, p);
    setItems(d.results as LogRow[]);
    setCount(d.count);
    setPage(p);
  }, []);

  useEffect(() => {
    auth
      .me()
      .then((me) => {
        if (!(me as { is_staff?: boolean })?.is_staff) {
          setForbidden(true);
          setReady(true);
          return;
        }
        return reload("", "").then(() => setReady(true));
      })
      .catch(() => router.replace("/login?next=/admin/bitacora"));
  }, [router, reload]);

  useEffect(() => {
    if (!ready || forbidden) return;
    const t = setTimeout(() => reload(action, q, 1), 300);
    return () => clearTimeout(t);
  }, [action, q, ready, forbidden, reload]);

  if (!ready) return <p className="text-neutral-400">Cargando…</p>;
  if (forbidden) return <p className="text-red-400">Necesitas permisos de administrador.</p>;

  return (
    <div>
      <header className="mb-4">
        <p className="text-sm text-neutral-500">
          <Link href="/admin" className="hover:text-pink-400">Admin</Link> / Bitácora
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Bitácora de acciones</h1>
        <p className="mt-1 text-sm text-neutral-400">Registro de quién hizo cada acción sensible del panel.</p>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        <select value={action} onChange={(e) => setAction(e.target.value)}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm">
          {ACTIONS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por objetivo, nota o quién…"
          className="w-full max-w-xs rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm" />
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">Sin registros.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((r) => (
            <li key={r.id} className="rounded-xl border border-neutral-800 bg-neutral-900 p-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p>
                  <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">{r.action}</span>{" "}
                  <span className="text-neutral-200">{r.target}</span>
                </p>
                <span className="text-xs text-neutral-600">{new Date(r.created_at).toLocaleString("es-CL")}</span>
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                por {r.actor_email}{r.note && ` · ${r.note}`}
              </p>
            </li>
          ))}
        </ul>
      )}
      <Pager page={page} count={count} onPage={(p) => reload(action, q, p)} />
    </div>
  );
}
