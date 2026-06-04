"use client";

import { useEffect, useState } from "react";

const KEY = "age_verified";

/** Verificación 18+ obligatoria. Bloquea el contenido hasta que se confirme. */
export function AgeGate() {
  const [confirmed, setConfirmed] = useState(true);

  useEffect(() => {
    setConfirmed(localStorage.getItem(KEY) === "1");
  }, []);

  if (confirmed) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6">
      <div className="max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-8 text-center">
        <h2 className="text-xl font-semibold">Contenido para mayores de 18 años</h2>
        <p className="mt-3 text-sm text-neutral-400">
          Este sitio contiene anuncios para adultos. Al ingresar declaras ser mayor de edad
          y aceptar los términos de uso.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => {
              localStorage.setItem(KEY, "1");
              setConfirmed(true);
            }}
            className="flex-1 rounded-full btn-gold px-4 py-2 font-medium"
          >
            Soy mayor de 18
          </button>
          <a
            href="https://www.google.com"
            className="flex-1 rounded-full border border-neutral-700 px-4 py-2 text-neutral-300"
          >
            Salir
          </a>
        </div>
      </div>
    </div>
  );
}
