"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousActive = useRef<HTMLElement | null>(null);
  const prev = useCallback(() => onIndex((index - 1 + items.length) % items.length), [index, items.length, onIndex]);
  const next = useCallback(() => onIndex((index + 1) % items.length), [index, items.length, onIndex]);
  const current = items[index];

  // A11y: cerrar con Esc, navegar con flechas, trap de foco, bloquear scroll.
  useEffect(() => {
    previousActive.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      previousActive.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Tab") {
        const focusable = Array.from(
          ref.current?.querySelectorAll<HTMLElement>("button, video[controls]") ?? []
        ).filter((element) => !element.hasAttribute("disabled"));
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
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [index, items.length, next, onClose, prev]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lightbox-title"
      ref={ref}
      tabIndex={-1}
    >
      <h2 id="lightbox-title" className="sr-only">
        Galería de {alt}, imagen {index + 1} de {items.length}
      </h2>
      <button
        type="button"
        ref={closeRef}
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
            aria-label={`${alt} video ${index + 1}`}
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
            type="button"
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
            type="button"
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
