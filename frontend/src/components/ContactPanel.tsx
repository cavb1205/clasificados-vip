"use client";

import { useState } from "react";
import { logContactClick } from "./ProfileTracker";
import { publicProfiles } from "@/lib/client-api";

interface Props {
  slug: string;
  stageName: string;
  hasContact: boolean;
}

/**
 * Botón "Contactar" que oculta los canales hasta el click.
 * Frena scraping casual y refuerza el call-to-action principal del perfil.
 */
export function ContactPanel({ slug, stageName, hasContact }: Props) {
  const [contacts, setContacts] = useState<{ whatsapp: string; telegram: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  if (!hasContact) return null;

  async function reveal() {
    setLoading(true);
    setError("");
    logContactClick(slug);
    try {
      const data = await publicProfiles.revealContact(slug);
      if (!data.whatsapp && !data.telegram) {
        setError("Este perfil ya no tiene canales de contacto disponibles.");
        return;
      }
      setContacts(data);
    } catch {
      setError("No se pudieron cargar los canales de contacto. Inténtalo nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  const whatsapp = contacts?.whatsapp ?? "";
  const telegram = contacts?.telegram ?? "";

  const greeting = encodeURIComponent(`Hola ${stageName}, te vi en PortalVip Chile.`);
  // El número de WhatsApp viene en formato internacional sin "+" (ej. 56912345678).
  // Reusamos el mismo dígito para la llamada y para la deep-link de WhatsApp.
  const phone = whatsapp;
  const telUrl = phone ? `tel:+${phone}` : null;
  const waUrl = whatsapp ? `https://wa.me/${whatsapp}?text=${greeting}` : null;
  const tgUrl = telegram ? `https://t.me/${telegram}` : null;

  if (!contacts) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={reveal}
          disabled={loading}
          aria-busy={loading}
          className="w-full rounded-2xl btn-gold px-5 py-4 text-base font-semibold disabled:opacity-60"
        >
          {loading ? "Cargando contacto…" : `Contactar a ${stageName}`}
        </button>
        {error && (
          <p className="text-center text-xs text-red-300" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {telUrl && (
        // En móvil abre el marcador del teléfono. En desktop algunos navegadores
        // proponen FaceTime/Skype/etc. — para no contradecir esa UX igual lo
        // dejamos visible siempre pero etiquetado como "Llamar".
        <a
          href={telUrl}
          rel="nofollow noopener"
          className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-500"
        >
          <span aria-hidden>📞</span> Llamar · +{phone}
        </a>
      )}
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
        El acuerdo es directo con la modelo. PortalVip Chile no intermedia ni cobra
        por transacciones.
      </p>
    </div>
  );
}
