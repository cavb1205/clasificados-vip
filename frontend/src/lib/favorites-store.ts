"use client";

// Store ligero de favoritos compartido por todos los corazones (♥) del listado.
// Carga la lista del usuario UNA sola vez y notifica a los suscriptores; así
// N tarjetas no hacen N fetches. Pensado para usarse con useSyncExternalStore.
import { ApiRequestError, dashboard } from "./client-api";

let slugs: Set<string> | null = null; // null = aún no cargado
let authed: boolean | null = null; // null = desconocido, false = sin sesión
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
let generation = 0;

function invalidate() {
  generation += 1;
  slugs = null;
  authed = null;
  loading = null;
  emit();
}

function onAuthChanged() {
  invalidate();
  void ensureLoaded();
}

function onAuthExpired() {
  invalidate();
  slugs = new Set();
  authed = false;
  emit();
}

function emit() {
  listeners.forEach((l) => l());
}

export function subscribe(cb: () => void): () => void {
  if (listeners.size === 0) {
    window.addEventListener("auth-changed", onAuthChanged);
    window.addEventListener("auth-expired", onAuthExpired);
  }
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) {
      window.removeEventListener("auth-changed", onAuthChanged);
      window.removeEventListener("auth-expired", onAuthExpired);
      // La sesión puede cambiar en otra ruta sin corazones montados.
      // Nunca reutilizar favoritos de una cuenta anterior al remontar.
      invalidate();
    }
  };
}

/** Carga los favoritos del usuario una vez (idempotente). */
export function ensureLoaded(): Promise<void> {
  if (slugs !== null) return Promise.resolve();
  if (loading) return loading;
  const startedAt = generation;
  loading = dashboard
    .myFavorites()
    .then((list) => {
      if (generation !== startedAt) return;
      slugs = new Set((list as { slug: string }[]).map((p) => p.slug));
      authed = true;
    })
    .catch((error: unknown) => {
      if (generation !== startedAt) return;
      if (error instanceof ApiRequestError && error.status === 401) {
        slugs = new Set();
        authed = false;
      }
    })
    .finally(() => {
      if (generation !== startedAt) return;
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
  await ensureLoaded();
  const startedAt = generation;
  const r = await dashboard.favoriteToggle(slug);
  if (startedAt !== generation) return r.favorited;
  if (!slugs) slugs = new Set();
  if (slugs) {
    if (r.favorited) slugs.add(slug);
    else slugs.delete(slug);
  }
  emit();
  return r.favorited;
}

/** Solo para tests: reinicia el estado del módulo. */
export function __resetFavorites() {
  window.removeEventListener("auth-changed", onAuthChanged);
  window.removeEventListener("auth-expired", onAuthExpired);
  generation += 1;
  slugs = null;
  authed = null;
  loading = null;
  listeners.clear();
}
