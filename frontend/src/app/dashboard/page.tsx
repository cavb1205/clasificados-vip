"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, dashboard } from "@/lib/client-api";
import { toast } from "@/components/Toaster";
import { PlanPicker } from "@/components/PlanPicker";
import type { Plan, Region, City, Service, ServiceCategory } from "@/lib/types";
import { CATEGORY_LABEL } from "@/lib/types";

interface LatestVerification {
  id: number;
  status: "pending" | "verified" | "rejected";
  has_id_document: boolean;
  has_selfie: boolean;
  has_consent_video: boolean;
  created_at: string;
  reviewed_at: string | null;
  rejection_reason: string;
}

interface Profile {
  id: number;
  stage_name: string;
  gender: "female" | "trans" | "male";
  description: string;
  age: number;
  avatar: string | null;
  city: City | null;
  verification_status: string;
  verified_at: string | null;
  trial_ends_at: string | null;
  pending_verification: boolean;
  latest_verification: LatestVerification | null;
  available_until: string | null;
  whatsapp: string;
  telegram: string;
  base_rate: number | null;
  services: Service[];
}
interface Media {
  id: number;
  media_type: string;
  file_url: string;
  order: number;
}
interface Publication {
  id: number;
  title: string;
  status: string;
  is_featured?: boolean;
  expires_at: string | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedTags, setSelectedTags] = useState<Set<number>>(new Set());
  const [plans, setPlans] = useState<Plan[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [msg, setMsg] = useState("");

  const loadAll = useCallback(async () => {
    const [profs, regs, pls, meds, pubs, svcs] = await Promise.all([
      dashboard.getProfile() as Promise<Profile[]>,
      dashboard.regions() as Promise<Region[]>,
      dashboard.plans() as Promise<Plan[]>,
      dashboard.listMedia() as Promise<Media[]>,
      dashboard.listPublications() as Promise<Publication[]>,
      dashboard.services() as Promise<Service[]>,
    ]);
    const p = profs[0] ?? null;
    setProfile(p);
    setRegions(regs);
    setPlans(pls);
    setMedia(meds);
    setPublications(pubs);
    setServices(svcs);
    setSelectedTags(new Set(p?.services?.map((s) => s.id) ?? []));
    // Pre-cargar las comunas de la región actual del perfil para que el select
    // muestre la opción correcta seleccionada al entrar al dashboard.
    if (p?.city?.region?.slug) {
      setCities((await dashboard.cities(p.city.region.slug)) as City[]);
    }
  }, []);

  useEffect(() => {
    auth
      .me()
      .then(() => loadAll())
      .then(() => setReady(true))
      .catch(() => router.replace("/login"));
  }, [router, loadAll]);

  if (!ready) return <p className="text-neutral-400">Cargando…</p>;

  async function onRegion(slug: string) {
    setCities(slug ? ((await dashboard.cities(slug)) as City[]) : []);
  }

  async function saveProfile(form: FormData) {
    const cityRaw = form.get("city_id");
    const data: Record<string, unknown> = {
      stage_name: form.get("stage_name"),
      gender: form.get("gender") ?? "female",
      age: Number(form.get("age")),
      description: form.get("description"),
      whatsapp: form.get("whatsapp") ?? "",
      telegram: form.get("telegram") ?? "",
      service_ids: Array.from(selectedTags),
    };
    const rateRaw = form.get("base_rate");
    data.base_rate = rateRaw ? Number(rateRaw) : null;
    // Solo enviamos city_id si el usuario eligió una comuna real. Si el select
    // está en el placeholder, dejamos el valor existente intacto (partial update).
    if (cityRaw) data.city_id = Number(cityRaw);
    try {
      if (profile) await dashboard.updateProfile(profile.id, data);
      else await dashboard.createProfile(data);
      toast("Perfil guardado");
      await loadAll();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error al guardar", "error");
    }
  }

  // Plan destacado activo → más cupos de fotos/videos.
  const isFeatured = publications.some((p) => p.status === "active" && p.is_featured);

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mi panel</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/habitaciones"
            className="rounded-full border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:border-pink-500 hover:text-pink-300"
            title="Habitaciones disponibles para modelos"
          >
            🏠 <span className="hidden md:inline">Habitaciones</span>
          </Link>
          <NotificationBell />
          <button
            onClick={() => auth.logout().then(() => router.push("/"))}
            className="rounded-full border border-neutral-700 px-3 py-1.5 text-sm text-neutral-400 hover:text-pink-400"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <span className="md:hidden" aria-hidden>↪</span>
            <span className="hidden md:inline">Cerrar sesión</span>
          </button>
        </div>
      </div>
      {msg && <p className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-pink-400">{msg}</p>}
      {(!profile || profile.verification_status !== "verified" || publications.length === 0) && (
        <Link
          href="/dashboard/inicio"
          className="flex items-center justify-between gap-3 rounded-xl border border-pink-500/40 bg-pink-600/10 px-4 py-3 text-sm text-pink-200 hover:border-pink-500"
        >
          <span>✨ <strong>¿Recién empiezas?</strong> Te guiamos paso a paso para dejar tu perfil listo y visible.</span>
          <span className="shrink-0 font-medium">Abrir guía →</span>
        </Link>
      )}
      <VisibilityBanner profile={profile} publications={publications} />
      {profile && profile.verification_status === "verified" && (
        <AvailabilityPanel
          availableUntil={profile.available_until}
          onChange={loadAll}
        />
      )}
      {profile && profile.verification_status === "verified" && (
        <StoriesPanel publications={publications} />
      )}

      {/* Estadísticas */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Estadísticas</h2>
        <StatsPanel hasProfile={!!profile} />
      </section>

      {/* Perfil */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Perfil{" "}
          {profile && (
            <span className="ml-2 rounded-full bg-neutral-800 px-2 py-0.5 text-xs">
              {profile.verification_status}
            </span>
          )}
        </h2>
        <form action={saveProfile} className="grid gap-3 sm:grid-cols-2">
          <input
            name="stage_name"
            defaultValue={profile?.stage_name}
            placeholder="Nombre artístico"
            required
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-base"
          />
          <select
            name="gender"
            defaultValue={profile?.gender ?? "female"}
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-base"
          >
            <option value="female">Mujer</option>
            <option value="trans">Trans</option>
            <option value="male">Hombre</option>
          </select>
          <input
            name="age"
            type="number"
            min={18}
            defaultValue={profile?.age}
            placeholder="Edad"
            required
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-base"
          />
          <select
            defaultValue={profile?.city?.region?.slug ?? ""}
            onChange={(e) => onRegion(e.target.value)}
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-base"
          >
            <option value="">Región…</option>
            {regions.map((r) => (
              <option key={r.id} value={r.slug}>
                {r.name}
              </option>
            ))}
          </select>
          <select
            name="city_id"
            defaultValue={profile?.city?.id}
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-base"
          >
            <option value="">Comuna…</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            name="whatsapp"
            defaultValue={profile?.whatsapp}
            placeholder="WhatsApp (ej: 56912345678)"
            inputMode="tel"
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-base"
          />
          <input
            name="telegram"
            defaultValue={profile?.telegram}
            placeholder="Telegram (usuario, sin @)"
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-base"
          />
          <input
            name="base_rate"
            type="number"
            min={0}
            step={1000}
            defaultValue={profile?.base_rate ?? ""}
            placeholder="Tarifa base (CLP, opcional)"
            inputMode="numeric"
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-base"
          />
          <textarea
            name="description"
            defaultValue={profile?.description}
            placeholder="Descripción"
            rows={4}
            className="sm:col-span-2 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-base"
          />
          <TagSelector
            services={services}
            selected={selectedTags}
            onToggle={(id) => {
              const next = new Set(selectedTags);
              next.has(id) ? next.delete(id) : next.add(id);
              setSelectedTags(next);
            }}
          />
          <button className="w-full rounded-full bg-pink-600 px-5 py-2.5 font-medium hover:bg-pink-500 sm:w-fit">
            Guardar perfil
          </button>
        </form>
      </section>

      {/* Verificación KYC */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Verificación de identidad</h2>
        <KycForm
          latest={profile?.latest_verification ?? null}
          onDone={() => {
            setMsg("Documentos enviados a revisión.");
            loadAll();
          }}
        />
      </section>

      {/* Foto de perfil (avatar) */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Foto de perfil</h2>
        <AvatarUploader avatar={profile?.avatar ?? null} onChange={loadAll} disabled={!profile} />
      </section>

      {/* Multimedia (muro de fotos) */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Muro de fotos (máx. {isFeatured ? 10 : 6} fotos, {isFeatured ? 2 : 1} video{isFeatured ? "s" : ""})
          {isFeatured && <span className="ml-2 text-xs text-[#e9c15c]">⭐ plan destacado</span>}
        </h2>
        <MediaManager media={media} onChange={loadAll} disabled={!profile} featured={isFeatured} />
      </section>

      {/* Publicaciones */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Mis anuncios</h2>
        <PublicationManager
          plans={plans}
          publications={publications}
          onChange={loadAll}
          disabled={!profile}
        />
      </section>

      {/* Reseñas recibidas */}
      {profile && profile.verification_status === "verified" && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Reseñas sobre mí</h2>
          <ReceivedReviewsPanel />
        </section>
      )}

      {/* Historial de pagos */}
      {profile && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Historial de pagos</h2>
          <BillingPanel />
        </section>
      )}
    </div>
  );
}

function BillingPanel() {
  const [items, setItems] = useState<Awaited<ReturnType<typeof dashboard.myReceipts>>>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (!open && !loaded) {
      setLoading(true);
      try {
        setItems(await dashboard.myReceipts());
        setLoaded(true);
      } catch {
        // silencioso
      } finally {
        setLoading(false);
      }
    }
    setOpen((o) => !o);
  }

  const CLP = (n: number | null) =>
    n == null ? "—" : new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
  const STATUS: Record<string, string> = { pending: "Pendiente", approved: "Aprobado", rejected: "Rechazado" };

  return (
    <div>
      <button
        onClick={toggle}
        className="rounded-full border border-neutral-700 px-4 py-1.5 text-sm text-neutral-300 hover:border-pink-500"
      >
        {loading ? "Cargando…" : open ? "Ocultar historial" : "Ver historial de pagos"}
      </button>

      {open && loaded && (
        items.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">Aún no tienes pagos registrados.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {items.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm">
          <div>
            <p className="font-medium">{CLP(r.amount)} · {r.publication_title}</p>
            <p className="text-xs text-neutral-500">
              enviado {new Date(r.created_at).toLocaleDateString("es-CL")}
              {r.note && ` · ${r.note}`}
            </p>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-xs ${
            r.status === "approved" ? "bg-emerald-600/20 text-emerald-200"
              : r.status === "rejected" ? "bg-red-600/20 text-red-200"
              : "bg-amber-600/20 text-amber-200"
          }`}>
            {STATUS[r.status] ?? r.status}
          </span>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}

function ReceivedReviewsPanel() {
  const [items, setItems] = useState<Awaited<ReturnType<typeof dashboard.myProfileReviews>>>([]);
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    dashboard.myProfileReviews().then(setItems).catch(() => {}).finally(() => setLoaded(true));
  }, []);
  useEffect(load, [load]);

  async function reply(id: number, current: string) {
    const text = window.prompt("Tu respuesta pública a esta reseña:", current);
    if (text === null) return;
    setBusyId(id);
    try {
      await dashboard.replyReview(id, text.trim());
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  }
  async function report(id: number) {
    const reason = window.prompt("¿Por qué reportas esta reseña? (la revisa el equipo)");
    if (reason === null) return;
    setBusyId(id);
    try {
      await dashboard.reportReview(id, reason.trim());
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  }

  if (!loaded) return <p className="text-sm text-neutral-500">Cargando…</p>;
  if (items.length === 0) return <p className="text-sm text-neutral-500">Aún no tienes reseñas aprobadas.</p>;

  return (
    <>
      {err && <p className="mb-2 text-sm text-red-400">{err}</p>}
      <ul className="space-y-2">
        {items.map((r) => (
          <li key={r.id} className="rounded-xl border border-neutral-800 bg-neutral-900 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">{"★".repeat(r.rating)}<span className="text-neutral-600">{"★".repeat(5 - r.rating)}</span> <span className="text-xs text-neutral-500">· {r.client_username}</span></p>
              {r.is_flagged && <span className="rounded-full bg-amber-600/20 px-2 py-0.5 text-xs text-amber-200">reportada</span>}
            </div>
            {r.comment && <p className="mt-1 text-neutral-300">{r.comment}</p>}
            {r.reply && <p className="mt-2 rounded-lg bg-neutral-800/60 px-3 py-2 text-xs text-neutral-300"><strong>Tu respuesta:</strong> {r.reply}</p>}
            <div className="mt-2 flex gap-2">
              <button disabled={busyId === r.id} onClick={() => reply(r.id, r.reply)}
                className="rounded-full border border-neutral-700 px-3 py-1 text-xs hover:border-pink-500 disabled:opacity-50">
                {r.reply ? "Editar respuesta" : "Responder"}
              </button>
              {!r.is_flagged && (
                <button disabled={busyId === r.id} onClick={() => report(r.id)}
                  className="rounded-full border border-amber-700 px-3 py-1 text-xs text-amber-300 hover:bg-amber-950/30 disabled:opacity-50">
                  Reportar
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

const MAX_IMG_MB = 10;
const MAX_VIDEO_MB = 50;

interface Challenge {
  code: string;
  statement: string;
  expires_at: string;
}

function KycForm({
  latest,
  onDone,
}: {
  latest: LatestVerification | null;
  onDone: () => void;
}) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loadingChallenge, setLoadingChallenge] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Si hay una verificación pendiente, mostramos resumen y NO el form
  // automáticamente: el usuario decide si quiere reemplazarla.
  const showingSummary = latest?.status === "pending";
  const [resubmitting, setResubmitting] = useState(false);
  const formVisible = !showingSummary || resubmitting;

  // Pedir el challenge solo cuando el form va a verse (evita gastar códigos).
  const fetchChallenge = useCallback(async () => {
    setLoadingChallenge(true);
    setErr("");
    try {
      setChallenge(await dashboard.issueKycChallenge());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo obtener el código de validación");
    } finally {
      setLoadingChallenge(false);
    }
  }, []);

  useEffect(() => {
    if (formVisible) fetchChallenge();
  }, [formVisible, fetchChallenge]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    if (!challenge) {
      setErr("Espera a que se genere el código de validación.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    fd.append("challenge_code", challenge.code);

    const id = fd.get("id_document");
    const selfie = fd.get("selfie");
    const video = fd.get("consent_video");

    if (
      !(id instanceof File) || id.size === 0 ||
      !(selfie instanceof File) || selfie.size === 0 ||
      !(video instanceof File) || video.size === 0
    ) {
      setErr("Selecciona los tres archivos: cédula, selfie y video.");
      return;
    }
    for (const [label, file, kind, maxMB] of [
      ["Cédula", id, "image/", MAX_IMG_MB],
      ["Selfie", selfie, "image/", MAX_IMG_MB],
      ["Video", video, "video/", MAX_VIDEO_MB],
    ] as const) {
      if (!file.type.startsWith(kind)) {
        setErr(`${label} debe ser ${kind === "image/" ? "una imagen" : "un video"}.`);
        return;
      }
      if (file.size > maxMB * 1_048_576) {
        setErr(`${label} muy grande (máx ${maxMB} MB). Tiene ${(file.size / 1_048_576).toFixed(1)} MB.`);
        return;
      }
    }

    setBusy(true);
    try {
      await dashboard.submitVerification(fd);
      formRef.current?.reset();
      onDone();
    } catch (caught) {
      setErr(caught instanceof Error ? caught.message : "Error al enviar");
      // Si el código se invalida (ya usado, expirado), pide uno nuevo automáticamente.
      if (caught instanceof Error && /desaf[íi]o/i.test(caught.message)) {
        fetchChallenge();
      }
    } finally {
      setBusy(false);
    }
  }

  // Resumen de envío pendiente (sin previsualizar archivos sensibles).
  const summary = latest && (
    <div className="rounded-xl border border-sky-700/50 bg-sky-950/30 p-4 text-sm">
      <p className="font-semibold text-sky-200">
        {latest.status === "pending" && "📤 Documentos enviados · esperando revisión"}
        {latest.status === "rejected" && "❌ Verificación rechazada"}
        {latest.status === "verified" && "✅ Identidad verificada"}
      </p>
      <p className="mt-1 text-xs text-neutral-400">
        Enviado el {new Date(latest.created_at).toLocaleString("es-CL")}
        {latest.reviewed_at &&
          ` · revisado el ${new Date(latest.reviewed_at).toLocaleString("es-CL")}`}
      </p>
      <ul className="mt-3 space-y-1 text-xs">
        <li>{latest.has_id_document ? "✓" : "✗"} Cédula</li>
        <li>{latest.has_selfie ? "✓" : "✗"} Selfie</li>
        <li>{latest.has_consent_video ? "✓" : "✗"} Video de consentimiento</li>
      </ul>
      {latest.status === "rejected" && latest.rejection_reason && (
        <p className="mt-3 rounded-lg bg-red-950/40 px-3 py-2 text-xs text-red-300">
          Motivo: {latest.rejection_reason}
        </p>
      )}
    </div>
  );

  // Cuando hay una verificación pendiente, mostramos el resumen sin el form.
  if (showingSummary && !resubmitting) {
    return (
      <div className="space-y-3">
        {summary}
        <button
          type="button"
          onClick={() => setResubmitting(true)}
          className="text-sm text-neutral-400 underline hover:text-pink-400"
        >
          Enviar de nuevo (reemplaza el envío anterior)
        </button>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4 text-sm">
      {/* Si estamos re-enviando, recordatorio arriba del form */}
      {resubmitting && summary}
      {/* Frase guionada con el código */}
      <div className="rounded-xl border border-sky-700/50 bg-sky-950/30 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-300">
          Texto a leer en el video
        </p>
        {loadingChallenge ? (
          <p className="text-neutral-400">Generando código…</p>
        ) : challenge ? (
          <>
            <p className="text-neutral-200">
              {challenge.statement.split(challenge.code).map((part, i, arr) => (
                <span key={i}>
                  {part}
                  {i < arr.length - 1 && (
                    <strong className="rounded bg-sky-900 px-1.5 py-0.5 font-mono text-sky-100">
                      {challenge.code}
                    </strong>
                  )}
                </span>
              ))}
            </p>
            <p className="mt-2 text-xs text-neutral-500">
              El código es válido por 1 hora.{" "}
              <button
                type="button"
                onClick={fetchChallenge}
                className="underline hover:text-pink-400"
              >
                Generar otro
              </button>
            </p>
          </>
        ) : (
          <p className="text-red-400">No se pudo obtener el código.</p>
        )}
      </div>

      <label className="block">
        <span className="mb-1 block text-neutral-400">1. Cédula (frente)</span>
        <input
          name="id_document"
          type="file"
          accept="image/*"
          required
          disabled={busy}
          className="block w-full text-base"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-neutral-400">2. Selfie sosteniendo la cédula</span>
        <input
          name="selfie"
          type="file"
          accept="image/*"
          required
          disabled={busy}
          className="block w-full text-base"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-neutral-400">
          3. Video corto (15-30 seg) leyendo el texto de arriba con tu cédula visible
        </span>
        <input
          name="consent_video"
          type="file"
          accept="video/*"
          capture="user"
          required
          disabled={busy}
          className="block w-full text-base"
        />
      </label>

      <p className="text-xs text-neutral-500">
        Cédula y selfie: JPG/PNG · máx {MAX_IMG_MB} MB. Video: MP4/MOV/WebM · máx {MAX_VIDEO_MB} MB.
      </p>

      {err && <p className="rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-300">{err}</p>}

      <button
        type="submit"
        disabled={busy || !challenge}
        className="w-full rounded-full bg-pink-600 px-5 py-2.5 font-medium hover:bg-pink-500 disabled:opacity-50 sm:w-fit"
      >
        {busy ? "Enviando…" : "Enviar verificación"}
      </button>
    </form>
  );
}

const PHOTO_LIMIT = 6;
const VIDEO_LIMIT = 1;

interface PendingFile {
  file: File;
  preview: string; // object URL
}

function AvatarUploader({
  avatar,
  onChange,
  disabled,
}: {
  avatar: string | null;
  onChange: () => void;
  disabled: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("upload", file);
      await dashboard.uploadAvatar(fd);
      onChange();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Error al subir");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    if (!confirm("¿Quitar tu foto de perfil?")) return;
    setBusy(true);
    try {
      await dashboard.deleteAvatar();
      onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border border-neutral-700 bg-neutral-900">
        {avatar ? (
          <Image src={avatar} alt="Foto de perfil" width={96} height={96} unoptimized className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-center text-xs text-neutral-600">Sin foto</div>
        )}
      </div>
      <div>
        <input ref={inputRef} type="file" accept="image/*" onChange={onSelect} className="hidden" id="avatar-input" disabled={disabled} />
        <label
          htmlFor="avatar-input"
          className={`inline-block rounded-full px-4 py-2 text-sm font-medium ${
            disabled || busy ? "cursor-not-allowed bg-neutral-700 text-neutral-400" : "cursor-pointer bg-pink-600 hover:bg-pink-500"
          }`}
        >
          {busy ? "Subiendo…" : avatar ? "Cambiar foto" : "Subir foto"}
        </label>
        {avatar && (
          <button onClick={remove} disabled={busy} className="ml-2 text-xs text-neutral-400 hover:text-red-400 disabled:opacity-50">
            Quitar
          </button>
        )}
        <p className="mt-2 max-w-xs text-xs text-neutral-500">
          Es la foto que te representa: aparece en los <strong className="text-neutral-300">listados</strong> y como
          portada de tu perfil. Elige tu mejor foto. Separada del muro; se le quita la ubicación (EXIF) al subirla.
        </p>
        {err && <p className="mt-1 text-xs text-red-400">{err}</p>}
      </div>
    </div>
  );
}

function MediaManager({
  media,
  onChange,
  disabled,
  featured,
}: {
  media: Media[];
  onChange: () => void;
  disabled: boolean;
  featured?: boolean;
}) {
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [type, setType] = useState<"photo" | "video">("photo");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const photos = media.filter((m) => m.media_type === "photo");
  const videos = media.filter((m) => m.media_type === "video");
  const photoLimit = featured ? 10 : PHOTO_LIMIT;
  const videoLimit = featured ? 2 : VIDEO_LIMIT;
  const limit = type === "photo" ? photoLimit : videoLimit;
  const usedNow = type === "photo" ? photos.length : videos.length;
  const remaining = Math.max(0, limit - usedNow);

  // Liberar URLs de los previews al desmontar o reemplazar selección.
  useEffect(() => {
    return () => pending.forEach((p) => URL.revokeObjectURL(p.preview));
  }, [pending]);

  function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    if (files.length > remaining) {
      setErr(`Solo puedes subir ${remaining} más (límite ${limit}).`);
    } else {
      setErr("");
    }
    const accepted = files.slice(0, remaining);
    // Revoca previews anteriores antes de reemplazar.
    pending.forEach((p) => URL.revokeObjectURL(p.preview));
    setPending(accepted.map((file) => ({ file, preview: URL.createObjectURL(file) })));
  }

  function removePending(idx: number) {
    setPending((curr) => {
      URL.revokeObjectURL(curr[idx].preview);
      return curr.filter((_, i) => i !== idx);
    });
  }

  async function upload() {
    setErr("");
    setProgress({ done: 0, total: pending.length });
    try {
      // Secuencial: cada subida ejecuta el pipeline del backend y valida el límite.
      for (let i = 0; i < pending.length; i++) {
        const fd = new FormData();
        fd.append("media_type", type);
        fd.append("upload", pending[i].file);
        await dashboard.uploadMedia(fd);
        setProgress({ done: i + 1, total: pending.length });
      }
      pending.forEach((p) => URL.revokeObjectURL(p.preview));
      setPending([]);
      if (inputRef.current) inputRef.current.value = "";
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al subir");
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="space-y-4">
      {(photos.length > photoLimit || videos.length > videoLimit) && (
        <div className="rounded-lg border border-amber-700/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
          En tu plan solo se muestran las primeras <strong>{photoLimit} fotos</strong> y{" "}
          <strong>{videoLimit} video</strong> en tu perfil público. Las demás quedan
          guardadas y reaparecen si vuelves al plan <strong>Destacado</strong> ⭐.
        </div>
      )}
      {/* Existentes */}
      {photos.length > 0 && (
        <PhotoGrid photos={photos} onChange={onChange} />
      )}
      {videos.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {videos.map((m) => (
            <div
              key={m.id}
              className="group relative overflow-hidden rounded-lg border border-neutral-800"
            >
              <div className="flex aspect-square items-center justify-center bg-neutral-800 text-xs text-neutral-400">
                Video
              </div>
              <button
                onClick={() => dashboard.deleteMedia(m.id).then(onChange)}
                className="absolute right-1 top-1 rounded-full bg-black/70 px-2 py-0.5 text-xs text-red-300 opacity-0 transition group-hover:opacity-100"
                title="Eliminar"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Selector */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value as "photo" | "video");
            pending.forEach((p) => URL.revokeObjectURL(p.preview));
            setPending([]);
            if (inputRef.current) inputRef.current.value = "";
          }}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1"
        >
          <option value="photo">Fotos</option>
          <option value="video">Video</option>
        </select>
        <input
          ref={inputRef}
          type="file"
          accept={type === "photo" ? "image/*" : "video/*"}
          multiple={type === "photo"}
          disabled={disabled || remaining === 0 || !!progress}
          onChange={onSelect}
        />
        <span className="text-xs text-neutral-500">
          {usedNow}/{limit} usadas
        </span>
      </div>

      {/* Previews */}
      {pending.length > 0 && (
        <div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {pending.map((p, i) => (
              <div
                key={p.preview}
                className="group relative overflow-hidden rounded-lg border border-pink-700/60"
              >
                {/* preview local: <img> está bien aquí (no remoto) */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.preview}
                  alt={p.file.name}
                  className="aspect-square w-full object-cover"
                />
                <button
                  onClick={() => removePending(i)}
                  className="absolute right-1 top-1 rounded-full bg-black/70 px-2 py-0.5 text-xs text-red-300"
                  title="Quitar"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={upload}
              disabled={!!progress}
              className="rounded-full bg-pink-600 px-4 py-1.5 font-medium hover:bg-pink-500 disabled:opacity-50"
            >
              Subir {pending.length} {pending.length === 1 ? "archivo" : "archivos"}
            </button>
            {progress && (
              <span className="text-xs text-neutral-400">
                Subiendo {progress.done}/{progress.total}…
              </span>
            )}
          </div>
        </div>
      )}

      {err && <p className="text-sm text-red-400">{err}</p>}
      {disabled && <p className="text-xs text-neutral-500">Crea tu perfil primero.</p>}
    </div>
  );
}

const PUB_STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Borrador", cls: "bg-neutral-700 text-neutral-300" },
  pending_payment: { label: "Pendiente de pago", cls: "bg-amber-600/20 text-amber-200" },
  active: { label: "Activa", cls: "bg-emerald-600/20 text-emerald-200" },
  expired: { label: "Expirada", cls: "bg-red-600/20 text-red-200" },
};

/** Días enteros que faltan hasta `expires` (negativo si ya pasó). */
function daysLeft(expires: string | null): number | null {
  if (!expires) return null;
  return Math.ceil((new Date(expires).getTime() - Date.now()) / 86_400_000);
}

/** Línea "Quedan N días · vence el DD-MM-YYYY" con color según urgencia. */
function ExpiryLine({ expires }: { expires: string | null }) {
  const d = daysLeft(expires);
  if (d === null || !expires) return null;
  const date = new Date(expires).toLocaleDateString("es-CL");
  if (d < 0) return <p className="mt-1 text-xs text-red-300">Venció el {date}</p>;
  const tone = d <= 3 ? "text-red-300" : d <= 7 ? "text-amber-300" : "text-emerald-300";
  const txt = d === 0 ? `Vence hoy (${date})` : `Quedan ${d} día${d === 1 ? "" : "s"} · vence el ${date}`;
  return <p className={`mt-1 text-xs font-medium ${tone}`}>{txt}</p>;
}

function PublicationManager({
  plans,
  publications,
  onChange,
  disabled,
}: {
  plans: Plan[];
  publications: Publication[];
  onChange: () => void;
  disabled: boolean;
}) {
  const [payInfo, setPayInfo] = useState("");
  const [renewId, setRenewId] = useState<number | null>(null);
  useEffect(() => {
    dashboard.paymentInfo().then((d) => setPayInfo(d.payment_instructions)).catch(() => {});
  }, []);

  async function create(planId: number) {
    try {
      await dashboard.createPublication({ plan_id: planId });
      toast("Anuncio creado · ahora sube tu comprobante de pago");
      onChange();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error al crear el anuncio", "error");
    }
  }
  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {publications.map((p) => (
          <li key={p.id} className="rounded-xl border border-neutral-800 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">Tu anuncio</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${PUB_STATUS[p.status]?.cls ?? "bg-neutral-800"}`}>
                {PUB_STATUS[p.status]?.label ?? p.status}
              </span>
            </div>
            {p.status === "active" && (
              <>
                <ExpiryLine expires={p.expires_at} />
                {renewId === p.id ? (
                  <div className="mt-2">
                    <p className="text-xs text-emerald-300">
                      Renueva por adelantado: transfiere y sube el comprobante. Al
                      aprobarlo, los días se <strong>suman</strong> a tu vencimiento (no pierdes nada).
                    </p>
                    <PaymentBox info={payInfo} />
                    <ReceiptForm
                      pubId={p.id}
                      onUploaded={() => {
                        setRenewId(null);
                        onChange();
                      }}
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setRenewId(p.id)}
                    className="mt-2 rounded-full border border-pink-500 px-4 py-1.5 text-xs text-pink-200 hover:bg-pink-600/20"
                  >
                    Renovar ahora
                  </button>
                )}
              </>
            )}
            {p.status === "draft" && (
              <p className="mt-2 rounded-lg border border-amber-700/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
                <strong>Falta el pago.</strong> Transfiere según los datos de pago y
                sube el <strong>comprobante</strong> aquí abajo para activar tu anuncio.
              </p>
            )}
            {p.status === "pending_payment" && (
              <p className="mt-2 text-xs text-amber-300">
                ✓ Comprobante recibido · el equipo lo está revisando. Te avisaremos al aprobarlo.
              </p>
            )}
            {(p.status === "draft" || p.status === "pending_payment") && (
              <>
                <PaymentBox info={payInfo} />
                <ReceiptForm pubId={p.id} onUploaded={onChange} />
              </>
            )}
            {p.status === "expired" && (
              <>
                <p className="mt-1 text-xs text-red-300">
                  Tu anuncio ya no se muestra. Renuévalo para volver a aparecer.
                </p>
                <button
                  onClick={() =>
                    dashboard.renewPublication(p.id).then(() => {
                      toast("Anuncio renovado · sube tu comprobante");
                      onChange();
                    })
                  }
                  className="btn-gold mt-3 rounded-full px-4 py-1.5 text-sm font-medium"
                >
                  Renovar anuncio
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      {publications.length === 0 && (
        <div className="space-y-3">
          <p className="text-sm text-neutral-400">
            Elige tu plan. Después transfieres y subes el comprobante; el equipo lo
            aprueba y quedas visible.
          </p>
          <PlanPicker plans={plans} onChoose={create} busy={disabled} />
        </div>
      )}
    </div>
  );
}

/** Caja con los datos de pago configurados por el admin. */
function PaymentBox({ info }: { info: string }) {
  if (!info.trim()) return null;
  return (
    <div className="mt-3 rounded-lg border border-neutral-700 bg-neutral-950 p-3 text-xs">
      <p className="mb-1 font-semibold text-neutral-300">💳 Datos para tu transferencia</p>
      <p className="whitespace-pre-line text-neutral-400">{info}</p>
    </div>
  );
}

const MAX_RECEIPT_MB = 5;

function ReceiptForm({ pubId, onUploaded }: { pubId: number; onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setErr("");
    if (preview) URL.revokeObjectURL(preview);

    if (!f) {
      setFile(null);
      setPreview(null);
      return;
    }
    if (!f.type.startsWith("image/")) {
      setErr("El comprobante debe ser una imagen (JPG/PNG).");
      setFile(null);
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (f.size > MAX_RECEIPT_MB * 1024 * 1024) {
      setErr(`Imagen muy grande (máx ${MAX_RECEIPT_MB} MB).`);
      setFile(null);
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function clearSelection() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setErr("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function submit() {
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("image", file);
      await dashboard.uploadReceipt(pubId, fd);
      clearSelection();
      toast("Comprobante enviado · el equipo lo revisará");
      onUploaded();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al subir");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={onSelect}
          disabled={busy}
        />
        <span className="text-xs text-neutral-500">JPG/PNG · máx {MAX_RECEIPT_MB} MB</span>
      </div>

      {preview && file && (
        <div className="flex items-start gap-3 rounded-lg border border-neutral-800 bg-neutral-950 p-2">
          {/* preview local */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="comprobante" className="h-24 w-24 rounded object-cover" />
          <div className="flex-1 text-xs">
            <p className="font-medium text-neutral-200">{file.name}</p>
            <p className="text-neutral-500">{(file.size / 1024).toFixed(0)} KB</p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={submit}
                disabled={busy}
                className="rounded-full bg-pink-600 px-3 py-1 font-medium hover:bg-pink-500 disabled:opacity-50"
              >
                {busy ? "Subiendo…" : "Subir comprobante"}
              </button>
              <button
                onClick={clearSelection}
                disabled={busy}
                className="rounded-full border border-neutral-700 px-3 py-1 text-neutral-400 hover:text-neutral-100"
              >
                Quitar
              </button>
            </div>
          </div>
        </div>
      )}

      {err && <p className="text-red-400">{err}</p>}
    </div>
  );
}

function PhotoGrid({ photos, onChange }: { photos: Media[]; onChange: () => void }) {
  // Estado local para optimismo durante el arrastre.
  const [items, setItems] = useState<Media[]>(photos);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  // Mantener en sync con props cuando el padre recarga.
  useEffect(() => {
    setItems([...photos].sort((a, b) => a.order - b.order));
  }, [photos]);

  function onDragStart(e: React.DragEvent, id: number) {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(id));
  }

  function onDragOver(e: React.DragEvent, id: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (overId !== id) setOverId(id);
  }

  /** Mueve el elemento en `fromIdx` a la posición `toIdx` y persiste. */
  async function reorder(fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || toIdx >= items.length) return;
    const reordered = [...items];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const withNewOrder = reordered.map((m, i) => ({ ...m, order: i * 10 }));
    const previous = items;
    setItems(withNewOrder);
    setBusy(true);
    try {
      const changed = withNewOrder.filter(
        (m) => m.order !== previous.find((p) => p.id === m.id)?.order,
      );
      await Promise.all(changed.map((m) => dashboard.updateMediaOrder(m.id, m.order)));
      onChange();
    } finally {
      setBusy(false);
    }
  }

  async function onDrop(e: React.DragEvent, targetId: number) {
    e.preventDefault();
    const srcId = draggingId;
    setDraggingId(null);
    setOverId(null);
    if (srcId === null || srcId === targetId) return;
    await reorder(
      items.findIndex((m) => m.id === srcId),
      items.findIndex((m) => m.id === targetId),
    );
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {items.map((m, idx) => {
          const isDragging = draggingId === m.id;
          const isOver = overId === m.id && draggingId !== m.id;
          const isFirst = idx === 0;
          const isLast = idx === items.length - 1;
          return (
            <div
              key={m.id}
              draggable
              onDragStart={(e) => onDragStart(e, m.id)}
              onDragOver={(e) => onDragOver(e, m.id)}
              onDrop={(e) => onDrop(e, m.id)}
              onDragEnd={() => {
                setDraggingId(null);
                setOverId(null);
              }}
              className={`group relative cursor-grab overflow-hidden rounded-lg border bg-neutral-900 transition active:cursor-grabbing ${
                isOver ? "border-pink-500 ring-2 ring-pink-500/40" : "border-neutral-800"
              } ${isDragging ? "opacity-50" : ""}`}
            >
              <Image
                src={m.file_url}
                alt="foto"
                width={200}
                height={200}
                draggable={false}
                className="aspect-square w-full object-cover"
              />
              {/* Botones ↑↓: visibles siempre (fallback táctil al drag&drop). */}
              <div className="absolute inset-x-1 bottom-1 flex justify-between">
                <button
                  type="button"
                  disabled={isFirst || busy}
                  onClick={() => reorder(idx, idx - 1)}
                  aria-label="Mover foto a la izquierda"
                  className="rounded-full bg-black/70 px-2 py-1 text-xs leading-none text-neutral-200 disabled:opacity-30"
                >
                  ←
                </button>
                <button
                  type="button"
                  disabled={isLast || busy}
                  onClick={() => reorder(idx, idx + 1)}
                  aria-label="Mover foto a la derecha"
                  className="rounded-full bg-black/70 px-2 py-1 text-xs leading-none text-neutral-200 disabled:opacity-30"
                >
                  →
                </button>
              </div>
              <button
                onClick={() => dashboard.deleteMedia(m.id).then(onChange)}
                className="absolute right-1 top-1 rounded-full bg-black/70 px-2 py-0.5 text-xs text-red-300"
                title="Eliminar"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        Usa ← → o arrastra para reordenar{busy && " · guardando…"}
      </p>
    </div>
  );
}

interface UINotification {
  id: number;
  kind: string;
  title: string;
  message: string;
  link: string;
  created_at: string;
  read_at: string | null;
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<UINotification[]>([]);
  const [unread, setUnread] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer click/tap fuera del dropdown.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const reload = useCallback(async () => {
    const [list, count] = await Promise.all([
      dashboard.notifications() as Promise<UINotification[]>,
      dashboard.unreadNotifications(),
    ]);
    setItems(list);
    setUnread(count.unread);
  }, []);

  useEffect(() => {
    reload();
    // Sondeo ligero cada 30s para captar aprobaciones del admin.
    const id = setInterval(reload, 30000);
    return () => clearInterval(id);
  }, [reload]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await dashboard.markAllRead();
      reload();
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={toggle}
        className="relative rounded-full border border-neutral-700 px-3 py-1.5 text-sm hover:border-pink-600"
        aria-label="Notificaciones"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-pink-600 px-1.5 text-[10px] font-semibold text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-x-4 top-16 z-20 max-w-sm rounded-xl border border-neutral-800 bg-neutral-950 p-3 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Notificaciones
          </p>
          {items.length === 0 ? (
            <p className="text-sm text-neutral-500">Sin avisos por ahora.</p>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`rounded-lg border p-2 text-sm ${
                    n.read_at ? "border-neutral-800" : "border-pink-700/60 bg-pink-950/20"
                  }`}
                >
                  <p className="font-medium">{n.title}</p>
                  {n.message && <p className="mt-0.5 text-xs text-neutral-400">{n.message}</p>}
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-neutral-600">
                    {new Date(n.created_at).toLocaleString("es-CL")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

interface Stats {
  views_total: number; views_30d: number; views_7d: number;
  contacts_total: number; contacts_30d: number; contacts_7d: number;
}

function StatsPanel({ hasProfile }: { hasProfile: boolean }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!hasProfile) return;
    dashboard.stats().then(setStats).catch((e) =>
      setErr(e instanceof Error ? e.message : "Error")
    );
  }, [hasProfile]);

  if (!hasProfile) {
    return <p className="text-xs text-neutral-500">Crea tu perfil para ver estadísticas.</p>;
  }
  if (err) return <p className="text-sm text-red-400">{err}</p>;
  if (!stats) return <p className="text-sm text-neutral-500">Cargando…</p>;

  const Card = ({ label, value }: { label: string; value: number }) => (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <p className="text-2xl font-bold">{value.toLocaleString("es-CL")}</p>
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
    </div>
  );

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Card label="Visitas (7 días)" value={stats.views_7d} />
      <Card label="Visitas (30 días)" value={stats.views_30d} />
      <Card label="Visitas totales" value={stats.views_total} />
      <Card label="Contactos (7 días)" value={stats.contacts_7d} />
      <Card label="Contactos (30 días)" value={stats.contacts_30d} />
      <Card label="Contactos totales" value={stats.contacts_total} />
    </div>
  );
}

function TagSelector({
  services,
  selected,
  onToggle,
}: {
  services: Service[];
  selected: Set<number>;
  onToggle: (id: number) => void;
}) {
  if (services.length === 0) return null;
  const byCat = services.reduce<Record<ServiceCategory, Service[]>>(
    (acc, s) => {
      (acc[s.category] ||= []).push(s);
      return acc;
    },
    { service: [], extra: [], feature: [] },
  );
  return (
    <div className="sm:col-span-2 space-y-3">
      {(["service", "extra", "feature"] as const).map((cat) =>
        byCat[cat].length === 0 ? null : (
          <div key={cat}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {CATEGORY_LABEL[cat]}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {byCat[cat].map((s) => {
                const checked = selected.has(s.id);
                return (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => onToggle(s.id)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      checked
                        ? "border-pink-500 bg-pink-600/20 text-pink-200"
                        : "border-neutral-700 text-neutral-300 hover:border-pink-500"
                    }`}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>
        ),
      )}
    </div>
  );
}

function VisibilityBanner({
  profile,
  publications,
}: {
  profile: Profile | null;
  publications: Publication[];
}) {
  if (!profile) {
    return (
      <div className="rounded-xl border border-amber-700/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
        Crea tu perfil para empezar. Tras llenarlo, sube tus documentos KYC y
        publica tu primer anuncio.
      </div>
    );
  }

  if (profile.verification_status === "pending") {
    if (profile.pending_verification) {
      return (
        <div className="rounded-xl border border-sky-700/50 bg-sky-950/30 px-4 py-3 text-sm text-sky-200">
          📤 <strong>Documentos en revisión.</strong> El admin los está validando;
          te avisaremos por notificación cuando se apruebe. Esto puede tardar
          unas horas.
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-amber-700/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
        ⏳ Tu perfil aún no es público. Sube tus documentos en{" "}
        <strong>Verificación de identidad</strong> para que el admin los apruebe.
      </div>
    );
  }

  if (profile.verification_status === "rejected") {
    const reason = profile.latest_verification?.rejection_reason?.trim();
    return (
      <div className="rounded-xl border border-red-700/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
        <p className="font-semibold">❌ Tu verificación fue rechazada</p>
        {reason ? (
          <p className="mt-1">
            <span className="text-red-300/80">Motivo del admin: </span>
            {reason}
          </p>
        ) : (
          <p className="mt-1 text-red-300/80">
            El admin no dejó un motivo específico.
          </p>
        )}
        <p className="mt-2">
          Corrige lo indicado y vuelve a enviar tus documentos desde{" "}
          <strong>Verificación de identidad</strong>.
        </p>
      </div>
    );
  }

  // Verificado: revisar trial y publicación activa.
  const now = Date.now();
  const trialEnds = profile.trial_ends_at ? new Date(profile.trial_ends_at).getTime() : 0;
  const inTrial = trialEnds > now;
  const activePubs = publications.filter(
    (p) => p.status === "active" && p.expires_at && new Date(p.expires_at).getTime() > now,
  );

  if (activePubs.length > 0) {
    // El que vence primero define el aviso.
    const soonest = activePubs.reduce((a, b) =>
      new Date(a.expires_at!).getTime() < new Date(b.expires_at!).getTime() ? a : b,
    );
    const d = daysLeft(soonest.expires_at)!;
    const date = new Date(soonest.expires_at!).toLocaleDateString("es-CL");
    if (d <= 3) {
      return (
        <div className="rounded-xl border border-amber-600/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          ⏰ <strong>Tu anuncio vence {d === 0 ? "hoy" : `en ${d} día${d === 1 ? "" : "s"}`}</strong> ({date}).
          Sube un nuevo comprobante en <strong>Mis anuncios</strong> para no perder visibilidad.
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-emerald-700/50 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
        ✅ <strong>Tu anuncio está activo y visible.</strong> Quedan{" "}
        <strong>{d} días</strong> · vence el {date}.
      </div>
    );
  }

  if (inTrial) {
    const hoursLeft = Math.ceil((trialEnds - now) / 3_600_000);
    return (
      <div className="rounded-xl border border-pink-700/50 bg-pink-950/30 px-4 py-3 text-sm text-pink-200">
        🎁 <strong>Trial gratuito activo</strong> · tu perfil es visible por las
        próximas <strong>{hoursLeft} h</strong>. Crea un anuncio y sube el
        comprobante de pago para seguir visible cuando termine.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-neutral-300">
      Tu perfil ya no aparece en el listado público. Crea un anuncio activo en{" "}
      <strong>Mis anuncios</strong> para volver a ser visible.
    </div>
  );
}

function AvailabilityPanel({
  availableUntil,
  onChange,
}: {
  availableUntil: string | null;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Tick cada 30s para refrescar el countdown.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const endsAt = availableUntil ? new Date(availableUntil).getTime() : 0;
  const active = endsAt > now;
  const minutesLeft = active ? Math.max(1, Math.round((endsAt - now) / 60000)) : 0;

  async function activate(minutes: number) {
    setBusy(true);
    try {
      await dashboard.setAvailability(minutes);
      onChange();
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    try {
      await dashboard.cancelAvailability();
      onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Disponibilidad ahora</p>
          {active ? (
            <p className="mt-1 flex items-center gap-2 text-xs text-emerald-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Vencen tu disponibilidad en <strong>~{minutesLeft} min</strong>
            </p>
          ) : (
            <p className="mt-1 text-xs text-neutral-500">
              Activa para que aparezcas en la pestaña &quot;Disponibles ahora&quot;
              y con badge verde en tu tarjeta.
            </p>
          )}
        </div>
        {active && (
          <button
            disabled={busy}
            onClick={cancel}
            className="rounded-full border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:text-red-300"
          >
            Detener
          </button>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {[60, 120, 240, 360, 720, 1440].map((m) => (
          <button
            key={m}
            disabled={busy}
            onClick={() => activate(m)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              active
                ? "border border-neutral-700 text-neutral-300 hover:border-emerald-500"
                : "bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
            }`}
          >
            {m < 60 ? `${m}m` : `${m / 60}h`}
          </button>
        ))}
      </div>
    </section>
  );
}

interface DashboardStory {
  id: number;
  kind: "photo" | "video";
  file_url: string;
  created_at: string;
  expires_at: string;
}

function StoriesPanel({ publications }: { publications: Publication[] }) {
  const [stories, setStories] = useState<DashboardStory[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Solo perfiles con anuncio destacado activo pueden publicar historias.
  const eligible = publications.some(
    (p) =>
      p.status === "active" && p.is_featured && p.expires_at &&
      new Date(p.expires_at).getTime() > Date.now(),
  );

  const reload = useCallback(async () => {
    try {
      setStories((await dashboard.myStories()) as DashboardStory[]);
    } catch {
      // sin permiso (no destacada) → vacío
    }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setErr("");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("upload", f);
      await dashboard.uploadStory(fd);
      if (inputRef.current) inputRef.current.value = "";
      await reload();
    } catch (caught) {
      setErr(caught instanceof Error ? caught.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Historias 24h</p>
          <p className="mt-1 text-xs text-neutral-500">
            Solo para perfiles con anuncio <strong>destacado</strong> activo.
            Se borran automáticamente a las 24h.
          </p>
        </div>
        {eligible && (
          <label className="btn-gold cursor-pointer rounded-full px-4 py-2 text-sm font-medium">
            {busy ? "Subiendo…" : "+ Subir"}
            <input
              ref={inputRef}
              type="file"
              accept="image/*,video/*"
              disabled={busy}
              onChange={onUpload}
              className="hidden"
            />
          </label>
        )}
      </div>

      {!eligible && (
        <div className="mt-3 rounded-lg border border-[#caa24a]/40 bg-[#e9c15c]/[0.06] px-3 py-2.5 text-xs text-[#e9c15c]">
          ⭐ <strong>Las historias son del plan Destacado.</strong> Mejora tu plan para
          publicar historias de 24h y aparecer de primera.
        </div>
      )}

      {err && <p className="mt-2 text-xs text-red-400">{err}</p>}

      {eligible && stories.length === 0 ? (
        <p className="mt-3 text-xs text-neutral-500">
          Aún no subiste historias. Toca + Subir para empezar.
        </p>
      ) : stories.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-3">
          {stories.map((s) => (
            <div key={s.id} className="group relative">
              <div className="overflow-hidden rounded-lg border border-neutral-800 bg-black">
                {s.kind === "photo" ? (
                  <Image src={s.file_url} alt="" width={96} height={96} unoptimized className="h-24 w-24 object-cover" />
                ) : (
                  <video src={s.file_url} className="h-24 w-24 object-cover" muted />
                )}
              </div>
              <button
                onClick={async () => {
                  await dashboard.deleteStory(s.id);
                  reload();
                }}
                className="absolute -right-1 -top-1 rounded-full bg-black/80 px-1.5 py-0.5 text-xs text-red-300"
              >
                ✕
              </button>
              <p className="mt-1 text-center text-[10px] text-neutral-500">
                {Math.round(
                  (new Date(s.expires_at).getTime() - Date.now()) / 3_600_000,
                )}{" "}
                h
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
