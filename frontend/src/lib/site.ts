export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://clasificados-vip.vercel.app"
).replace(/\/$/, "");

export function absoluteUrl(path = "") {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
