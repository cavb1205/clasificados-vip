"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, rooms } from "@/lib/client-api";

const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

interface RoomPayment {
  id: number;
  host_name: string;
  host_email: string;
  plan_name: string;
  plan_price: number | null;
  plan_slots: number | null;
  amount: number | null;
  status: "pending" | "approved" | "rejected";
  note: string;
  image_url: string | null;
  created_at: string;
}

interface AdminRoom {
  id: number;
  title: string;
  description: string;
  host_name: string;
  host_email: string;
  city_name: string | null;
  sector: string;
  price: number;
  price_period: string;
  status: string;
  is_featured: boolean;
  is_paused: boolean;
  is_suspended: boolean;
  suspension_reason: string;
  expires_at: string | null;
  photo_count: number;
  photos: { id: number; image_url: string }[];
  created_at: string;
}

export default function AdminHabitacionesPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [payments, setPayments] = useState<RoomPayment[]>([]);
  const [listings, setListings] = useState<AdminRoom[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [photosId, setPhotosId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState("");

  const reload = useCallback(async (staff: boolean) => {
    if (staff) setPayments((await rooms.adminRoomPayments("pending")) as RoomPayment[]);
    setListings((await rooms.adminRooms()) as AdminRoom[]);
  }, []);

  useEffect(() => {
    auth
      .me()
      .then((me) => {
        const u = me as { is_staff?: boolean } | null;
        const staff = !!u?.is_staff;
        setIsStaff(staff);
        return reload(staff);
      })
      .then(() => setReady(true))
      .catch(() => router.replace("/login?next=/admin/habitaciones"));
  }, [router, reload]);

  async function decidePayment(id: number, action: "approve" | "reject") {
    let note = "";
    if (action === "reject") {
      const r = window.prompt("Motivo del rechazo (visible para el anfitrión):");
      if (r === null) return;
      note = r;
    } else if (!confirm("¿Aprobar este pago? Publicará la habitación.")) {
      return;
    }
    setBusyId(id);
    try {
      await rooms.adminRoomPaymentAction(id, action, note);
      await reload(isStaff);
      setOpenId(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  }

  async function moderate(r: AdminRoom) {
    const action = r.is_suspended ? "unsuspend" : "suspend";
    let reason = "";
    if (action === "suspend") {
      const v = window.prompt("Motivo de la suspensión:");
      if (v === null) return;
      reason = v;
    }
    setBusyId(r.id);
    try {
      await rooms.adminRoomAction(r.id, action, reason);
      await reload(isStaff);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  }

  if (!ready) return <p className="text-neutral-400">Cargando…</p>;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm text-neutral-500">
          <Link href="/admin" className="hover:text-pink-400">
            Admin
          </Link>{" "}
          / Habitaciones
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
          Habitaciones
        </h1>
      </header>

      {err && <p className="text-sm text-red-400">{err}</p>}

      {isStaff && (
        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-wide text-neutral-500">
            Comprobantes pendientes
          </h2>
          {payments.length === 0 ? (
            <p className="text-sm text-neutral-500">No hay comprobantes por revisar.</p>
          ) : (
            <ul className="space-y-3">
              {payments.map((p) => {
                const mismatch =
                  p.amount !== null &&
                  p.plan_price !== null &&
                  p.amount !== p.plan_price;
                return (
                  <li
                    key={p.id}
                    className="rounded-xl border border-neutral-800 bg-neutral-900 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          {p.host_name}{" "}
                          <span className="text-sm text-neutral-400">· {p.host_email}</span>
                        </p>
                        <p className="mt-1 text-xs text-neutral-500">
                          Plan: {p.plan_name || "—"}
                          {p.plan_slots !== null && ` · ${p.plan_slots} hab`}
                          {p.plan_price !== null && ` · esperado ${CLP.format(p.plan_price)}`}
                          {p.amount !== null && ` · declarado ${CLP.format(p.amount)}`}
                          {mismatch && (
                            <span className="ml-2 rounded-full bg-amber-600/20 px-2 py-0.5 text-amber-300">
                              ⚠ no coincide
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setOpenId(openId === p.id ? null : p.id)}
                          className="rounded-full border border-neutral-700 px-3 py-1.5 text-xs hover:border-pink-500"
                        >
                          {openId === p.id ? "Ocultar" : "Ver comprobante"}
                        </button>
                        <button
                          disabled={busyId === p.id}
                          onClick={() => decidePayment(p.id, "approve")}
                          className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                          Aprobar
                        </button>
                        <button
                          disabled={busyId === p.id}
                          onClick={() => decidePayment(p.id, "reject")}
                          className="rounded-full border border-red-500 px-3 py-1.5 text-xs text-red-300 hover:bg-red-600/20 disabled:opacity-50"
                        >
                          Rechazar
                        </button>
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
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-wide text-neutral-500">Anuncios</h2>
        {listings.length === 0 ? (
          <p className="text-sm text-neutral-500">No hay anuncios.</p>
        ) : (
          <ul className="space-y-2">
            {listings.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-neutral-800 bg-neutral-900 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {r.title}
                      {r.is_suspended && (
                        <span className="ml-2 rounded-full bg-red-600/20 px-2 py-0.5 text-xs text-red-300">
                          Suspendida
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {r.host_name} · {r.city_name ?? "—"} · {CLP.format(r.price)} ·{" "}
                      {r.status}
                      {r.is_paused && " · pausada"}
                      {r.is_featured && " · ⭐"} · {r.photo_count} foto(s)
                    </p>
                    {r.suspension_reason && (
                      <p className="mt-1 text-xs text-red-300">Motivo: {r.suspension_reason}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {r.photo_count > 0 && (
                      <button
                        onClick={() => setPhotosId(photosId === r.id ? null : r.id)}
                        className="rounded-full border border-neutral-700 px-3 py-1.5 text-xs hover:border-pink-500"
                      >
                        {photosId === r.id ? "Ocultar fotos" : `Ver fotos (${r.photo_count})`}
                      </button>
                    )}
                    {isStaff && (
                      <button
                        disabled={busyId === r.id}
                        onClick={() => moderate(r)}
                        className={`rounded-full px-3 py-1.5 text-xs disabled:opacity-50 ${
                          r.is_suspended
                            ? "bg-emerald-600 font-medium text-white hover:bg-emerald-500"
                            : "border border-red-500 text-red-300 hover:bg-red-600/20"
                        }`}
                      >
                        {r.is_suspended ? "Reactivar" : "Suspender"}
                      </button>
                    )}
                  </div>
                </div>
                {photosId === r.id && (
                  <div className="mt-3">
                    {r.description && (
                      <p className="mb-2 whitespace-pre-line text-xs text-neutral-300">{r.description}</p>
                    )}
                    <div className="flex gap-2 overflow-x-auto">
                      {r.photos.map((ph) => (
                        <Image
                          key={ph.id}
                          src={ph.image_url}
                          alt={`Foto de ${r.title}`}
                          width={240}
                          height={160}
                          unoptimized
                          className="h-36 w-52 flex-shrink-0 rounded-lg object-cover"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
