"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

/** Grilla de fotos del perfil con visor a tamaño completo (lightbox) al hacer click. */
export function PhotoGallery({ photos, alt }: { photos: string[]; alt: string }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => setOpen(i)}
            aria-label={`Ver ${alt} foto ${i + 1} en tamaño completo`}
            className="block overflow-hidden rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500"
          >
            <Image
              src={url}
              alt={`${alt} foto ${i + 1}`}
              width={600}
              height={600}
              sizes="(max-width: 640px) 50vw, 33vw"
              priority={i === 0}
              className="aspect-square w-full cursor-zoom-in object-cover transition hover:opacity-90"
            />
          </button>
        ))}
      </div>

      {open !== null && (
        <Lightbox
          photos={photos}
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
  photos,
  alt,
  index,
  onIndex,
  onClose,
}: {
  photos: string[];
  alt: string;
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const prev = () => onIndex((index - 1 + photos.length) % photos.length);
  const next = () => onIndex((index + 1) % photos.length);

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
      aria-label={`${alt} — foto ${index + 1} de ${photos.length}`}
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
        className="relative h-[85vh] w-full max-w-5xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={photos[index]}
          alt={`${alt} foto ${index + 1}`}
          fill
          unoptimized
          sizes="100vw"
          className="object-contain"
        />
      </div>

      {photos.length > 1 && (
        <>
          <button
            aria-label="Foto anterior"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-3.5 py-2 text-xl text-white hover:bg-white/20"
          >
            ‹
          </button>
          <button
            aria-label="Foto siguiente"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-3.5 py-2 text-xl text-white hover:bg-white/20"
          >
            ›
          </button>
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm text-white">
            {index + 1} / {photos.length}
          </span>
        </>
      )}
    </div>
  );
}
