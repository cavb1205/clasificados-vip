"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/client-api";
import { RefCapture } from "@/components/RefCapture";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", username: "", password: "", role: "model" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await auth.register(form);
      await auth.login(form.email, form.password);
      // Las modelos nuevas entran al asistente guiado paso a paso.
      router.push(
        form.role === "host" ? "/anfitrion" : form.role === "client" ? "/" : "/dashboard/inicio",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrarse");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-sm space-y-4">
      <RefCapture />
      <h1 className="text-2xl font-bold">Crear cuenta</h1>
      <input
        required
        placeholder="Nombre de usuario"
        value={form.username}
        onChange={(e) => update("username", e.target.value)}
        className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2"
      />
      <input
        type="email"
        required
        placeholder="Correo"
        value={form.email}
        onChange={(e) => update("email", e.target.value)}
        className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2"
      />
      <input
        type="password"
        required
        placeholder="Contraseña"
        value={form.password}
        onChange={(e) => update("password", e.target.value)}
        className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2"
      />
      <select
        value={form.role}
        onChange={(e) => update("role", e.target.value)}
        className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2"
      >
        <option value="model">Soy modelo (quiero publicar)</option>
        <option value="host">Soy anfitrión (arriendo habitaciones)</option>
        <option value="client">Soy cliente</option>
      </select>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        disabled={loading}
        className="w-full rounded-full btn-gold py-2 font-medium disabled:opacity-50"
      >
        {loading ? "Creando…" : "Crear cuenta"}
      </button>
    </form>
  );
}
