"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { auth, dashboard } from "@/lib/client-api";
import type { Plan, Region, City } from "@/lib/types";

interface Profile {
  id: number;
  stage_name: string;
  description: string;
  age: number;
  city: City | null;
  verification_status: string;
  whatsapp: string;
  telegram: string;
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
  const [plans, setPlans] = useState<Plan[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [msg, setMsg] = useState("");

  const loadAll = useCallback(async () => {
    const [profs, regs, pls, meds, pubs] = await Promise.all([
      dashboard.getProfile() as Promise<Profile[]>,
      dashboard.regions() as Promise<Region[]>,
      dashboard.plans() as Promise<Plan[]>,
      dashboard.listMedia() as Promise<Media[]>,
      dashboard.listPublications() as Promise<Publication[]>,
    ]);
    setProfile(profs[0] ?? null);
    setRegions(regs);
    setPlans(pls);
    setMedia(meds);
    setPublications(pubs);
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
    const data = {
      stage_name: form.get("stage_name"),
      age: Number(form.get("age")),
      description: form.get("description"),
      city_id: form.get("city_id") ? Number(form.get("city_id")) : null,
      whatsapp: form.get("whatsapp") ?? "",
      telegram: form.get("telegram") ?? "",
    };
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
        <button
          onClick={() => auth.logout().then(() => router.push("/"))}
          className="text-sm text-neutral-400 hover:text-pink-400"
        >
          Cerrar sesión
        </button>
      </div>
      {msg && <p className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-pink-400">{msg}</p>}

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
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2"
          />
          <input
            name="age"
            type="number"
            min={18}
            defaultValue={profile?.age}
            placeholder="Edad"
            required
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2"
          />
          <select
            onChange={(e) => onRegion(e.target.value)}
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2"
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
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2"
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
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2"
          />
          <input
            name="telegram"
            defaultValue={profile?.telegram}
            placeholder="Telegram (usuario, sin @)"
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2"
          />
          <textarea
            name="description"
            defaultValue={profile?.description}
            placeholder="Descripción"
            className="sm:col-span-2 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2"
          />
          <button className="rounded-full bg-pink-600 px-5 py-2 font-medium hover:bg-pink-500 sm:w-fit">
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
    <form action={submit} className="space-y-2 text-sm">
      <label className="block">
        Cédula
        <input name="id_document" type="file" required className="block w-full" />
      </label>
      <label className="block">
        Selfie
        <input name="selfie" type="file" required className="block w-full" />
      </label>
      {err && <p className="text-red-400">{err}</p>}
      <button className="rounded-full bg-pink-600 px-4 py-1.5 hover:bg-pink-500">Enviar</button>
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
          </li>
        ))}
      </ul>
      <form action={create} className="flex flex-wrap items-center gap-2 text-sm">
        <input
          name="title"
          placeholder="Título del anuncio"
          required
          disabled={disabled}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5"
        />
        <select name="plan_id" className="rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1.5">
          {plans.map((pl) => (
            <option key={pl.id} value={pl.id}>
              {pl.name} — ${pl.price} / {pl.duration_days}d
            </option>
          ))}
        </select>
        <button disabled={disabled} className="rounded-full bg-pink-600 px-4 py-1.5 disabled:opacity-50">
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

  async function onDrop(e: React.DragEvent, targetId: number) {
    e.preventDefault();
    const srcId = draggingId;
    setDraggingId(null);
    setOverId(null);
    if (srcId === null || srcId === targetId) return;

    const fromIdx = items.findIndex((m) => m.id === srcId);
    const toIdx = items.findIndex((m) => m.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;

    // Reordenar localmente (optimista).
    const reordered = [...items];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const withNewOrder = reordered.map((m, i) => ({ ...m, order: i * 10 }));
    setItems(withNewOrder);

    // Persistir solo los que cambiaron de orden.
    setBusy(true);
    try {
      const changed = withNewOrder.filter(
        (m) => m.order !== items.find((p) => p.id === m.id)?.order,
      );
      await Promise.all(
        changed.map((m) => dashboard.updateMediaOrder(m.id, m.order)),
      );
      onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {items.map((m) => {
          const isDragging = draggingId === m.id;
          const isOver = overId === m.id && draggingId !== m.id;
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
              <button
                onClick={() => dashboard.deleteMedia(m.id).then(onChange)}
                className="absolute right-1 top-1 rounded-full bg-black/70 px-2 py-0.5 text-xs text-red-300 opacity-0 transition group-hover:opacity-100"
                title="Eliminar"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        Arrastra las fotos para reordenar{busy && " · guardando…"}
      </p>
    </div>
  );
}
