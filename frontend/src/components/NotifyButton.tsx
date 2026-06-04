"use client";

import { useState } from "react";
import { dashboard } from "@/lib/client-api";

/**
 * Botón "Avisar": envía una notificación in-app a un usuario desde el panel.
 * Pensado para moderación blanda (pedir corregir una foto, recordar una regla)
 * sin suspender la cuenta. El aviso aparece en la campana del usuario.
 */
export function NotifyButton({
  userId,
  name,
  onError,
}: {
  userId: number;
  name?: string;
  onError?: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function send() {
    const message = window.prompt(
      `Aviso para ${name ?? "este usuario"} (le llega a su campana):`,
    );
    if (message === null) return;
    if (!message.trim()) return;
    setBusy(true);
    try {
      await dashboard.adminUserNotify(userId, message.trim());
      setSent(true);
      setTimeout(() => setSent(false), 2500);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "No se pudo enviar el aviso");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={send}
      title="Enviar un aviso a su campana"
      className="rounded-full border border-sky-700 px-3 py-1.5 text-xs text-sky-300 hover:bg-sky-950/30 disabled:opacity-50"
    >
      {sent ? "✓ Enviado" : "Avisar"}
    </button>
  );
}
