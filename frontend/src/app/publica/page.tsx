import type { Metadata } from "next";
import Link from "next/link";
import { RefCapture } from "@/components/RefCapture";

export const metadata: Metadata = {
  title: "Publica con nosotras — Primer mes gratis",
  description:
    "Publica tu perfil en PortalVip Chile: verificación de identidad, perfiles que generan confianza y mejores clientes. Primer mes gratis para las primeras.",
  alternates: { canonical: "/publica" },
};

const STEPS = [
  ["1", "Crea tu cuenta", "Email y contraseña. En minutos estás dentro."],
  ["2", "Verifica tu identidad", "Cédula, selfie y un video corto. Privado y cifrado."],
  ["3", "Sube tus fotos y datos", "Te guiamos paso a paso. Tus fotos llevan marca de agua anti-robo."],
  ["4", "Quedas visible", "Comparte tu link y QR con tus clientes; te ven también los del catálogo."],
];

const PERKS = [
  ["🎁", "Primer mes gratis", "Sin tarjeta. Pruébalo sin arriesgar nada."],
  ["✅", "Verificación real", "Tu perfil genera confianza → mejores clientes, menos perdedores de tiempo."],
  ["💸", "Precio justo", "Muy por debajo de los portales que cobran $50.000–$90.000. Desde $6.000/semana."],
  ["🛡️", "Anti-robo", "Marca de agua en fotos y videos; metadata/ubicación eliminada por tu seguridad."],
  ["🔗", "Tú traes a tus clientes", "Link y QR para compartir en WhatsApp, X e Instagram."],
  ["⭐", "Founding member", "Sé de las primeras y obtén beneficios de lanzamiento."],
];

export default async function PublicaPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const invited = Boolean((await searchParams)?.ref);
  return (
    <div className="space-y-12">
      <RefCapture />
      {invited && (
        <div className="rounded-xl border border-[#caa24a]/40 bg-[#e9c15c]/[0.06] px-4 py-3 text-center text-sm text-[#e9c15c]">
          🎁 <strong>Vienes con invitación de una modelo.</strong> Al registrarte y verificarte,
          tú y ella reciben <strong>un mes gratis extra</strong> — además de tu primer mes gratis.
        </div>
      )}
      <section className="text-center">
        <span className="inline-block rounded-full bg-[#e9c15c]/15 px-3 py-1 text-xs font-semibold text-[#e9c15c]">
          🎁 Lanzamiento · Primer mes gratis
        </span>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          Publica en <span className="text-gold">PortalVip</span> Chile
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg text-neutral-400">
          El portal de anuncios <strong className="text-neutral-200">verificados</strong>. Más
          confianza, mejores clientes y precio justo — sin las tarifas abusivas de la competencia.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/registro" className="btn-gold rounded-full px-6 py-3 font-medium">
            Crear mi cuenta gratis
          </Link>
          <Link href="/login" className="rounded-full border border-neutral-700 px-6 py-3 text-neutral-200 hover:border-pink-500">
            Ya tengo cuenta
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-5 text-center font-display text-2xl font-semibold">¿Por qué PortalVip?</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PERKS.map(([icon, title, desc]) => (
            <div key={title} className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
              <p className="text-2xl" aria-hidden>{icon}</p>
              <p className="mt-2 font-semibold text-neutral-100">{title}</p>
              <p className="mt-1 text-sm text-neutral-400">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-5 text-center font-display text-2xl font-semibold">En 4 pasos estás lista</h2>
        <ol className="mx-auto max-w-2xl space-y-3">
          {STEPS.map(([n, t, d]) => (
            <li key={n} className="flex gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pink-600/20 font-semibold text-pink-300">{n}</span>
              <span><strong className="text-neutral-100">{t}.</strong> <span className="text-neutral-400">{d}</span></span>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl border border-[#caa24a]/30 bg-[#e9c15c]/[0.04] p-8 text-center">
        <h2 className="font-display text-2xl font-semibold">Empieza hoy, gratis</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-neutral-400">
          Las primeras modelos verificadas tienen el <strong className="text-[#e9c15c]">primer mes gratis</strong> y
          posición destacada de lanzamiento. Riesgo cero.
        </p>
        <Link href="/registro" className="btn-gold mt-5 inline-block rounded-full px-6 py-3 font-medium">
          Crear mi cuenta
        </Link>
      </section>
    </div>
  );
}
