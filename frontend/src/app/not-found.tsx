import Link from "next/link";

// UI 404 del App Router. Se muestra al llamar notFound() o en rutas inexistentes.
export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="font-display text-5xl font-semibold text-pink-500">404</p>
      <h1 className="mt-3 font-display text-2xl font-semibold">Página no encontrada</h1>
      <p className="mt-2 text-sm text-neutral-400">
        El enlace que seguiste no existe o el contenido fue retirado.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-full bg-pink-600 px-5 py-2 text-sm font-medium hover:bg-pink-500"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
