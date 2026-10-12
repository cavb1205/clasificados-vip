/** Solo permite el canal esperado: nunca redirige soporte a un dominio arbitrario. */
export function telegramSupportLink(raw: string): string | null {
  const handle = raw.trim().replace(/^https?:\/\/(?:www\.)?t\.me\//i, "").replace(/^t\.me\//i, "").replace(/^@/, "");
  return /^[A-Za-z0-9_]{3,40}$/.test(handle) ? `https://t.me/${handle}` : null;
}
