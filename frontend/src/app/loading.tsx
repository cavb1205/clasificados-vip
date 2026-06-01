// UI de carga (Suspense boundary del App Router). Se muestra durante la
// navegación SSR mientras la página se resuelve en el servidor.
export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label="Cargando">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-neutral-800" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="aspect-square w-full animate-pulse rounded-xl bg-neutral-800" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-800" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-900" />
          </div>
        ))}
      </div>
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
