"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, dashboard, type MyReview } from "@/lib/client-api";

interface Me {
  email?: string;
  username?: string;
  role?: string;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendiente de moderación", cls: "bg-amber-600/20 text-amber-300" },
  approved: { label: "Publicada", cls: "bg-emerald-600/20 text-emerald-300" },
  rejected: { label: "Rechazada", cls: "bg-red-600/20 text-red-300" },
};

const ROLE_LABEL: Record<string, string> = {
  client: "Cliente",
  model: "Modelo",
  host: "Anfitrión",
  moderator: "Moderador",
  admin: "Administrador",
};

export default function AccountPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [reviews, setReviews] = useState<MyReview[]>([]);

  useEffect(() => {
    auth
      .me()
      .then((m) => {
        setMe(m as Me);
        return dashboard.myReviews().catch(() => [] as MyReview[]);
      })
      .then((r) => {
        setReviews(r as MyReview[]);
        setReady(true);
      })
      .catch(() => router.replace("/login?next=/cuenta"));
  }, [router]);

  if (!ready) return <p className="text-neutral-400">Cargando…</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Mi cuenta</h1>
      </header>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-sm">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <dt className="text-neutral-500">Correo</dt>
          <dd>{me?.email}</dd>
          <dt className="text-neutral-500">Usuario</dt>
          <dd>{me?.username}</dd>
          <dt className="text-neutral-500">Tipo de cuenta</dt>
          <dd>{ROLE_LABEL[me?.role ?? ""] ?? me?.role}</dd>
        </dl>
      </section>

      <ChangePasswordForm />

      {me?.role === "client" && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Mis reseñas</h2>
          {reviews.length === 0 ? (
            <p className="text-sm text-neutral-500">Aún no dejaste reseñas.</p>
          ) : (
            <ul className="space-y-2">
              {reviews.map((r) => {
                const st = STATUS[r.status] ?? STATUS.pending;
                return (
                  <li key={r.id} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">
                        <Link href={`/perfil/${r.profile_slug}`} className="hover:text-pink-300">
                          {r.stage_name}
                        </Link>{" "}
                        <span className="text-amber-400">{"★".repeat(r.rating)}</span>
                      </p>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs ${st.cls}`}>{st.label}</span>
                    </div>
                    {r.comment && <p className="mt-1 text-sm text-neutral-400">{r.comment}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function ChangePasswordForm() {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setErr("");
    if (next.length < 8) {
      setErr("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (next !== confirm) {
      setErr("Las contraseñas nuevas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      await dashboard.changePassword({ current_password: cur, new_password: next });
      setMsg("Contraseña actualizada.");
      setCur("");
      setNext("");
      setConfirm("");
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "No se pudo cambiar la contraseña.");
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm";

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <h2 className="mb-3 text-lg font-semibold">Cambiar contraseña</h2>
      <form onSubmit={submit} className="space-y-3">
        <input type="password" placeholder="Contraseña actual" autoComplete="current-password"
          className={inputCls} value={cur} onChange={(e) => setCur(e.target.value)} required />
        <input type="password" placeholder="Nueva contraseña" autoComplete="new-password"
          className={inputCls} value={next} onChange={(e) => setNext(e.target.value)} required />
        <input type="password" placeholder="Repetir nueva contraseña" autoComplete="new-password"
          className={inputCls} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        {err && <p className="text-sm text-red-400">{err}</p>}
        {msg && <p className="text-sm text-emerald-400">{msg}</p>}
        <button disabled={busy}
          className="rounded-full bg-pink-600 px-5 py-2 text-sm font-medium hover:bg-pink-500 disabled:opacity-50">
          {busy ? "Guardando…" : "Actualizar contraseña"}
        </button>
      </form>
    </section>
  );
}
