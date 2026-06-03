"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, rooms } from "@/lib/client-api";
import { Pager } from "@/components/Pager";

interface AdminHost {
  id: number;
  display_name: string;
  email: string;
  whatsapp: string;
  plan_name: string | null;
  subscription_active: boolean;
  plan_expires_at: string | null;
  listings_total: number;
  listings_active: number;
  is_suspended: boolean;
  suspension_reason: string;
  created_at: string;
}

export default function AdminAnfitrionesPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<AdminHost[]>([]);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [isStaff, setIsStaff] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [ready, setReady] = useState(false);

  const reload = useCallback(async (query: string, p = 1) => {
    const d = await rooms.adminHosts(query, "", p);
    setItems(d.results as AdminHost[]);
    setCount(d.count);
    setPage(p);
  }, []);

  useEffect(() => {
    auth
      .me()
      .then((me) => {
        setIsStaff(!!(me as { is_staff?: boolean })?.is_staff);
        return reload("");
      })
      .then(() => setReady(true))
      .catch(() => router.replace("/login?next=/admin/anfitriones"));
  }, [router, reload]);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => reload(q, 1), 300);
    return () => clearTimeout(t);
  }, [q, ready, reload]);

  async function moderate(h: AdminHost) {
    const action = h.is_suspended ? "unsuspend" : "suspend";
    let reason = "";
    if (action === "suspend") {
      const v = window.prompt("Motivo de la suspensión del anfitrión (oculta TODOS sus anuncios):");
      if (v === null) return;
      reason = v;
    }
    setBusyId(h.id);
    try {
      await rooms.adminHostAction(h.id, action, reason);
      await reload(q, page);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  }

  if (!ready) return <p className="text-neutral-400">Cargando…</p>;

  return (
    <div>
      <header className="mb-4">
        <p className="text-sm text-neutral-500">
          <Link href="/admin" className="hover:text-pink-400">Admin</Link> / Anfitriones
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Anfitriones</h1>
      </header>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nombre, email o WhatsApp…"
        className="mb-4 w-full max-w-md rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
      />
      {err && <p className="mb-3 text-sm text-red-400">{err}</p>}

      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">Sin anfitriones.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((h) => (
            <li key={h.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-neutral-900 p-4 ${h.is_suspended ? "border-red-500/40" : "border-neutral-800"}`}>
              <div className="min-w-0">
                <p className="font-medium">
                  {h.display_name}
                  {h.is_suspended && <span className="ml-2 rounded-full bg-red-600/20 px-2 py-0.5 text-xs text-red-300">Suspendido</span>}
                </p>
                <p className="text-xs text-neutral-500">
                  {h.email}{h.whatsapp && ` · ${h.whatsapp}`} · {h.listings_active}/{h.listings_total} anuncios activos
                  {h.plan_name && ` · plan: ${h.plan_name}${h.subscription_active ? "" : " (vencido)"}`}
                </p>
                {h.is_suspended && h.suspension_reason && (
                  <p className="mt-1 text-xs text-red-300">Motivo: {h.suspension_reason}</p>
                )}
              </div>
              {isStaff && (
                <button
                  disabled={busyId === h.id}
                  onClick={() => moderate(h)}
                  className={`rounded-full px-3 py-1.5 text-xs disabled:opacity-50 ${
                    h.is_suspended
                      ? "bg-emerald-600 font-medium text-white hover:bg-emerald-500"
                      : "border border-red-500 text-red-300 hover:bg-red-600/20"
                  }`}
                >
                  {h.is_suspended ? "Reactivar" : "Suspender"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <Pager page={page} count={count} onPage={(p) => reload(q, p)} />
    </div>
  );
}
