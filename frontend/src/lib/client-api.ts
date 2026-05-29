/**
 * Cliente para el navegador (dashboard autenticado).
 * El JWT viaja en cookies HttpOnly (no accesibles desde JS); por eso todas las
 * peticiones usan `credentials: "include"` y las escrituras adjuntan el token CSRF.
 */
"use client";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

/**
 * Token CSRF en memoria. No lo leemos desde document.cookie porque cuando
 * frontend (vercel.app) y backend (nip.io) están en dominios distintos, las
 * cookies del backend no son accesibles por JS desde el frontend.
 *
 * El endpoint GET /auth/csrf/ devuelve el token en el body — la cookie viaja
 * en la request (con credentials:"include" + SameSite=None) para que Django
 * pueda compararla con el header X-CSRFToken.
 */
let cachedCsrf: string | null = null;

async function ensureCsrf(): Promise<string> {
  if (cachedCsrf) return cachedCsrf;
  try {
    const res = await fetch(`${API}/auth/csrf/`, { credentials: "include" });
    const data = (await res.json()) as { csrftoken?: string };
    cachedCsrf = data.csrftoken ?? null;
  } catch {
    cachedCsrf = null;
  }
  return cachedCsrf ?? "";
}

/** Invalida el token cacheado (se llama al recibir 403 para forzar refresh). */
function invalidateCsrf() {
  cachedCsrf = null;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  isForm?: boolean;
}

async function rawFetch(
  path: string,
  method: string,
  body: unknown,
  isForm: boolean,
): Promise<Response> {
  const headers: Record<string, string> = {};
  const isWrite = method !== "GET" && method !== "HEAD";
  if (isWrite) headers["X-CSRFToken"] = await ensureCsrf();
  if (body && !isForm) headers["Content-Type"] = "application/json";

  return fetch(`${API}${path}`, {
    method,
    credentials: "include",
    headers,
    body: isForm ? (body as FormData) : body ? JSON.stringify(body) : undefined,
  });
}

export async function apiFetch<T = unknown>(
  path: string,
  { method = "GET", body, isForm = false }: RequestOptions = {},
): Promise<T> {
  let res = await rawFetch(path, method, body, isForm);

  // El token CSRF puede haber rotado (login/logout); reintentar una vez con uno nuevo.
  if (res.status === 403 && method !== "GET" && method !== "HEAD") {
    invalidateCsrf();
    res = await rawFetch(path, method, body, isForm);
  }

  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail || JSON.stringify(detail) || `Error ${res.status}`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

/** Notifica a componentes que escuchan (AuthNav, etc.) que la sesión cambió. */
function emitAuthChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("auth-changed"));
  }
}

export const auth = {
  login: async (email: string, password: string) => {
    const r = await apiFetch("/auth/login/", { method: "POST", body: { email, password } });
    invalidateCsrf();  // Django rotó el token al iniciar sesión.
    emitAuthChanged();
    return r;
  },
  register: (data: Record<string, unknown>) =>
    apiFetch("/auth/register/", { method: "POST", body: data }),
  logout: async () => {
    const r = await apiFetch("/auth/logout/", { method: "POST" });
    invalidateCsrf();
    emitAuthChanged();
    return r;
  },
  me: () => apiFetch("/auth/me/"),
};

/** Path al panel apropiado según rol/permisos. */
export function panelHrefFor(me: { role?: string; is_staff?: boolean }) {
  if (me.is_staff) return "/admin/kyc";
  if (me.role === "model") return "/dashboard";
  return "/";
}

export const dashboard = {
  // Perfil propio
  getProfile: () => apiFetch<unknown[]>("/me/profile/"),
  createProfile: (data: Record<string, unknown>) =>
    apiFetch("/me/profile/", { method: "POST", body: data }),
  updateProfile: (id: number, data: Record<string, unknown>) =>
    apiFetch(`/me/profile/${id}/`, { method: "PATCH", body: data }),
  setAvailability: (minutes: number) =>
    apiFetch<{ available_until: string | null; is_available_now: boolean }>(
      "/me/profile/availability/",
      { method: "POST", body: { minutes } },
    ),
  cancelAvailability: () =>
    apiFetch<{ available_until: string | null; is_available_now: boolean }>(
      "/me/profile/availability/",
      { method: "POST", body: { cancel: true } },
    ),
  // Multimedia
  listMedia: () => apiFetch<unknown[]>("/me/media/"),
  uploadMedia: (form: FormData) =>
    apiFetch("/me/media/", { method: "POST", body: form, isForm: true }),
  deleteMedia: (id: number) => apiFetch(`/me/media/${id}/`, { method: "DELETE" }),
  updateMediaOrder: (id: number, order: number) =>
    apiFetch(`/me/media/${id}/`, { method: "PATCH", body: { order } }),
  // Publicaciones y pagos
  listPublications: () => apiFetch<unknown[]>("/me/publications/"),
  createPublication: (data: Record<string, unknown>) =>
    apiFetch("/me/publications/", { method: "POST", body: data }),
  uploadReceipt: (pubId: number, form: FormData) =>
    apiFetch(`/me/publications/${pubId}/receipt/`, { method: "POST", body: form, isForm: true }),
  renewPublication: (pubId: number) =>
    apiFetch(`/me/publications/${pubId}/renew/`, { method: "POST" }),
  // Stories propias
  myStories: () => apiFetch<unknown[]>("/me/stories/"),
  uploadStory: (form: FormData) =>
    apiFetch("/me/stories/", { method: "POST", body: form, isForm: true }),
  deleteStory: (id: number) =>
    apiFetch(`/me/stories/${id}/`, { method: "DELETE" }),
  // KYC admin
  kycQueue: () => apiFetch<unknown[]>("/admin/kyc/queue/"),
  kycAction: (id: number, decision: "approve" | "reject", reason?: string) =>
    apiFetch(`/admin/kyc/${id}/action/`, {
      method: "POST",
      body: { decision, reason },
    }),
  // KYC
  issueKycChallenge: () =>
    apiFetch<{ code: string; statement: string; expires_at: string }>(
      "/verification/challenge/", { method: "POST" },
    ),
  submitVerification: (form: FormData) =>
    apiFetch("/verification/submit/", { method: "POST", body: form, isForm: true }),
  // Catálogos
  plans: () => apiFetch<unknown[]>("/plans/"),
  regions: () => apiFetch<unknown[]>("/regions/"),
  cities: (regionSlug: string) => apiFetch<unknown[]>(`/cities/?region=${regionSlug}`),
  services: () => apiFetch<unknown[]>("/services/"),
  // Estadísticas del perfil propio
  stats: () => apiFetch<{
    views_total: number; views_30d: number; views_7d: number;
    contacts_total: number; contacts_30d: number; contacts_7d: number;
  }>("/me/profile/stats/"),
  // Notificaciones in-dashboard
  notifications: () => apiFetch<unknown[]>("/me/notifications/"),
  unreadNotifications: () => apiFetch<{ unread: number }>("/me/notifications/unread-count/"),
  markAllRead: () => apiFetch("/me/notifications/mark-all-read/", { method: "POST" }),
};
