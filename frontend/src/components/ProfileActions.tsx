"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { dashboard } from "@/lib/client-api";

/** Botones de favorito (♥) y reportar para la página de un perfil. */
export function ProfileActions({ slug }: { slug: string }) {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [fav, setFav] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reportMsg, setReportMsg] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let alive = true;
    // Carga favoritos del usuario; si no hay sesión, queda como no autenticado.
    dashboard
      .myFavorites()
      .then((list) => {
        if (!alive) return;
        setAuthed(true);
        setFav((list as { slug: string }[]).some((p) => p.slug === slug));
      })
      .catch(() => alive && setAuthed(false));
    return () => {
      alive = false;
    };
  }, [slug]);

  async function toggleFav() {
    if (authed === false) {
      router.push(`/login?next=/perfil/${slug}`);
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      const r = await dashboard.favoriteToggle(slug);
      setFav(r.favorited);
    } catch {
      setActionError("No se pudo actualizar favoritos.");
    } finally {
      setBusy(false);
    }
  }

  async function report() {
    const reason = window.prompt("¿Por qué reportas este perfil? (opcional)");
    if (reason === null) return;
    try {
      await dashboard.reportProfile(slug, reason);
      setReportMsg("Gracias, recibimos tu reporte.");
      setActionError("");
    } catch {
      setActionError("No se pudo enviar el reporte.");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggleFav}
        disabled={busy}
        aria-pressed={fav}
        aria-label={fav ? "Quitar de favoritos" : "Agregar a favoritos"}
        className={`rounded-full border px-4 py-2 text-sm transition disabled:opacity-50 ${
          fav
            ? "border-pink-500 bg-pink-600/20 text-pink-300"
            : "border-neutral-700 text-neutral-300 hover:border-pink-500"
        }`}
      >
        {fav ? "♥ Guardado" : "♡ Guardar"}
      </button>
      {actionError && <span role="alert" className="text-xs text-red-400">{actionError}</span>}
      {reportMsg ? (
        <span className="text-xs text-emerald-400">{reportMsg}</span>
      ) : (
        <button
          type="button"
          onClick={report}
          className="rounded-full border border-neutral-800 px-3 py-2 text-xs text-neutral-500 hover:border-red-500 hover:text-red-400"
        >
          Reportar
        </button>
      )}
    </div>
  );
}
