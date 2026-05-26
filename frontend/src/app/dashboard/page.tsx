"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { auth, dashboard } from "@/lib/client-api";
import type { Plan, Region, City, Service, ServiceCategory } from "@/lib/types";
import { CATEGORY_LABEL } from "@/lib/types";

interface Profile {
  id: number;
  stage_name: string;
  description: string;
  age: number;
  city: City | null;
  verification_status: string;
  whatsapp: string;
  telegram: string;
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
      age: Number(form.get("age")),
      description: form.get("description"),
      whatsapp: form.get("whatsapp") ?? "",
      telegram: form.get("telegram") ?? "",
      service_ids: Array.from(selectedTags),
    };
    // Solo enviamos city_id si el usuario eligió una comuna real. Si el select
    // está en el placeholder, dejamos el valor existente intacto (partial update).
    if (cityRaw) data.city_id = Number(cityRaw);
    try {
      if (profile) await dashboard.updateProfile(profile.id, data);
      else await dashboard.createProfile(data);
      setMsg("Perfil guardado.");
      await loadAll();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error");
    }
  }

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mi panel</h1>
        <div className="flex items-center gap-3">
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
        <KycForm onDone={() => setMsg("Documentos enviados a revisión.")} />
      </section>

      {/* Multimedia */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Multimedia (máx. 6 fotos, 1 video)</h2>
        <MediaManager media={media} onChange={loadAll} disabled={!profile} />
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
    </div>
  );
}

function KycForm({ onDone }: { onDone: () => void }) {
  const [err, setErr] = useState("");
  async function submit(form: FormData) {
    try {
      await dashboard.submitVerification(form);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    }
  }
  return (
    <form action={submit} className="space-y-3 text-sm">
      <label className="block">
        <span className="mb-1 block text-neutral-400">Cédula</span>
        <input name="id_document" type="file" accept="image/*" required className="block w-full text-base" />
      </label>
      <label className="block">
        <span className="mb-1 block text-neutral-400">Selfie</span>
        <input name="selfie" type="file" accept="image/*" required className="block w-full text-base" />
      </label>
      {err && <p className="text-red-400">{err}</p>}
      <button className="w-full rounded-full bg-pink-600 px-5 py-2.5 font-medium hover:bg-pink-500 sm:w-fit">
        Enviar
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

function MediaManager({
  media,
  onChange,
  disabled,
}: {
  media: Media[];
  onChange: () => void;
  disabled: boolean;
}) {
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [type, setType] = useState<"photo" | "video">("photo");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const photos = media.filter((m) => m.media_type === "photo");
  const videos = media.filter((m) => m.media_type === "video");
  const limit = type === "photo" ? PHOTO_LIMIT : VIDEO_LIMIT;
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
  const [err, setErr] = useState("");
  async function create(form: FormData) {
    try {
      await dashboard.createPublication({
        title: form.get("title"),
        plan_id: form.get("plan_id") ? Number(form.get("plan_id")) : null,
      });
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    }
  }
  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {publications.map((p) => (
          <li key={p.id} className="rounded-xl border border-neutral-800 p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">{p.title}</span>
              <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs">{p.status}</span>
            </div>
            {(p.status === "draft" || p.status === "pending_payment") && (
              <ReceiptForm pubId={p.id} onUploaded={onChange} />
            )}
            {p.status === "expired" && (
              <button
                onClick={() => dashboard.renewPublication(p.id).then(onChange)}
                className="mt-3 rounded-full bg-pink-600 px-4 py-1.5 text-sm font-medium hover:bg-pink-500"
              >
                Renovar anuncio
              </button>
            )}
          </li>
        ))}
      </ul>
      <form action={create} className="grid gap-2 text-sm sm:grid-cols-[1fr_auto_auto]">
        <input
          name="title"
          placeholder="Título del anuncio"
          required
          disabled={disabled}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-base"
        />
        <select
          name="plan_id"
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-base"
        >
          {plans.map((pl) => (
            <option key={pl.id} value={pl.id}>
              {pl.name} — ${pl.price} / {pl.duration_days}d
            </option>
          ))}
        </select>
        <button
          disabled={disabled}
          className="rounded-full bg-pink-600 px-5 py-2.5 font-medium hover:bg-pink-500 disabled:opacity-50"
        >
          Crear anuncio
        </button>
      </form>
      {err && <p className="text-sm text-red-400">{err}</p>}
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
    <div className="relative">
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
