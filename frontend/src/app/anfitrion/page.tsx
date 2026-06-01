"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  auth,
  dashboard,
  rooms,
  type HostProfile,
  type RoomListing,
  type RoomPlan,
} from "@/lib/client-api";

const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const PERIOD_LABEL: Record<string, string> = {
  daily: "/ día",
  weekly: "/ semana",
  monthly: "/ mes",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  active: "Publicada",
  expired: "Expirada",
};

interface Region { id: number; name: string; slug: string }
interface City { id: number; name: string; slug: string }

const inputCls =
  "w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm";

export default function HostPanelPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [host, setHost] = useState<HostProfile | null>(null);
  const [plans, setPlans] = useState<RoomPlan[]>([]);
  const [listings, setListings] = useState<RoomListing[]>([]);

  const reload = useCallback(async () => {
    const [hp, ls] = await Promise.all([
      rooms.hostProfile().catch(() => null),
      rooms.myRooms().catch(() => []),
    ]);
    setHost(hp);
    setListings(ls);
  }, []);

  useEffect(() => {
    auth
      .me()
      .then((me) => {
        const u = me as { role?: string };
        if (u.role !== "host") {
          router.replace("/");
          return Promise.reject(new Error("redirect"));
        }
        return rooms.hostProfile().catch(() => null);
      })
      .then(async (hp) => {
        setHost(hp);
        setPlans(await rooms.roomPlans());
        if (hp) setListings(await rooms.myRooms());
        setReady(true);
      })
      .catch((e) => {
        if (e instanceof Error && e.message === "redirect") return;
        router.replace("/login?next=/anfitrion");
      });
  }, [router]);

  if (!ready) return <p className="text-neutral-400">Cargando…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Panel de anfitrión
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          Publica habitaciones para modelos. Solo modelos con perfil activo pueden verlas.
        </p>
      </header>

      {!host ? (
        <HostProfileForm onCreated={(hp) => setHost(hp)} />
      ) : (
        <>
          <HostProfileCard host={host} onUpdated={setHost} />
          <PlanPanel host={host} plans={plans} onChange={reload} />
          <NewRoomForm host={host} onCreated={reload} />
          <section className="space-y-4">
            <h2 className="text-xs uppercase tracking-wide text-neutral-500">
              Mis habitaciones
            </h2>
            {listings.length === 0 ? (
              <p className="text-sm text-neutral-500">
                Aún no tienes habitaciones. Crea una arriba y publícala con tu plan.
              </p>
            ) : (
              listings.map((r) => (
                <RoomCard key={r.id} room={r} host={host} onChange={reload} />
              ))
            )}
          </section>
        </>
      )}
    </div>
  );
}

function HostProfileForm({ onCreated }: { onCreated: (h: HostProfile) => void }) {
  const [form, setForm] = useState({ display_name: "", whatsapp: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      onCreated(await rooms.createHostProfile(form));
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900 p-5">
      <h2 className="font-medium">Completa tu perfil de anfitrión</h2>
      <input required placeholder="Nombre para mostrar" className={inputCls}
        value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
      <input placeholder="WhatsApp (ej: 56912345678)" className={inputCls}
        value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
      <input placeholder="Teléfono (opcional)" className={inputCls}
        value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      {err && <p className="text-sm text-red-400">{err}</p>}
      <button disabled={busy} className="rounded-full bg-pink-600 px-5 py-2 text-sm font-medium hover:bg-pink-500 disabled:opacity-50">
        {busy ? "Guardando…" : "Guardar perfil"}
      </button>
    </form>
  );
}

function HostProfileCard({ host, onUpdated }: { host: HostProfile; onUpdated: (h: HostProfile) => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ display_name: host.display_name, whatsapp: host.whatsapp, phone: host.phone });
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      onUpdated(await rooms.updateHostProfile(form));
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-sm">
      {!editing ? (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-medium">{host.display_name}</p>
            <p className="text-neutral-400">
              WhatsApp: {host.whatsapp || "—"}{host.phone && ` · Tel: ${host.phone}`}
            </p>
          </div>
          <button onClick={() => setEditing(true)} className="rounded-full border border-neutral-700 px-3 py-1.5 text-xs hover:border-pink-500">
            Editar
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input className={inputCls} value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
          <input className={inputCls} placeholder="WhatsApp" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
          <input className={inputCls} placeholder="Teléfono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <div className="flex gap-2">
            <button disabled={busy} onClick={save} className="rounded-full bg-pink-600 px-4 py-1.5 text-xs font-medium hover:bg-pink-500 disabled:opacity-50">Guardar</button>
            <button onClick={() => setEditing(false)} className="rounded-full border border-neutral-700 px-4 py-1.5 text-xs">Cancelar</button>
          </div>
        </div>
      )}
    </section>
  );
}

function PlanPanel({ host, plans, onChange }: { host: HostProfile; plans: RoomPlan[]; onChange: () => void }) {
  const [planId, setPlanId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  async function onReceipt(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !planId) return;
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("plan_id", planId);
      fd.append("image", file);
      await rooms.buyPlan(fd);
      setMsg("Comprobante enviado. Tu plan se activará al aprobarlo el administrador.");
      onChange();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Error");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900 p-5">
      <h2 className="font-medium">Mi plan</h2>
      {host.subscription_active ? (
        <p className="text-sm text-neutral-300">
          <span className="rounded-full bg-emerald-600/20 px-2 py-0.5 text-emerald-300">{host.plan_name}</span>{" "}
          · {host.used_slots}/{host.plan_slots} habitaciones publicadas
          {host.available_slots > 0 && ` · ${host.available_slots} cupo(s) libre(s)`}
          {host.plan_expires_at && ` · vence ${new Date(host.plan_expires_at).toLocaleDateString("es-CL")}`}
          {host.plan_featured && " · incluye destacado ⭐"}
        </p>
      ) : (
        <p className="text-sm text-amber-400">
          No tienes un plan activo. Contrata uno para publicar tus habitaciones.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <select className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm"
          value={planId} onChange={(e) => setPlanId(e.target.value)}>
          <option value="">{host.subscription_active ? "Renovar / cambiar plan…" : "Elegir plan…"}</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {CLP.format(p.price)} · {p.max_listings} hab · {p.duration_days}d{p.includes_featured ? " · ⭐" : ""}
            </option>
          ))}
        </select>
        <input ref={fileInput} type="file" accept="image/*" onChange={onReceipt} className="hidden" id="plan-receipt" />
        <label htmlFor="plan-receipt"
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${planId && !busy ? "cursor-pointer bg-pink-600 hover:bg-pink-500" : "cursor-not-allowed bg-neutral-700 text-neutral-400"}`}>
          {busy ? "Enviando…" : "Subir comprobante"}
        </label>
      </div>
      <p className="text-xs text-neutral-500">
        Elige un plan y sube el comprobante de transferencia. Un plan cubre varias habitaciones (bundle).
      </p>
      {msg && <p className="text-sm text-emerald-400">{msg}</p>}
      {err && <p className="text-sm text-red-400">{err}</p>}
    </section>
  );
}

function NewRoomForm({ host, onCreated }: { host: HostProfile; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [regions, setRegions] = useState<Region[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [form, setForm] = useState({
    title: "", description: "", region: "", city_id: "", sector: "",
    price: "", price_period: "monthly", whatsapp: host.whatsapp, phone: host.phone,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (open && regions.length === 0) dashboard.regions().then((r) => setRegions(r as Region[]));
  }, [open, regions.length]);

  useEffect(() => {
    if (form.region) dashboard.cities(form.region).then((c) => setCities(c as City[]));
    else setCities([]);
  }, [form.region]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await rooms.createRoom({
        title: form.title, description: form.description, city_id: Number(form.city_id),
        sector: form.sector, price: Number(form.price), price_period: form.price_period,
        whatsapp: form.whatsapp, phone: form.phone,
      });
      setForm({ ...form, title: "", description: "", sector: "", price: "" });
      setOpen(false);
      onCreated();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-full bg-pink-600 px-5 py-2 text-sm font-medium hover:bg-pink-500">
        + Nueva habitación
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900 p-5">
      <h2 className="font-medium">Nueva habitación</h2>
      <input required placeholder="Título (ej: Pieza amoblada, sector centro)" className={inputCls}
        value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <textarea placeholder="Descripción (servicios, condiciones…)" className={inputCls} rows={3}
        value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <div className="grid gap-3 sm:grid-cols-2">
        <select required className={inputCls} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value, city_id: "" })}>
          <option value="">Región…</option>
          {regions.map((r) => <option key={r.id} value={r.slug}>{r.name}</option>)}
        </select>
        <select required className={inputCls} value={form.city_id} onChange={(e) => setForm({ ...form, city_id: e.target.value })}>
          <option value="">Comuna…</option>
          {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <input placeholder="Sector (referencia general, sin dirección exacta)" className={inputCls}
        value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} />
      <div className="grid gap-3 sm:grid-cols-2">
        <input required type="number" placeholder="Precio (CLP)" className={inputCls}
          value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        <select className={inputCls} value={form.price_period} onChange={(e) => setForm({ ...form, price_period: e.target.value })}>
          <option value="daily">Diario</option>
          <option value="weekly">Semanal</option>
          <option value="monthly">Mensual</option>
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input placeholder="WhatsApp de contacto" className={inputCls}
          value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
        <input placeholder="Teléfono (opcional)" className={inputCls}
          value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </div>
      <p className="text-xs text-neutral-500">
        Por privacidad nunca se publica la dirección exacta: solo la comuna y el sector.
      </p>
      {err && <p className="text-sm text-red-400">{err}</p>}
      <div className="flex gap-2">
        <button disabled={busy} className="rounded-full bg-pink-600 px-5 py-2 text-sm font-medium hover:bg-pink-500 disabled:opacity-50">
          {busy ? "Creando…" : "Crear borrador"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-neutral-700 px-5 py-2 text-sm">Cancelar</button>
      </div>
    </form>
  );
}

function RoomCard({ room, host, onChange }: { room: RoomListing; host: HostProfile; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const photoInput = useRef<HTMLInputElement>(null);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setErr("");
    try {
      await fn();
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("listing", String(room.id));
    fd.append("upload", file);
    await run(() => rooms.uploadRoomPhoto(fd));
    if (photoInput.current) photoInput.current.value = "";
  }

  const isDraft = room.status === "draft" || room.status === "expired";
  const canPublish = host.subscription_active && host.available_slots > 0;

  return (
    <article className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">
            {room.title}
            {room.is_featured && <span className="ml-2 text-xs text-amber-300">⭐ Destacada</span>}
          </p>
          <p className="text-sm text-neutral-400">
            {room.city ?? "—"}{room.sector && ` · ${room.sector}`} · {CLP.format(room.price)} {PERIOD_LABEL[room.price_period]}
          </p>
          <p className="mt-1 text-xs">
            <span className={`rounded-full px-2 py-0.5 ${
              room.status === "active" && !room.is_paused ? "bg-emerald-600/20 text-emerald-300"
                : room.is_paused ? "bg-amber-600/20 text-amber-300"
                : "bg-neutral-700/40 text-neutral-300"}`}>
              {room.is_paused ? "Pausada" : STATUS_LABEL[room.status]}
            </span>
            {room.expires_at && room.status === "active" && (
              <span className="ml-2 text-neutral-500">vence {new Date(room.expires_at).toLocaleDateString("es-CL")}</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isDraft && (
            <button disabled={busy || !canPublish} title={!canPublish ? "Necesitas un plan con cupos libres" : ""}
              onClick={() => run(() => rooms.publishRoom(room.id))}
              className="rounded-full bg-pink-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-pink-500 disabled:opacity-40">
              Publicar
            </button>
          )}
          {room.status === "active" && (room.is_paused ? (
            <button disabled={busy} onClick={() => run(() => rooms.resumeRoom(room.id))}
              className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50">Reactivar</button>
          ) : (
            <button disabled={busy} onClick={() => run(() => rooms.pauseRoom(room.id))}
              className="rounded-full border border-amber-500 px-3 py-1.5 text-xs text-amber-300 hover:bg-amber-600/20 disabled:opacity-50">Pausar (ocupada)</button>
          ))}
          {room.status === "active" && (
            <button disabled={busy} onClick={() => run(() => rooms.unpublishRoom(room.id))}
              className="rounded-full border border-neutral-700 px-3 py-1.5 text-xs hover:border-pink-500 disabled:opacity-50">Despublicar</button>
          )}
          <button disabled={busy}
            onClick={() => { if (confirm("¿Eliminar esta habitación?")) run(() => rooms.deleteRoom(room.id)); }}
            className="rounded-full border border-red-500 px-3 py-1.5 text-xs text-red-300 hover:bg-red-600/20 disabled:opacity-50">Eliminar</button>
        </div>
      </div>

      {room.photos.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {room.photos.map((ph) => (
            <div key={ph.id} className="relative">
              <Image src={ph.image_url} alt="" width={120} height={90} unoptimized className="h-20 w-28 rounded-lg object-cover" />
              <button onClick={() => run(() => rooms.deleteRoomPhoto(ph.id))}
                className="absolute right-1 top-1 rounded-full bg-black/70 px-1.5 text-xs text-white" aria-label="Eliminar foto">✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3">
        <input ref={photoInput} type="file" accept="image/*" onChange={onPhoto} className="hidden" id={`photo-${room.id}`} />
        <label htmlFor={`photo-${room.id}`} className="cursor-pointer rounded-full border border-neutral-700 px-3 py-1.5 text-xs hover:border-pink-500">
          + Agregar foto
        </label>
      </div>
      {err && <p className="mt-2 text-sm text-red-400">{err}</p>}
    </article>
  );
}
