"use client";

import { useState } from "react";
import Image from "next/image";
import { rooms, type PublicRoom } from "@/lib/client-api";

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

function waLink(number: string, title: string) {
  const digits = number.replace(/[^\d]/g, "");
  const text = encodeURIComponent(`Hola, vi tu publicación "${title}" en PortalVip Chile.`);
  return `https://wa.me/${digits}?text=${text}`;
}

/** Detalle de una habitación (reutilizable en página y, si se quiere, en modal). */
export function RoomDetail({ room }: { room: PublicRoom }) {
  const [idx, setIdx] = useState(0);
  const [reportMsg, setReportMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const photos = room.photos;
  const photo = photos[idx];

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

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: room.title, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // cancelado
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950">
      <div className="relative">
        {photo ? (
          <Image
            src={photo.image_url}
            alt={room.title}
            width={900}
            height={600}
            unoptimized
            className="max-h-[60vh] w-full rounded-t-2xl bg-black object-contain"
          />
        ) : (
          <div className="flex h-56 w-full items-center justify-center rounded-t-2xl bg-neutral-800 text-neutral-600">
            Sin foto
          </div>
        )}
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
          <h1 className="text-xl font-semibold">
            {room.is_featured && <span className="mr-1 text-amber-300">⭐</span>}
            {room.title}
          </h1>
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
        <p className="text-xs text-neutral-500">
          Por privacidad solo se muestra la comuna y un sector, nunca la dirección exacta.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {room.whatsapp && (
            <a href={waLink(room.whatsapp, room.title)} target="_blank" rel="noopener noreferrer"
              className="flex-1 rounded-full bg-emerald-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-emerald-500">WhatsApp</a>
          )}
          {room.phone && (
            <a href={`tel:${room.phone}`} className="flex-1 rounded-full border border-neutral-700 px-3 py-2 text-center text-sm hover:border-pink-500">Llamar</a>
          )}
          <button onClick={share} className="rounded-full border border-neutral-700 px-3 py-2 text-sm hover:border-pink-500">
            {copied ? "✓ Copiado" : "Compartir"}
          </button>
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
  );
}
