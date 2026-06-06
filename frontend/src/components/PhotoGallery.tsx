"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

type Item = { type: "photo" | "video"; url: string };

/**
 * Grilla del muro: fotos y videos como tiles del mismo tamaño (3:4). Al hacer
 * click se abren a tamaño completo en el lightbox (el video se reproduce entero).
 */
export function PhotoGallery({
  photos,
  videos = [],
  alt,
}: {
  photos: string[];
  videos?: string[];
  alt: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const items: Item[] = [
    ...photos.map((url) => ({ type: "photo" as const, url })),
    ...videos.map((url) => ({ type: "video" as const, url })),
  ];

  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((it, i) => (
          <button
            key={it.url}
            type="button"
            onClick={() => setOpen(i)}
            aria-label={`Ver ${alt} ${it.type === "video" ? "video" : "foto"} ${i + 1} en tamaño completo`}
            className="relative block overflow-hidden rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500"
          >
            {it.type === "photo" ? (
              <Image
                src={it.url}
                alt={`${alt} foto ${i + 1}`}
                width={600}
                height={800}
                sizes="(max-width: 640px) 50vw, 33vw"
                priority={i === 0}
                className="aspect-[3/4] w-full cursor-zoom-in object-cover object-top transition hover:opacity-90"
              />
            ) : (
              <>
                <video
                  src={it.url}
                  muted
                  playsInline
                  preload="metadata"
                  className="aspect-[3/4] w-full cursor-pointer bg-black object-cover transition hover:opacity-90"
                />
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-xl text-white backdrop-blur">
                    ▶
                  </span>
                </span>
                <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  VIDEO
                </span>
              </>
            )}
          </button>
        ))}
      </div>

      {open !== null && (
        <Lightbox
          items={items}
          alt={alt}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

export function Lightbox({
  items,
  alt,
  index,
  onIndex,
  onClose,
}: {
  items: Item[];
  alt: string;
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const prev = () => onIndex((index - 1 + items.length) % items.length);
  const next = () => onIndex((index + 1) % items.length);
  const current = items[index];

  // A11y: cerrar con Esc, navegar con flechas, trap de foco, bloquear scroll.
  useEffect(() => {
    const prevActive = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Tab") e.preventDefault(); // foco confinado al diálogo
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prevActive?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${alt} — ${index + 1} de ${items.length}`}
      ref={ref}
      tabIndex={-1}
    >
      <button
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute right-3 top-3 z-10 rounded-full bg-white/10 px-3 py-1.5 text-lg text-white hover:bg-white/20"
      >
        ✕
      </button>

      <div
        className="relative flex h-[85vh] w-full max-w-5xl items-center justify-center"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => current.type === "video" && e.preventDefault()}
      >
        {current.type === "photo" ? (
          <Image
            src={current.url}
            alt={`${alt} foto ${index + 1}`}
            fill
            unoptimized
            sizes="100vw"
            className="object-contain"
          />
        ) : (
          <video
            key={current.url}
            src={current.url}
            controls
            autoPlay
            playsInline
            controlsList="nodownload noplaybackrate"
            disablePictureInPicture
            className="max-h-[85vh] w-full object-contain"
          />
        )}
      </div>

      {items.length > 1 && (
        <>
          <button
            aria-label="Anterior"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-3.5 py-2 text-xl text-white hover:bg-white/20"
          >
            ‹
          </button>
          <button
            aria-label="Siguiente"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-3.5 py-2 text-xl text-white hover:bg-white/20"
          >
            ›
          </button>
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm text-white">
            {index + 1} / {items.length}
          </span>
        </>
      )}
    </div>
  );
}
