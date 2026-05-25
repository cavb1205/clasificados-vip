"use client";

import { useState } from "react";
import { logContactClick } from "./ProfileTracker";

interface Props {
  slug: string;
  stageName: string;
  whatsapp: string;
  telegram: string;
}

/**
 * Botón "Contactar" que oculta los canales hasta el click.
 * Frena scraping casual y refuerza el call-to-action principal del perfil.
 */
export function ContactPanel({ slug, stageName, whatsapp, telegram }: Props) {
  const [revealed, setRevealed] = useState(false);
  const hasAny = Boolean(whatsapp) || Boolean(telegram);
  if (!hasAny) return null;

  const greeting = encodeURIComponent(`Hola ${stageName}, te vi en Clasificados VIP.`);
  const waUrl = whatsapp ? `https://wa.me/${whatsapp}?text=${greeting}` : null;
  const tgUrl = telegram ? `https://t.me/${telegram}` : null;

  if (!revealed) {
    return (
      <button
        onClick={() => {
          logContactClick(slug);
          setRevealed(true);
        }}
        className="w-full rounded-2xl bg-pink-600 px-5 py-4 text-base font-semibold text-white shadow-lg shadow-pink-600/20 hover:bg-pink-500"
      >
        Contactar a {stageName}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      {waUrl && (
        <a
          href={waUrl}
          target="_blank"
          rel="nofollow noopener"
          className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-medium text-white hover:bg-emerald-500"
        >
          <span aria-hidden>💬</span> WhatsApp · +{whatsapp}
        </a>
      )}
      {tgUrl && (
        <a
          href={tgUrl}
          target="_blank"
          rel="nofollow noopener"
          className="flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 font-medium text-white hover:bg-sky-500"
        >
          <span aria-hidden>✈</span> Telegram · @{telegram}
        </a>
      )}
      <p className="text-center text-xs text-neutral-500">
        El acuerdo es directo con la modelo. Clasificados VIP no intermedia ni cobra
        por transacciones.
      </p>
    </div>
  );
}
