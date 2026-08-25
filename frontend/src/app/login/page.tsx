"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, panelHrefFor } from "@/lib/client-api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      // LoginView devuelve UserSerializer.data (role + is_staff).
      const me = (await auth.login(email, password)) as { role?: string; is_staff?: boolean };
      router.push(panelHrefFor(me));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al ingresar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-sm space-y-4">
      <h1 className="text-2xl font-bold">Ingresar</h1>
      <label htmlFor="login-email" className="sr-only">Correo electrónico</label>
      <input
        id="login-email"
        name="email"
        type="email"
        required
        placeholder="Correo"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2"
      />
      <label htmlFor="login-password" className="sr-only">Contraseña</label>
      <input
        id="login-password"
        name="password"
        type="password"
        required
        placeholder="Contraseña"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2"
      />
      {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full btn-gold py-2 font-medium disabled:opacity-50"
      >
        {loading ? "Ingresando…" : "Ingresar"}
      </button>
      <Link
        href="/recuperar"
        className="block text-center text-sm text-neutral-400 hover:text-pink-400"
      >
        ¿Olvidaste tu contraseña?
      </Link>
    </form>
  );
}
