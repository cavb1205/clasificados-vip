"use client";

// Error boundary del App Router (debe ser client component). Captura errores
// de renderizado del segmento y ofrece reintentar.
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // En el futuro: enviar a un servicio de errores. Por ahora, consola.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="font-display text-2xl font-semibold">Algo salió mal</h1>
      <p className="mt-2 text-sm text-neutral-400">
        Ocurrió un error al cargar esta sección. Puedes reintentar.
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-full bg-pink-600 px-5 py-2 text-sm font-medium hover:bg-pink-500"
      >
        Reintentar
      </button>
    </div>
  );
}
