"use client";

import { useEffect, useRef, useState } from "react";
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

export function Viewer({
  stories,
  startAt,
  stageName,
  onClose,
  onComplete,
}: {
  stories: Story[];
  startAt: number;
  stageName: string;
  onClose: () => void;
  /** Se llama al terminar la última historia (vs onClose al cerrar a mano).
      Sirve para encadenar a la siguiente modelo en la franja de ciudad. */
  onComplete?: () => void;
}) {
  const [idx, setIdx] = useState(startAt);
  const [progress, setProgress] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActive = useRef<HTMLElement | null>(null);
  const [reportStatus, setReportStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const current = stories[idx];
  const finish = onComplete ?? onClose;

  // Auto-advance: 5s para fotos. Para videos, esperamos al evento `ended`.
  useEffect(() => {
    if (current?.kind === "video") return;
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          if (idx + 1 < stories.length) setIdx(idx + 1);
          else finish();
          return 100;
        }
        return p + 100 / 50; // 50 ticks de 100ms = 5s
      });
    }, 100);
    return () => clearInterval(interval);
  }, [idx, current, finish, onClose, stories.length]);

  useEffect(() => {
    previousActive.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = dialogRef.current?.querySelector<HTMLElement>("[aria-label='Cerrar']");
    close?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIdx((i) => (i + 1 < stories.length ? i + 1 : i));
      if (e.key === "ArrowLeft") setIdx((i) => (i > 0 ? i - 1 : 0));
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>("button, video[controls]")
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previousActive.current?.focus?.();
    };
  }, [onClose, stories.length]);

  async function report() {
    if (reportStatus === "sending" || reportStatus === "sent") return;
    setReportStatus("sending");
    try {
      const response = await fetch(`${API}/stories/${current.id}/report/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "" }),
        credentials: "omit",
      });
      if (!response.ok) throw new Error(`Story report failed: ${response.status}`);
      setReportStatus("sent");
    } catch {
      setReportStatus("error");
    }
  }

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
      role="dialog"
      aria-modal="true"
      aria-labelledby="story-viewer-title"
    >
      <h2 id="story-viewer-title" className="sr-only">Historia de {stageName}</h2>
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
            {reportStatus === "sending" ? "Enviando…" : reportStatus === "sent" ? "Reportada" : "Reportar"}
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
        {reportStatus === "error" && (
          <p className="absolute right-4 top-14 text-xs text-red-300" role="alert">
            No se pudo enviar el reporte.
          </p>
        )}
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
          else finish();
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
            alt={`${stageName} historia ${idx + 1}`}
            className="max-h-screen w-full object-contain"
          />
        ) : (
          <video
            key={current.id}
            src={current.file_url}
            autoPlay
            playsInline
            controls
            aria-label={`${stageName} historia en video`}
            onEnded={() => {
              if (idx + 1 < stories.length) setIdx(idx + 1);
              else finish();
            }}
            className="max-h-screen w-full"
          />
        )}
      </div>
    </div>
  );
}
