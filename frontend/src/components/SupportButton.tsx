"use client";

import { useEffect, useState } from "react";
import { auth, dashboard } from "@/lib/client-api";

/** Normaliza lo que el admin escriba (@user, user, o t.me/user) a un enlace. */
function telegramLink(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (v.startsWith("http")) return v;
  const handle = v.replace(/^@/, "").replace(/^t\.me\//i, "").replace(/^https?:\/\//, "");
  return handle ? `https://t.me/${handle}` : null;
}

/**
 * Botón flotante de soporte por Telegram. Solo se muestra a modelos y
 * anfitriones (no a clientes ni anónimos) y solo si el admin configuró el canal.
 */
const ROLE_LABEL: Record<string, string> = { model: "modelo", host: "anfitrión" };

export function SupportButton() {
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    auth
      .me()
      .then((me) => {
        const u = me as { role?: string; username?: string; email?: string } | null;
        const role = u?.role;
        if (role !== "model" && role !== "host") return;
        return dashboard.supportInfo().then((d) => {
          const link = telegramLink(d.support_telegram);
          if (!alive || !link) return;
          // Mensaje prellenado para que el soporte identifique de inmediato a quién
          // atiende (usuario + correo + rol).
          const text =
            `Hola soporte 👋 Soy ${u?.username ?? ""}` +
            (u?.email ? ` (${u.email})` : "") +
            ` — ${ROLE_LABEL[role] ?? role} en PortalVip.\nMi consulta: `;
          const sep = link.includes("?") ? "&" : "?";
          setHref(`${link}${sep}text=${encodeURIComponent(text)}`);
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title="Soporte por Telegram"
      className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full border border-sky-500/50 bg-sky-600/90 px-4 py-3 text-sm font-medium text-white shadow-lg backdrop-blur transition hover:-translate-y-0.5 hover:bg-sky-500"
    >
      <span aria-hidden className="text-lg leading-none">✈️</span>
      <span className="hidden sm:inline">Soporte</span>
    </a>
  );
}
