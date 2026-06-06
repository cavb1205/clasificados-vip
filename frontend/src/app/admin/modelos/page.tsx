"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, dashboard } from "@/lib/client-api";
import { Pager } from "@/components/Pager";
import { NotifyButton } from "@/components/NotifyButton";

interface AdminProfile {
  id: number;
  user_id: number;
  stage_name: string;
  slug: string;
  gender: "female" | "trans" | "male";
  age: number;
  email: string;
  username: string;
  city_name: string | null;
  verification_status: "pending" | "verified" | "rejected";
  is_suspended: boolean;
  suspension_reason: string;
  photo_authenticity: "pending" | "none" | "light" | "heavy";
  photos: string[];
  created_at: string;
  active_publication_count: number;
}

const AUTH_SET: { value: "none" | "light" | "heavy"; label: string }[] = [
  { value: "none", label: "🟢 Sin retoque" },
  { value: "light", label: "🟡 Leve" },
  { value: "heavy", label: "🟠 Con retoque" },
];

type Tab = "" | "pending" | "verified" | "rejected" | "suspended" | "photo_pending";

const AUTH_BADGE: Record<string, { label: string; cls: string }> = {
  none: { label: "🟢 Sin retoque", cls: "bg-emerald-600/20 text-emerald-200" },
  light: { label: "🟡 Retoque leve", cls: "bg-amber-600/20 text-amber-200" },
  heavy: { label: "🟠 Con retoque", cls: "bg-orange-600/20 text-orange-200" },
  pending: { label: "Fotos por revisar", cls: "bg-pink-600/20 text-pink-200" },
};

const GENDER_LABEL: Record<string, string> = {
  female: "Mujer",
  trans: "Trans",
  male: "Hombre",
};

export default function AdminModelosPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>((searchParams.get("status") as Tab) || "");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<AdminProfile[]>([]);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [ready, setReady] = useState(false);
  // Admin o moderador pueden suspender/reactivar.
  const [canModerate, setCanModerate] = useState(false);

  const reload = useCallback(async (query: string, which: Tab, p = 1) => {
    const d = await dashboard.adminProfiles(query, which, p);
    setItems(d.results as AdminProfile[]);
    setCount(d.count);
    setPage(p);
  }, []);

  useEffect(() => {
    auth
      .me()
      .then((me) => {
        const u = me as { is_staff?: boolean; role?: string } | null;
        setCanModerate(!!u?.is_staff || u?.role === "moderator");
        return reload("", tab);
      })
      .then(() => setReady(true))
      .catch(() => router.replace("/login?next=/admin/modelos"));
  }, [router, reload]);

  // Debounce simple del buscador.
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => reload(q, tab), 300);
    return () => clearTimeout(id);
  }, [q, tab, ready, reload]);

  async function suspend(p: AdminProfile) {
    const reason = window.prompt(
      `Motivo para suspender a ${p.stage_name} (visible para staff):`,
    );
    if (reason === null) return;
    setBusyId(p.id);
    try {
      await dashboard.adminProfileAction(p.id, "suspend", reason);
      await reload(q, tab);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  }
  async function unsuspend(p: AdminProfile) {
    if (!confirm(`¿Reactivar a ${p.stage_name}?`)) return;
    setBusyId(p.id);
    try {
      await dashboard.adminProfileAction(p.id, "unsuspend");
      await reload(q, tab);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  }
  async function classify(p: AdminProfile, value: "none" | "light" | "heavy") {
    setBusyId(p.id);
    try {
      await dashboard.adminSetAuthenticity(p.id, value);
      await reload(q, tab);
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
          <Link href="/admin" className="hover:text-pink-400">
            Admin
          </Link>{" "}
          / Modelos
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
          Modelos del catálogo
        </h1>
      </header>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, email, slug o comuna…"
          className="w-full rounded-full border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm outline-none focus:border-pink-500 sm:max-w-sm"
        />
        <nav className="flex gap-2 overflow-x-auto">
          {(
            [
              ["", "Todas"],
              ["pending", "KYC pendiente"],
              ["verified", "Verificadas"],
              ["photo_pending", "Fotos por revisar"],
              ["rejected", "Rechazadas"],
              ["suspended", "Suspendidas"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value || "all"}
              onClick={() => setTab(value as Tab)}
              className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs ${
                tab === value
                  ? "border-pink-500 bg-pink-600/20 text-pink-200"
                  : "border-neutral-700 text-neutral-400"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {err && <p className="mb-3 text-sm text-red-400">{err}</p>}

      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">Sin resultados.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((p) => (
            <li
              key={p.id}
              className={`rounded-xl border bg-neutral-900 p-4 ${
                p.is_suspended
                  ? "border-red-500/40"
                  : "border-neutral-800"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    <Link
                      href={`/admin/modelos/${p.id}`}
                      className="hover:text-pink-300"
                    >
                      {p.stage_name}
                    </Link>{" "}
                    <Link
                      href={`/perfil/${p.slug}`}
                      className="text-xs font-normal text-sky-400 hover:underline"
                    >
                      ↗
                    </Link>{" "}
                    <span className="text-xs text-neutral-500">
                      · {GENDER_LABEL[p.gender]} · {p.age} años
                      {p.city_name && ` · ${p.city_name}`}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {p.username} · {p.email}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-1.5 text-xs">
                    <Badge tone={p.verification_status}>
                      KYC: {p.verification_status}
                    </Badge>
                    {p.is_suspended && <Badge tone="suspended">Suspendida</Badge>}
                    <Badge tone="info">
                      {p.active_publication_count} pub activa
                      {p.active_publication_count === 1 ? "" : "s"}
                    </Badge>
                    {AUTH_BADGE[p.photo_authenticity] && (
                      <span className={`rounded-full px-2 py-0.5 ${AUTH_BADGE[p.photo_authenticity].cls}`}>
                        {AUTH_BADGE[p.photo_authenticity].label}
                      </span>
                    )}
                  </p>
                  {p.is_suspended && p.suspension_reason && (
                    <p className="mt-2 text-xs text-red-300">
                      Motivo: {p.suspension_reason}
                    </p>
                  )}
                </div>
                {canModerate && (
                  <div className="flex flex-wrap gap-2">
                    <NotifyButton userId={p.user_id} name={p.stage_name} onError={setErr} />
                    {p.is_suspended ? (
                      <button
                        disabled={busyId === p.id}
                        onClick={() => unsuspend(p)}
                        className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                      >
                        Reactivar
                      </button>
                    ) : (
                      <button
                        disabled={busyId === p.id}
                        onClick={() => suspend(p)}
                        className="rounded-full border border-red-500 px-3 py-1.5 text-xs text-red-300 hover:bg-red-600/20 disabled:opacity-50"
                      >
                        Suspender
                      </button>
                    )}
                  </div>
                )}
              </div>

              {tab === "photo_pending" && canModerate && (
                <div className="mt-3 border-t border-neutral-800 pt-3">
                  {p.photos.length > 0 ? (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {p.photos.map((url) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={url} src={url} alt="" className="h-24 w-20 rounded-lg object-cover" />
                      ))}
                    </div>
                  ) : (
                    <p className="mb-2 text-xs text-neutral-500">Sin fotos visibles.</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-neutral-400">Clasificar:</span>
                    {AUTH_SET.map((o) => (
                      <button
                        key={o.value}
                        disabled={busyId === p.id}
                        onClick={() => classify(p, o.value)}
                        className="rounded-full border border-neutral-700 px-3 py-1 text-xs hover:border-pink-500 disabled:opacity-50"
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <Pager page={page} count={count} onPage={(p) => reload(q, tab, p)} />
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "pending" | "verified" | "rejected" | "suspended" | "info";
}) {
  const map = {
    pending: "bg-amber-600/20 text-amber-200",
    verified: "bg-emerald-600/20 text-emerald-200",
    rejected: "bg-neutral-700 text-neutral-300",
    suspended: "bg-red-600/20 text-red-200",
    info: "bg-neutral-800 text-neutral-300",
  } as const;
  return (
    <span className={`rounded-full px-2 py-0.5 ${map[tone]}`}>{children}</span>
  );
}
