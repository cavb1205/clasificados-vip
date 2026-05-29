"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, dashboard } from "@/lib/client-api";

interface Payment {
  id: number;
  publication_id: number;
  publication_title: string;
  plan_name: string;
  plan_price: number | null;
  stage_name: string;
  profile_slug: string;
  amount: number | null;
  status: "pending" | "approved" | "rejected";
  note: string;
  image_url: string | null;
  created_at: string;
  reviewed_at: string | null;
}

type TabStatus = "pending" | "approved" | "rejected";

const CLP = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

export default function AdminPagosPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabStatus>("pending");
  const [items, setItems] = useState<Payment[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [ready, setReady] = useState(false);

  const reload = useCallback(async (which: TabStatus) => {
    setItems((await dashboard.adminPayments(which)) as Payment[]);
  }, []);

  useEffect(() => {
    auth
      .me()
      .then(() => reload("pending"))
      .then(() => setReady(true))
      .catch(() => router.replace("/login?next=/admin/pagos"));
  }, [router, reload]);

  async function decide(id: number, action: "approve" | "reject") {
    if (action === "reject") {
      const note = window.prompt("Motivo del rechazo (visible para la modelo):") ?? "";
      if (note === null) return;
      setBusyId(id);
      try {
        await dashboard.adminPaymentAction(id, "reject", note);
        await reload(tab);
        setOpenId(null);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Error");
      } finally {
        setBusyId(null);
      }
      return;
    }
    if (!confirm("¿Aprobar este pago? Activará la publicación.")) return;
    setBusyId(id);
    try {
      await dashboard.adminPaymentAction(id, "approve");
      await reload(tab);
      setOpenId(null);
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
          / Pagos
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
          Comprobantes de pago
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
            {t === "pending" ? "Pendientes" : t === "approved" ? "Aprobados" : "Rechazados"}
          </button>
        ))}
      </nav>

      {err && <p className="mb-3 text-sm text-red-400">{err}</p>}

      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">No hay comprobantes en este estado.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((p) => {
            const expected = p.plan_price ?? null;
            const declared = p.amount ?? null;
            const mismatch =
              declared !== null && expected !== null && declared !== expected;
            return (
              <li
                key={p.id}
                className="rounded-xl border border-neutral-800 bg-neutral-900 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      <Link
                        href={`/perfil/${p.profile_slug}`}
                        className="hover:text-pink-300"
                      >
                        {p.stage_name}
                      </Link>{" "}
                      <span className="text-neutral-400">·</span>{" "}
                      <span className="text-sm text-neutral-300">
                        {p.publication_title}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      Plan: {p.plan_name || "—"}
                      {expected !== null && ` · esperado ${CLP.format(expected)}`}
                      {declared !== null && ` · declarado ${CLP.format(declared)}`}
                      {mismatch && (
                        <span className="ml-2 rounded-full bg-amber-600/20 px-2 py-0.5 text-amber-300">
                          ⚠ no coincide
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-neutral-600">
                      Recibido {new Date(p.created_at).toLocaleString("es-CL")}
                    </p>
                    {p.note && (
                      <p className="mt-2 max-w-prose text-xs text-neutral-400">
                        Nota: {p.note}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setOpenId(openId === p.id ? null : p.id)}
                      className="rounded-full border border-neutral-700 px-3 py-1.5 text-xs hover:border-pink-500"
                    >
                      {openId === p.id ? "Ocultar" : "Ver comprobante"}
                    </button>
                    {p.status === "pending" && (
                      <>
                        <button
                          disabled={busyId === p.id}
                          onClick={() => decide(p.id, "approve")}
                          className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                          Aprobar
                        </button>
                        <button
                          disabled={busyId === p.id}
                          onClick={() => decide(p.id, "reject")}
                          className="rounded-full border border-red-500 px-3 py-1.5 text-xs text-red-300 hover:bg-red-600/20 disabled:opacity-50"
                        >
                          Rechazar
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {openId === p.id && p.image_url && (
                  <div className="mt-4 overflow-hidden rounded-lg border border-neutral-800 bg-black">
                    <Image
                      src={p.image_url}
                      alt={`Comprobante ${p.id}`}
                      width={1200}
                      height={1600}
                      unoptimized
                      className="max-h-[70vh] w-full object-contain"
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
