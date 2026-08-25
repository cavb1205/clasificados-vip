"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const KEY = "age_verified";

/** Verificación 18+ obligatoria. Bloquea el contenido hasta que se confirme. */
export function AgeGate() {
  const [confirmed, setConfirmed] = useState<boolean | null>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setConfirmed(localStorage.getItem(KEY) === "1");
    } catch {
      setConfirmed(false);
    }
  }, []);

  useEffect(() => {
    if (confirmed !== false) return;
    firstActionRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") event.preventDefault();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>("button, a[href]")
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmed]);

  if (confirmed === true) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6" role="presentation">
      <div
        ref={dialogRef}
        className="max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-8 text-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="age-gate-title"
        aria-busy={confirmed === null}
      >
        <h2 id="age-gate-title" className="text-xl font-semibold">Contenido para mayores de 18 años</h2>
        <p className="mt-3 text-sm text-neutral-400">
          Este sitio contiene anuncios para adultos. Al ingresar declaras ser mayor de edad
          y aceptar los <Link href="/terminos" className="text-pink-300 underline">términos de uso</Link>.
        </p>
        {confirmed === null ? (
          <p className="mt-6 text-sm text-neutral-500" role="status">Comprobando la confirmación de edad…</p>
        ) : (
          <div className="mt-6 flex flex-wrap gap-3">
          <button
            ref={firstActionRef}
            type="button"
            onClick={() => {
              try {
                localStorage.setItem(KEY, "1");
              } catch {
                // La sesión puede continuar aunque el navegador bloquee storage.
              }
              setConfirmed(true);
            }}
            className="min-w-40 flex-1 rounded-full btn-gold px-4 py-2 font-medium"
          >
            Soy mayor de 18
          </button>
          <a
            href="https://www.google.com"
            rel="nofollow noopener noreferrer"
            className="min-w-40 flex-1 rounded-full border border-neutral-700 px-4 py-2 text-neutral-300"
          >
            Salir
          </a>
          </div>
        )}
      </div>
    </div>
  );
}
