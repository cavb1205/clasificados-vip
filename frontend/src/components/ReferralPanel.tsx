"use client";

import { useEffect, useState } from "react";

/**
 * Programa de referidos: la modelo invita a otras con su link. Cuando la
 * invitada se verifica, ambas reciben un mes gratis. La oferta crece sola.
 */
export function ReferralPanel({ code, count }: { code: string; count: number }) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(`${window.location.origin}/publica?ref=${code}`);
  }, [code]);

  const msg = `Te invito a PortalVip Chile (anuncios verificados). Si entras con mi link, tenemos un mes gratis las dos 🎁 ${url}`;
  const wa = `https://wa.me/?text=${encodeURIComponent(msg)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  }

  return (
    <div className="rounded-xl border border-[#caa24a]/30 bg-[#e9c15c]/[0.04] p-4">
      <p className="text-sm text-neutral-200">
        Por cada modelo que invites y se verifique, <strong className="text-[#e9c15c]">tú y ella
        ganan 1 mes gratis</strong> (30 días). <strong>Sin límite</strong>: invitas a 3 amigas =
        3 meses gratis, y se suman a lo que ya tengas.
      </p>

      <ol className="mt-3 space-y-1.5 text-xs text-neutral-400">
        <li><strong className="text-neutral-200">1.</strong> Le pasas tu link (abajo) por WhatsApp o se lo muestras.</li>
        <li><strong className="text-neutral-200">2.</strong> Ella se registra y verifica su identidad.</li>
        <li><strong className="text-neutral-200">3.</strong> Apenas se aprueba, <strong className="text-[#e9c15c]">las dos reciben su mes gratis</strong> y te avisamos.</li>
      </ol>

      <div className="mt-3 flex items-center gap-2">
        <input
          readOnly
          value={url}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs text-neutral-300"
        />
        <button onClick={copy} className="shrink-0 rounded-lg border border-neutral-700 px-3 py-2 text-xs hover:border-pink-500">
          {copied ? "✓" : "Copiar"}
        </button>
        <a href={wa} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-500">
          WhatsApp
        </a>
      </div>

      <p className="mt-3 rounded-lg bg-neutral-900 px-3 py-2 text-xs text-neutral-400">
        {count > 0 ? (
          <>
            🎉 Has invitado a <strong className="text-neutral-200">{count}</strong> modelo
            {count === 1 ? "" : "s"} verificada{count === 1 ? "" : "s"} ·{" "}
            <strong className="text-[#e9c15c]">{count * 30} días gratis ganados</strong>.
          </>
        ) : (
          <>Aún no has invitado a nadie. ¡Empieza con tus amigas del rubro!</>
        )}
      </p>
    </div>
  );
}
