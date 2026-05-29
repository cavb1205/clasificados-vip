"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, dashboard } from "@/lib/client-api";

interface Review {
  id: number;
  stage_name: string;
  profile_slug: string;
  client_email: string;
  client_username: string;
  rating: number;
  comment: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

type Tab = "pending" | "approved" | "rejected";

export default function AdminResenasPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("pending");
  const [items, setItems] = useState<Review[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [ready, setReady] = useState(false);

  const reload = useCallback(async (which: Tab) => {
    setItems((await dashboard.adminReviews(which)) as Review[]);
  }, []);

  useEffect(() => {
    auth
      .me()
      .then(() => reload("pending"))
      .then(() => setReady(true))
      .catch(() => router.replace("/login?next=/admin/resenas"));
  }, [router, reload]);

  async function decide(id: number, action: "approve" | "reject") {
    if (!confirm(action === "approve" ? "¿Aprobar reseña?" : "¿Rechazar reseña?")) return;
    setBusyId(id);
    try {
      await dashboard.adminReviewAction(id, action);
      await reload(tab);
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
          / Reseñas
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
          Moderación de reseñas
        </h1>
      </header>

      <nav className="mb-5 flex gap-2 overflow-x-auto">
        {(["pending", "approved", "rejected"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              reload(t);
            }}
            className={`rounded-full border px-4 py-1.5 text-sm ${
              tab === t
                ? "border-pink-500 bg-pink-600/20 text-pink-200"
                : "border-neutral-700 text-neutral-400"
            }`}
          >
            {t === "pending" ? "Pendientes" : t === "approved" ? "Aprobadas" : "Rechazadas"}
          </button>
        ))}
      </nav>

      {err && <p className="mb-3 text-sm text-red-400">{err}</p>}

      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">Sin reseñas en este estado.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-neutral-800 bg-neutral-900 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    <span className="text-amber-400" aria-hidden>
                      {"★".repeat(r.rating)}
                    </span>{" "}
                    <Link
                      href={`/perfil/${r.profile_slug}`}
                      className="hover:text-pink-300"
                    >
                      {r.stage_name}
                    </Link>
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {r.client_username} · {r.client_email} ·{" "}
                    {new Date(r.created_at).toLocaleString("es-CL")}
                  </p>
                  {r.comment && (
                    <p className="mt-2 max-w-prose whitespace-pre-line text-sm text-neutral-200">
                      {r.comment}
                    </p>
                  )}
                </div>
                {r.status === "pending" && (
                  <div className="flex gap-2">
                    <button
                      disabled={busyId === r.id}
                      onClick={() => decide(r.id, "approve")}
                      className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      Aprobar
                    </button>
                    <button
                      disabled={busyId === r.id}
                      onClick={() => decide(r.id, "reject")}
                      className="rounded-full border border-red-500 px-3 py-1.5 text-xs text-red-300 hover:bg-red-600/20 disabled:opacity-50"
                    >
                      Rechazar
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
