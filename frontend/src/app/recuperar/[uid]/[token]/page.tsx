"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/client-api";

export default function ResetPasswordPage() {
  const params = useParams<{ uid: string; token: string }>();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (password.length < 8) {
      setErr("Mínimo 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setErr("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/auth/reset-password/", {
        method: "POST",
        body: { uid: params.uid, token: params.token, password },
      });
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (caught) {
      setErr(caught instanceof Error ? caught.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-sm rounded-xl border border-emerald-700/50 bg-emerald-950/30 p-6 text-center">
        <p className="font-semibold text-emerald-200">✅ Contraseña actualizada</p>
        <p className="mt-1 text-sm text-emerald-300/80">
          Te redirigimos al login…
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-sm space-y-4">
      <h1 className="text-2xl font-bold">Nueva contraseña</h1>
      <p className="text-sm text-neutral-400">
        Crea una contraseña segura (mínimo 8 caracteres).
      </p>
      <input
        type="password"
        required
        placeholder="Nueva contraseña"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-base"
      />
      <input
        type="password"
        required
        placeholder="Repetir contraseña"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-base"
      />
      {err && <p className="text-sm text-red-400">{err}</p>}
      <button
        disabled={busy}
        className="w-full rounded-full bg-pink-600 py-2.5 font-medium hover:bg-pink-500 disabled:opacity-50"
      >
        {busy ? "Guardando…" : "Guardar contraseña"}
      </button>
      <Link
        href="/login"
        className="block text-center text-xs text-neutral-500 hover:text-pink-400"
      >
        ← Volver al login
      </Link>
    </form>
  );
}
