"use client";

import { useEffect } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

/** Registra una visita por sesión (dedup con sessionStorage) y olvídate. */
export function ProfileTracker({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `viewed_${slug}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    fetch(`${API}/profiles/${slug}/events/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "view" }),
      // Sin credentials para esquivar CSRF y mantenerlo anónimo.
      credentials: "omit",
      keepalive: true,
    }).catch(() => {});
  }, [slug]);
  return null;
}

/** Helper para registrar un click de contacto desde el ContactPanel. */
export function logContactClick(slug: string) {
  fetch(`${API}/profiles/${slug}/events/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "contact" }),
    credentials: "omit",
    keepalive: true,
  }).catch(() => {});
}
