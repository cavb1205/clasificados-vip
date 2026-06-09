"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

/**
 * Panel para que la modelo difunda su perfil: link, copiar, compartir por
 * WhatsApp / X, y un QR descargable. Es el canal de tráfico #1 (trae a sus
 * propios clientes, que de paso descubren el resto del catálogo).
 */
export function SharePanel({ slug, stageName }: { slug: string; stageName: string }) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUrl(`${window.location.origin}/perfil/${slug}`);
  }, [slug]);

  const msg = `Mírame en PortalVip Chile ✨ ${url}`;
  const wa = `https://wa.me/?text=${encodeURIComponent(msg)}`;
  const x = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Mírame en PortalVip Chile ✨`)}&url=${encodeURIComponent(url)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  }

  function downloadQR() {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `portalvip-${slug}.png`;
    a.click();
  }

  return (
    <div className="rounded-xl border border-[#caa24a]/30 bg-[#e9c15c]/[0.04] p-4">
      <p className="text-sm text-neutral-300">
        Comparte tu link con tus clientes (WhatsApp, X, Instagram). Mientras más lo
        difundas, más visitas tienes — <strong>y tú decides a quién</strong>.
      </p>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <div ref={qrRef} className="shrink-0 self-center rounded-lg bg-white p-2">
          {url && <QRCodeCanvas value={url} size={120} includeMargin={false} />}
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={url}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs text-neutral-300"
            />
            <button onClick={copy} className="shrink-0 rounded-lg border border-neutral-700 px-3 py-2 text-xs hover:border-pink-500">
              {copied ? "✓" : "Copiar"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={wa} target="_blank" rel="noopener noreferrer" className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500">
              WhatsApp
            </a>
            <a href={x} target="_blank" rel="noopener noreferrer" className="rounded-full bg-neutral-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700">
              X (Twitter)
            </a>
            <button onClick={downloadQR} className="rounded-full border border-neutral-700 px-3 py-1.5 text-xs hover:border-pink-500">
              Descargar QR
            </button>
          </div>
          <p className="text-[11px] text-neutral-500">
            Tip: pon el QR en tus historias y el link en tu bio. El perfil muestra «{stageName}».
          </p>
        </div>
      </div>
    </div>
  );
}
