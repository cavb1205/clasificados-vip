"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, dashboard } from "@/lib/client-api";

interface Me {
  role?: string;
}

/** Formulario para que un cliente logueado deje una reseña (queda pendiente). */
export function ReviewForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null | undefined>(undefined); // undefined = cargando
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    auth.me().then((d) => setMe(d as Me)).catch(() => setMe(null));
  }, []);

  if (me === undefined) return null; // mientras carga, no parpadear

  if (done) {
    return (
      <div className="mt-4 rounded-xl border border-emerald-700/40 bg-emerald-950/30 p-4 text-sm text-emerald-200">
        ¡Gracias! Tu reseña fue enviada y se publicará una vez revisada.
      </div>
    );
  }

  // No logueado → invitar a iniciar sesión.
  if (me === null) {
    return (
      <button
        onClick={() => router.push(`/login?next=/perfil/${slug}`)}
        className="mt-4 rounded-full border border-neutral-700 px-5 py-2.5 text-sm text-neutral-300 hover:border-pink-500 hover:text-pink-300"
      >
        Inicia sesión para dejar una reseña
      </button>
    );
  }

  // Solo los clientes reseñan (no modelos/anfitriones/admin).
  if (me.role !== "client") return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      setErr("Elige una calificación (1 a 5 estrellas).");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await dashboard.createReview({ profile_slug: slug, rating, comment: comment.trim() });
      setDone(true);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "No se pudo enviar la reseña.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <p className="text-sm font-medium">Deja tu reseña</p>
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Calificación">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            aria-label={`${n} estrella${n > 1 ? "s" : ""}`}
            aria-pressed={rating === n}
            className={`text-2xl leading-none transition ${
              n <= (hover || rating) ? "text-amber-400" : "text-neutral-600 hover:text-amber-300"
            }`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        maxLength={500}
        placeholder="Cuéntanos tu experiencia (opcional)"
        className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
      />
      {err && <p className="text-sm text-red-400">{err}</p>}
      <button
        disabled={busy}
        className="rounded-full bg-pink-600 px-5 py-2 text-sm font-medium hover:bg-pink-500 disabled:opacity-50"
      >
        {busy ? "Enviando…" : "Enviar reseña"}
      </button>
      <p className="text-xs text-neutral-500">Tu reseña se publica tras ser revisada por moderación.</p>
    </form>
  );
}
