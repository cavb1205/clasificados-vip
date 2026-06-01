"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  ensureLoaded,
  isAuthed,
  isFavorited,
  subscribe,
  toggleFavorite,
} from "@/lib/favorites-store";

/** Corazón flotante para guardar/quitar un perfil de favoritos desde una tarjeta. */
export function FavoriteHeart({ slug, className = "" }: { slug: string; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const fav = useSyncExternalStore(
    subscribe,
    () => isFavorited(slug),
    () => false, // snapshot en el servidor (SSR): nunca favorito
  );

  useEffect(() => {
    ensureLoaded();
  }, []);

  async function onClick(e: React.MouseEvent) {
    // La tarjeta es un <Link>; evitamos navegar al togglear el corazón.
    e.preventDefault();
    e.stopPropagation();
    if (isAuthed() === false) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setBusy(true);
    try {
      await toggleFavorite(slug);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={fav}
      aria-label={fav ? "Quitar de favoritos" : "Agregar a favoritos"}
      className={`rounded-full bg-black/55 px-2 py-1 text-base leading-none backdrop-blur transition hover:bg-black/75 disabled:opacity-50 ${
        fav ? "text-pink-400" : "text-white"
      } ${className}`}
    >
      {fav ? "♥" : "♡"}
    </button>
  );
}
