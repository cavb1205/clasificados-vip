"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/client-api";
import { RefCapture } from "@/components/RefCapture";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", username: "", password: "", role: "model" });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
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
      await auth.register({
        ...form,
        terms_accepted: termsAccepted,
        privacy_accepted: privacyAccepted,
      });
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
      <label htmlFor="register-username" className="sr-only">Nombre de usuario</label>
      <input
        id="register-username"
        name="username"
        required
        placeholder="Nombre de usuario"
        autoComplete="username"
        value={form.username}
        onChange={(e) => update("username", e.target.value)}
        className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2"
      />
      <label htmlFor="register-email" className="sr-only">Correo electrónico</label>
      <input
        id="register-email"
        name="email"
        type="email"
        required
        placeholder="Correo"
        autoComplete="email"
        value={form.email}
        onChange={(e) => update("email", e.target.value)}
        className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2"
      />
      <label htmlFor="register-password" className="sr-only">Contraseña</label>
      <input
        id="register-password"
        name="password"
        type="password"
        required
        placeholder="Contraseña"
        autoComplete="new-password"
        value={form.password}
        onChange={(e) => update("password", e.target.value)}
        className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2"
      />
      <label htmlFor="register-role" className="sr-only">Tipo de cuenta</label>
      <select
        id="register-role"
        name="role"
        value={form.role}
        onChange={(e) => update("role", e.target.value)}
        className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2"
      >
        <option value="model">Soy modelo (quiero publicar)</option>
        <option value="host">Soy anfitrión (arriendo habitaciones)</option>
        <option value="client">Soy cliente</option>
      </select>
      <label htmlFor="accept-terms" className="flex items-start gap-2 text-sm text-neutral-300">
        <input
          id="accept-terms"
          name="terms_accepted"
          type="checkbox"
          required
          checked={termsAccepted}
          onChange={(e) => setTermsAccepted(e.target.checked)}
          className="mt-1 accent-pink-500"
        />
        <span>
          He leído y acepto los <a href="/terminos" target="_blank" rel="noreferrer" className="text-pink-300 underline">Términos y condiciones</a>.
        </span>
      </label>
      <label htmlFor="accept-privacy" className="flex items-start gap-2 text-sm text-neutral-300">
        <input
          id="accept-privacy"
          name="privacy_accepted"
          type="checkbox"
          required
          checked={privacyAccepted}
          onChange={(e) => setPrivacyAccepted(e.target.checked)}
          className="mt-1 accent-pink-500"
        />
        <span>
          Confirmo que leí la <a href="/privacidad" target="_blank" rel="noreferrer" className="text-pink-300 underline">Política de privacidad</a>. Las autorizaciones específicas, como la verificación de identidad, se solicitan por separado.
        </span>
      </label>
      {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full btn-gold py-2 font-medium disabled:opacity-50"
      >
        {loading ? "Creando…" : "Crear cuenta"}
      </button>
    </form>
  );
}
