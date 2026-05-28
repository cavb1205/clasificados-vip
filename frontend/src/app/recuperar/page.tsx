"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client-api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await apiFetch("/auth/forgot-password/", {
        method: "POST",
        body: { email },
      });
      setDone(true);
    } catch (caught) {
      setErr(caught instanceof Error ? caught.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-sm space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h1 className="text-xl font-bold">Revisa tu correo</h1>
        <p className="text-sm text-neutral-400">
          Si <strong>{email}</strong> está registrado, te enviamos un link para crear una
          nueva contraseña. El link es válido por unas horas.
        </p>
        <p className="text-xs text-neutral-500">
          ¿No llegó? Revisa tu carpeta de spam o vuelve a intentarlo.
        </p>
        <Link
          href="/login"
          className="block text-center text-sm text-pink-400 hover:underline"
        >
          ← Volver al login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-sm space-y-4">
      <h1 className="text-2xl font-bold">Recuperar contraseña</h1>
      <p className="text-sm text-neutral-400">
        Ingresa el correo de tu cuenta y te enviaremos un link para crear una nueva
        contraseña.
      </p>
      <input
        type="email"
        required
        placeholder="Correo"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-base"
      />
      {err && <p className="text-sm text-red-400">{err}</p>}
      <button
        disabled={busy}
        className="w-full rounded-full bg-pink-600 py-2.5 font-medium hover:bg-pink-500 disabled:opacity-50"
      >
        {busy ? "Enviando…" : "Enviar link"}
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
