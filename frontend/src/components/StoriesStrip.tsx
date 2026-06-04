"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { Story } from "@/lib/types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

/** Ring rosa estilo IG: click abre el viewer fullscreen con auto-advance simple. */
export function StoriesStrip({
  stories,
  stageName,
  coverPhoto,
}: {
  stories: Story[];
  stageName: string;
  coverPhoto: string | null;
}) {
  const [openAt, setOpenAt] = useState<number | null>(null);

  if (stories.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenAt(0)}
        className="flex items-center gap-3 rounded-full p-1 text-left transition hover:opacity-90"
        aria-label={`Ver historias de ${stageName}`}
      >
        <span className="relative inline-block">
          <span className="absolute inset-0 rounded-full bg-gradient-to-br from-[#ecccb9] via-[#c68b6a] to-[#9f6242]" />
          <span className="relative m-[3px] block h-16 w-16 overflow-hidden rounded-full border-2 border-neutral-950">
            {coverPhoto && <Image src={coverPhoto} alt="" width={64} height={64} unoptimized className="h-full w-full object-cover" />}
          </span>
        </span>
        <span>
          <p className="font-semibold">{stageName}</p>
          <p className="text-xs text-neutral-400">
            {stories.length} {stories.length === 1 ? "historia" : "historias"}
          </p>
        </span>
      </button>

      {openAt !== null && (
        <Viewer
          stories={stories}
          startAt={openAt}
          stageName={stageName}
          onClose={() => setOpenAt(null)}
        />
      )}
    </>
  );
}

function Viewer({
  stories,
  startAt,
  stageName,
  onClose,
}: {
  stories: Story[];
  startAt: number;
  stageName: string;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startAt);
  const [progress, setProgress] = useState(0);
  const current = stories[idx];

  // Auto-advance: 5s para fotos. Para videos, esperamos al evento `ended`.
  useEffect(() => {
    if (current?.kind === "video") return;
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          if (idx + 1 < stories.length) setIdx(idx + 1);
          else onClose();
          return 100;
        }
        return p + 100 / 50; // 50 ticks de 100ms = 5s
      });
    }, 100);
    return () => clearInterval(interval);
  }, [idx, current, stories.length, onClose]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIdx((i) => (i + 1 < stories.length ? i + 1 : i));
      if (e.key === "ArrowLeft") setIdx((i) => (i > 0 ? i - 1 : 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stories.length, onClose]);

  async function report() {
    if (!confirm("¿Reportar esta historia como inapropiada?")) return;
    try {
      await fetch(`${API}/stories/${current.id}/report/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "" }),
        credentials: "omit",
      });
      alert("Reporte enviado. El admin la revisará.");
    } catch {
      // silencioso
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      {/* Barras de progreso arriba */}
      <div className="absolute inset-x-0 top-0 z-10 flex gap-1 p-2">
        {stories.map((_, i) => (
          <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full bg-white"
              style={{
                width: i < idx ? "100%" : i === idx ? `${progress}%` : "0%",
                transition: i === idx ? "none" : "width 0.2s",
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute inset-x-0 top-4 z-10 flex items-center justify-between px-4 pt-1 text-sm text-white">
        <p className="font-semibold">{stageName}</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={report}
            className="text-xs text-white/70 hover:text-white"
            aria-label="Reportar"
          >
            Reportar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl leading-none"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Tap zones */}
      <button
        type="button"
        onClick={() => setIdx((i) => (i > 0 ? i - 1 : i))}
        className="absolute inset-y-0 left-0 z-0 w-1/3"
        aria-label="Anterior"
      />
      <button
        type="button"
        onClick={() => {
          if (idx + 1 < stories.length) setIdx(idx + 1);
          else onClose();
        }}
        className="absolute inset-y-0 right-0 z-0 w-1/3"
        aria-label="Siguiente"
      />

      {/* Contenido */}
      <div className="relative max-h-full max-w-md">
        {current.kind === "photo" ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={current.file_url}
            alt=""
            className="max-h-screen w-full object-contain"
          />
        ) : (
          <video
            key={current.id}
            src={current.file_url}
            autoPlay
            playsInline
            controls={false}
            onEnded={() => {
              if (idx + 1 < stories.length) setIdx(idx + 1);
              else onClose();
            }}
            className="max-h-screen w-full"
          />
        )}
      </div>
    </div>
  );
}
