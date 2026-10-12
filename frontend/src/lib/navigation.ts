/** Permite volver al recurso solicitado sin permitir redirecciones externas. */
export function safeReturnPath(value: string | null): string | null {
  if (!value?.startsWith("/") || value.startsWith("//")) return null;
  try {
    const base = "https://portalvip.invalid";
    const url = new URL(value, base);
    if (url.origin !== base || /^\/(login|registro)(\/|$)/.test(url.pathname)) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/** Normaliza parámetros manipulados sin enviar NaN/negativos a paginación. */
export function positivePage(value: string | undefined): number {
  if (!value || !/^\d{1,7}$/.test(value)) return 1;
  const page = Number(value);
  return page > 0 ? page : 1;
}
