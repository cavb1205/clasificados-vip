"use client";

// Store ligero de favoritos compartido por todos los corazones (♥) del listado.
// Carga la lista del usuario UNA sola vez y notifica a los suscriptores; así
// N tarjetas no hacen N fetches. Pensado para usarse con useSyncExternalStore.
import { dashboard } from "./client-api";

let slugs: Set<string> | null = null; // null = aún no cargado
let authed: boolean | null = null; // null = desconocido, false = sin sesión
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Carga los favoritos del usuario una vez (idempotente). */
export function ensureLoaded(): Promise<void> {
  if (slugs !== null) return Promise.resolve();
  if (loading) return loading;
  loading = dashboard
    .myFavorites()
    .then((list) => {
      slugs = new Set((list as { slug: string }[]).map((p) => p.slug));
      authed = true;
    })
    .catch(() => {
      slugs = new Set();
      authed = false;
    })
    .finally(() => {
      loading = null;
      emit();
    });
  return loading;
}

export function isFavorited(slug: string): boolean {
  return slugs?.has(slug) ?? false;
}

export function isAuthed(): boolean | null {
  return authed;
}

/** Alterna el favorito en el backend y actualiza el store local. */
export async function toggleFavorite(slug: string): Promise<boolean> {
  const r = await dashboard.favoriteToggle(slug);
  if (slugs) {
    if (r.favorited) slugs.add(slug);
    else slugs.delete(slug);
  }
  emit();
  return r.favorited;
}

/** Solo para tests: reinicia el estado del módulo. */
export function __resetFavorites() {
  slugs = null;
  authed = null;
  loading = null;
  listeners.clear();
}
