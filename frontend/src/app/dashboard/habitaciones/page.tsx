"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, dashboard, rooms, type PublicRoom } from "@/lib/client-api";

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

interface Region {
  id: number;
  name: string;
  slug: string;
}
interface City {
  id: number;
  name: string;
  slug: string;
}

export default function RoomsBrowsePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [gated, setGated] = useState(false);
  const [items, setItems] = useState<PublicRoom[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [availableNow, setAvailableNow] = useState(false);
  const [selected, setSelected] = useState<PublicRoom | null>(null);

  const load = useCallback(async () => {
    const params: Record<string, string> = {};
    if (region) params.region = region;
    if (city) params.city = city;
    if (availableNow) params.available_now = "true";
    try {
      setItems(await rooms.browse(params));
      setGated(false);
    } catch (e) {
      // 403 = perfil no activo. El backend protege con IsActiveModel.
      if (e instanceof Error && /activo|forbidden/i.test(e.message)) {
        setGated(true);
      } else {
        throw e;
      }
    }
  }, [region, city, availableNow]);

  useEffect(() => {
    auth
      .me()
      .then((me) => {
        const u = me as { role?: string };
        if (u.role !== "model") {
          router.replace("/");
          return Promise.reject(new Error("redirect"));
        }
        return dashboard.regions();
      })
      .then((r) => {
        setRegions(r as Region[]);
        return load();
      })
      .then(() => setReady(true))
      .catch((e) => {
        if (e instanceof Error && e.message === "redirect") return;
        router.replace("/login?next=/dashboard/habitaciones");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (region) {
      dashboard.cities(region).then((c) => setCities(c as City[]));
    } else {
      setCities([]);
    }
    setCity("");
  }, [region]);

  useEffect(() => {
    if (ready) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, city, availableNow]);

  if (!ready) return <p className="text-neutral-400">Cargando…</p>;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-neutral-500">
          <Link href="/dashboard" className="hover:text-pink-400">
            Mi panel
          </Link>{" "}
          / Habitaciones
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
          Habitaciones disponibles
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          Piezas publicadas por anfitriones en todo el país. Contacta directo por WhatsApp.
        </p>
      </header>

      {gated ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-600/10 p-6 text-center">
          <p className="font-medium text-amber-200">
            Tu perfil debe estar activo para ver las habitaciones.
          </p>
          <p className="mt-1 text-sm text-neutral-300">
            Completa tu verificación o activa una publicación y vuelve aquí.
          </p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block rounded-full bg-pink-600 px-5 py-2 text-sm font-medium hover:bg-pink-500"
          >
            Ir a mi panel
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <select
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            >
              <option value="">Toda región</option>
              {regions.map((r) => (
                <option key={r.id} value={r.slug}>
                  {r.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm disabled:opacity-50"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              disabled={!region}
            >
              <option value="">Toda comuna</option>
              {cities.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setAvailableNow((v) => !v)}
              aria-pressed={availableNow}
              className={`rounded-lg border px-3 py-2 text-sm ${
                availableNow
                  ? "border-emerald-500 bg-emerald-600/20 text-emerald-300"
                  : "border-neutral-700 text-neutral-300 hover:border-pink-500"
              }`}
            >
              🟢 Disponibles ahora
            </button>
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-neutral-500">
              No hay habitaciones disponibles con estos filtros.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {items.map((room) => (
                <RoomCard key={room.id} room={room} onOpen={() => setSelected(room)} />
              ))}
            </ul>
          )}
        </>
      )}

      {selected && <RoomDetailModal room={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function waLink(number: string, title: string) {
  const digits = number.replace(/[^\d]/g, "");
  const text = encodeURIComponent(`Hola, vi tu publicación "${title}" en Clasificados VIP.`);
  return `https://wa.me/${digits}?text=${text}`;
}

function RoomCard({ room, onOpen }: { room: PublicRoom; onOpen: () => void }) {
  const cover = room.photos[0];
  return (
    <li className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="relative">
          {cover ? (
            <Image src={cover.image_url} alt={room.title} width={640} height={400} unoptimized className="h-44 w-full object-cover" />
          ) : (
            <div className="flex h-44 w-full items-center justify-center bg-neutral-800 text-neutral-600">Sin foto</div>
          )}
          {room.photos.length > 1 && (
            <span className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-xs text-white">
              {room.photos.length} fotos
            </span>
          )}
          {room.is_available_now && (
            <span className="absolute left-2 top-2 rounded-full bg-emerald-500/95 px-2 py-0.5 text-[11px] font-semibold text-white">
              🟢 Disponible ahora
            </span>
          )}
        </div>
        <div className="space-y-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold">
              {room.is_featured && <span className="mr-1 text-amber-300">⭐</span>}
              {room.title}
            </p>
            <p className="whitespace-nowrap text-sm font-medium text-pink-300">
              {CLP.format(room.price)}{" "}
              <span className="text-xs text-neutral-400">{PERIOD_LABEL[room.price_period]}</span>
            </p>
          </div>
          <p className="text-xs text-neutral-400">
            {room.city ?? "—"}{room.region && `, ${room.region}`}{room.sector && ` · ${room.sector}`}
          </p>
          {room.description && <p className="line-clamp-2 text-sm text-neutral-300">{room.description}</p>}
          <p className="pt-1 text-xs text-pink-400">Ver detalle →</p>
        </div>
      </button>
    </li>
  );
}

function RoomDetailModal({ room, onClose }: { room: PublicRoom; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const [reportMsg, setReportMsg] = useState("");
  const photos = room.photos;
  const photo = photos[idx];
  const dialogRef = useRef<HTMLDivElement>(null);

  async function report() {
    const reason = window.prompt("¿Por qué reportas esta habitación? (opcional)");
    if (reason === null) return;
    try {
      await rooms.report(room.id, reason);
      setReportMsg("Gracias, recibimos tu reporte.");
    } catch {
      setReportMsg("No se pudo enviar el reporte.");
    }
  }

  // Accesibilidad del diálogo (WCAG): cerrar con Esc, trap de foco, restaurar
  // el foco al cerrar y bloquear el scroll del fondo.
  useEffect(() => {
    const prevActive = document.activeElement as HTMLElement | null;
    const node = dialogRef.current;
    const focusables = () =>
      node
        ? Array.from(
            node.querySelectorAll<HTMLElement>(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
            ),
          ).filter((el) => !el.hasAttribute("disabled"))
        : [];
    focusables()[0]?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab") {
        const f = focusables();
        if (f.length === 0) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prevActive?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-modal-title"
        className="my-6 w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          {photo ? (
            <Image src={photo.image_url} alt={room.title} width={900} height={600} unoptimized className="max-h-[55vh] w-full rounded-t-2xl object-contain bg-black" />
          ) : (
            <div className="flex h-56 w-full items-center justify-center rounded-t-2xl bg-neutral-800 text-neutral-600">Sin foto</div>
          )}
          <button aria-label="Cerrar" onClick={onClose} className="absolute right-2 top-2 rounded-full bg-black/70 px-2.5 py-1 text-sm text-white hover:bg-black">✕</button>
          {photos.length > 1 && (
            <>
              <button aria-label="Foto anterior" onClick={() => setIdx((i) => (i - 1 + photos.length) % photos.length)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/70 px-3 py-1.5 text-white hover:bg-black">‹</button>
              <button aria-label="Foto siguiente" onClick={() => setIdx((i) => (i + 1) % photos.length)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/70 px-3 py-1.5 text-white hover:bg-black">›</button>
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-2 py-0.5 text-xs text-white">{idx + 1}/{photos.length}</span>
            </>
          )}
        </div>
        <div className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-2">
            <h2 id="room-modal-title" className="text-lg font-semibold">
              {room.is_featured && <span className="mr-1 text-amber-300">⭐</span>}
              {room.title}
            </h2>
            <p className="whitespace-nowrap text-sm font-medium text-pink-300">
              {CLP.format(room.price)} <span className="text-xs text-neutral-400">{PERIOD_LABEL[room.price_period]}</span>
            </p>
          </div>
          <p className="text-xs text-neutral-400">
            {room.city ?? "—"}{room.region && `, ${room.region}`}{room.sector && ` · ${room.sector}`}
          </p>
          {room.is_available_now && (
            <span className="inline-block rounded-full bg-emerald-600/20 px-2 py-0.5 text-xs font-medium text-emerald-300">
              🟢 Disponible ahora
            </span>
          )}
          {room.description && <p className="whitespace-pre-line text-sm text-neutral-200">{room.description}</p>}
          <p className="text-xs text-neutral-500">Por privacidad solo se muestra la comuna y un sector, nunca la dirección exacta.</p>
          <div className="flex gap-2 pt-1">
            {room.whatsapp && (
              <a href={waLink(room.whatsapp, room.title)} target="_blank" rel="noopener noreferrer"
                className="flex-1 rounded-full bg-emerald-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-emerald-500">WhatsApp</a>
            )}
            {room.phone && (
              <a href={`tel:${room.phone}`} className="flex-1 rounded-full border border-neutral-700 px-3 py-2 text-center text-sm hover:border-pink-500">Llamar</a>
            )}
          </div>
          {reportMsg ? (
            <p className="text-xs text-emerald-400">{reportMsg}</p>
          ) : (
            <button onClick={report} className="text-xs text-neutral-500 hover:text-red-400">
              Reportar esta habitación
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
