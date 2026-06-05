"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, dashboard } from "@/lib/client-api";

interface Plan {
  id: number;
  name: string;
  slug: string;
  kind: "model_publication" | "room_listing";
  duration_days: number;
  max_listings: number;
  price: number;
  includes_featured: boolean;
  is_active: boolean;
  order: number;
}

const KIND_LABEL: Record<string, string> = {
  model_publication: "Modelo",
  room_listing: "Habitación",
};

const CLP = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

export default function AdminConfigPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [trialDays, setTrialDays] = useState(1);
  const [maxRooms, setMaxRooms] = useState(10);
  const [payInfo, setPayInfo] = useState("");
  const [savingTrial, setSavingTrial] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const reload = useCallback(async () => {
    const [cfg, ps] = await Promise.all([
      dashboard.adminSiteConfig(),
      dashboard.adminPlans() as Promise<Plan[]>,
    ]);
    setTrialDays(cfg.trial_days);
    setMaxRooms(cfg.max_active_rooms_per_host);
    setPayInfo(cfg.payment_instructions ?? "");
    setPlans(ps);
  }, []);

  useEffect(() => {
    auth
      .me()
      .then(() => reload())
      .then(() => setReady(true))
      .catch(() => router.replace("/login?next=/admin/config"));
  }, [router, reload]);

  async function saveTrial(e: React.FormEvent) {
    e.preventDefault();
    setSavingTrial(true);
    setMsg("");
    try {
      await dashboard.adminUpdateSiteConfig({
        trial_days: trialDays,
        max_active_rooms_per_host: maxRooms,
        payment_instructions: payInfo,
      });
      setMsg("Configuración guardada.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSavingTrial(false);
    }
  }

  async function createPlan(form: FormData) {
    setCreating(true);
    setErr("");
    try {
      await dashboard.adminCreatePlan({
        name: form.get("name"),
        kind: form.get("kind") || "model_publication",
        duration_days: Number(form.get("duration_days")),
        max_listings: Number(form.get("max_listings") || 1),
        price: Number(form.get("price")),
        includes_featured: form.get("includes_featured") === "on",
        is_active: true,
        order: Number(form.get("order") || 0),
      });
      await reload();
      setMsg("Plan creado.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setCreating(false);
    }
  }

  async function patchPlan(id: number, data: Partial<Plan>) {
    setBusyId(id);
    try {
      await dashboard.adminUpdatePlan(id, data as Record<string, unknown>);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  }

  async function deletePlan(p: Plan) {
    if (!confirm(`¿Eliminar el plan "${p.name}"? Si tiene anuncios asociados no podrá borrarse.`))
      return;
    setBusyId(p.id);
    try {
      await dashboard.adminDeletePlan(p.id);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  }

  if (!ready) return <p className="text-neutral-400">Cargando…</p>;

  return (
    <div className="space-y-10">
      <header>
        <p className="text-sm text-neutral-500">
          <Link href="/admin" className="hover:text-pink-400">
            Admin
          </Link>{" "}
          / Configuración
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
          Configuración y planes
        </h1>
      </header>

      {msg && <p className="rounded-lg bg-emerald-600/20 px-4 py-2 text-sm text-emerald-200">{msg}</p>}
      {err && <p className="rounded-lg bg-red-600/20 px-4 py-2 text-sm text-red-200">{err}</p>}

      {/* SiteConfig */}
      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="font-display text-xl font-semibold">Sitio</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Parámetros globales aplicados al catálogo público.
        </p>
        <form onSubmit={saveTrial} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex-1 text-sm">
            <span className="block text-xs uppercase tracking-wide text-neutral-500">
              Días de trial post-KYC
            </span>
            <input
              type="number"
              min={0}
              max={60}
              value={trialDays}
              onChange={(e) => setTrialDays(Number(e.target.value))}
              className="mt-1 w-full max-w-xs rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-base"
            />
            <span className="mt-1 block text-xs text-neutral-500">
              Días que un perfil recién verificado es visible sin pagar.
            </span>
          </label>
          <label className="flex-1 text-sm">
            <span className="block text-xs uppercase tracking-wide text-neutral-500">
              Tope habitaciones activas / anfitrión
            </span>
            <input
              type="number"
              min={1}
              max={100}
              value={maxRooms}
              onChange={(e) => setMaxRooms(Number(e.target.value))}
              className="mt-1 w-full max-w-xs rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-base"
            />
            <span className="mt-1 block text-xs text-neutral-500">
              Límite global de anuncios de habitación activos por anfitrión (anti-spam).
            </span>
          </label>
          <label className="w-full text-sm">
            <span className="block text-xs uppercase tracking-wide text-neutral-500">
              Datos de pago (los ve la modelo al pagar)
            </span>
            <textarea
              value={payInfo}
              onChange={(e) => setPayInfo(e.target.value)}
              rows={5}
              placeholder={"Banco Estado · Cuenta Vista 12345678\nTitular: Nombre Apellido · RUT 12.345.678-9\nCorreo: pagos@portalvip.cl\nEnvía el comprobante después de transferir."}
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-base"
            />
            <span className="mt-1 block text-xs text-neutral-500">
              Banco, tipo de cuenta, número, titular, RUT y correo. Se muestran a la
              modelo al elegir un plan y subir el comprobante.
            </span>
          </label>
          <button
            disabled={savingTrial}
            className="btn-gold rounded-full px-5 py-2 text-sm font-medium disabled:opacity-50"
          >
            {savingTrial ? "Guardando…" : "Guardar"}
          </button>
        </form>
      </section>

      {/* Plans */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Planes</h2>
        </div>

        <ul className="space-y-2">
          {plans.map((p) => (
            <li
              key={p.id}
              className={`rounded-xl border bg-neutral-900 p-4 ${
                p.is_active ? "border-neutral-800" : "border-neutral-800 opacity-60"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {p.name}{" "}
                    <span className="text-xs text-neutral-500">/{p.slug}</span>
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">
                    <span className="mr-1 rounded-full bg-neutral-800 px-2 py-0.5 text-neutral-300">
                      {KIND_LABEL[p.kind] ?? p.kind}
                    </span>
                    {p.duration_days} día{p.duration_days === 1 ? "" : "s"} ·{" "}
                    {CLP.format(p.price)}{" "}
                    {p.kind === "room_listing" && `· ${p.max_listings} hab `}
                    {p.includes_featured && (
                      <span className="ml-1 rounded-full bg-amber-600/20 px-2 py-0.5 text-amber-200">
                        destacado
                      </span>
                    )}
                    {!p.is_active && (
                      <span className="ml-1 rounded-full bg-neutral-800 px-2 py-0.5 text-neutral-400">
                        inactivo
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={busyId === p.id}
                    onClick={() => {
                      const price = window.prompt(
                        `Nuevo precio en CLP para "${p.name}"`,
                        String(p.price),
                      );
                      if (price === null) return;
                      const days = window.prompt(
                        `Duración en días para "${p.name}"`,
                        String(p.duration_days),
                      );
                      if (days === null) return;
                      patchPlan(p.id, {
                        price: Number(price),
                        duration_days: Number(days),
                      });
                    }}
                    className="rounded-full border border-neutral-700 px-3 py-1.5 text-xs hover:border-pink-500 disabled:opacity-50"
                  >
                    Editar
                  </button>
                  <button
                    disabled={busyId === p.id}
                    onClick={() => patchPlan(p.id, { is_active: !p.is_active })}
                    className="rounded-full border border-neutral-700 px-3 py-1.5 text-xs hover:border-emerald-500 disabled:opacity-50"
                  >
                    {p.is_active ? "Desactivar" : "Activar"}
                  </button>
                  <button
                    disabled={busyId === p.id}
                    onClick={() => deletePlan(p)}
                    className="rounded-full border border-red-500 px-3 py-1.5 text-xs text-red-300 hover:bg-red-600/20 disabled:opacity-50"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* Crear plan */}
        <form
          action={createPlan}
          className="mt-4 grid gap-3 rounded-xl border border-dashed border-neutral-800 bg-neutral-950 p-4 sm:grid-cols-[1fr_auto_auto_auto_auto_auto]"
        >
          <input
            name="name"
            required
            placeholder="Nombre (ej. Premium Mensual)"
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm sm:col-span-1"
          />
          <select
            name="kind"
            defaultValue="model_publication"
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
          >
            <option value="model_publication">Modelo</option>
            <option value="room_listing">Habitación</option>
          </select>
          <input
            name="duration_days"
            type="number"
            min={1}
            required
            placeholder="Días"
            className="w-24 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
          />
          <input
            name="max_listings"
            type="number"
            min={1}
            defaultValue={1}
            title="Habitaciones que cubre (solo planes de habitación)"
            className="w-24 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
          />
          <input
            name="price"
            type="number"
            min={0}
            step={1000}
            required
            placeholder="Precio CLP"
            className="w-32 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-xs text-neutral-300">
            <input type="checkbox" name="includes_featured" />
            Destacado
          </label>
          <button
            disabled={creating}
            className="rounded-full bg-pink-600 px-4 py-2 text-sm font-medium hover:bg-pink-500 disabled:opacity-50"
          >
            {creating ? "Creando…" : "Crear plan"}
          </button>
        </form>
      </section>
    </div>
  );
}
