"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, dashboard } from "@/lib/client-api";
import { Pager } from "@/components/Pager";

interface AdminUser {
  id: number;
  email: string;
  username: string;
  role: string;
  is_active: boolean;
  email_verified: boolean;
  date_joined: string;
}

const ROLE_LABEL: Record<string, string> = {
  client: "Cliente", model: "Modelo", host: "Anfitrión", moderator: "Moderador", admin: "Admin",
};

export default function AdminUsuariosPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [items, setItems] = useState<AdminUser[]>([]);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [ready, setReady] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const reload = useCallback(async (query: string, r: string, p = 1) => {
    const d = await dashboard.adminUsers(query, r, "", p);
    setItems(d.results as AdminUser[]);
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
      .catch(() => router.replace("/login?next=/admin/usuarios"));
  }, [router, reload]);

  useEffect(() => {
    if (!ready || forbidden) return;
    const t = setTimeout(() => reload(q, role, 1), 300);
    return () => clearTimeout(t);
  }, [q, role, ready, forbidden, reload]);

  async function moderate(u: AdminUser) {
    const action = u.is_active ? "suspend" : "unsuspend";
    if (action === "suspend" && !confirm(`¿Suspender a ${u.email}? No podrá iniciar sesión.`)) return;
    setBusyId(u.id);
    try {
      await dashboard.adminUserAction(u.id, action);
      await reload(q, role, page);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  }

  if (!ready) return <p className="text-neutral-400">Cargando…</p>;
  if (forbidden) return <p className="text-red-400">Necesitas permisos de administrador.</p>;

  return (
    <div>
      <header className="mb-4">
        <p className="text-sm text-neutral-500">
          <Link href="/admin" className="hover:text-pink-400">Admin</Link> / Usuarios
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Usuarios</h1>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por email o usuario…"
          className="w-full max-w-xs rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm" />
        <select value={role} onChange={(e) => setRole(e.target.value)}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm">
          <option value="">Todos los roles</option>
          <option value="client">Clientes</option>
          <option value="model">Modelos</option>
          <option value="host">Anfitriones</option>
          <option value="moderator">Moderadores</option>
          <option value="admin">Admins</option>
        </select>
      </div>
      {err && <p className="mb-3 text-sm text-red-400">{err}</p>}

      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">Sin usuarios.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((u) => (
            <li key={u.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-neutral-900 p-4 ${u.is_active ? "border-neutral-800" : "border-red-500/40"}`}>
              <div className="min-w-0">
                <p className="font-medium">
                  {u.email}
                  {!u.is_active && <span className="ml-2 rounded-full bg-red-600/20 px-2 py-0.5 text-xs text-red-300">Suspendido</span>}
                </p>
                <p className="text-xs text-neutral-500">
                  {u.username} · {ROLE_LABEL[u.role] ?? u.role}
                  {u.email_verified ? " · email verificado" : ""} · alta {new Date(u.date_joined).toLocaleDateString("es-CL")}
                </p>
              </div>
              <button
                disabled={busyId === u.id}
                onClick={() => moderate(u)}
                className={`rounded-full px-3 py-1.5 text-xs disabled:opacity-50 ${
                  u.is_active
                    ? "border border-red-500 text-red-300 hover:bg-red-600/20"
                    : "bg-emerald-600 font-medium text-white hover:bg-emerald-500"
                }`}
              >
                {u.is_active ? "Suspender" : "Reactivar"}
              </button>
            </li>
          ))}
        </ul>
      )}
      <Pager page={page} count={count} onPage={(p) => reload(q, role, p)} />
    </div>
  );
}
