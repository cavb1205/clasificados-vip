/**
 * Cliente para el navegador (dashboard autenticado).
 * El JWT viaja en cookies HttpOnly (no accesibles desde JS); por eso todas las
 * peticiones usan `credentials: "include"` y las escrituras adjuntan el token CSRF.
 */
"use client";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

/** Asegura que exista la cookie csrftoken (la siembra el backend en GET /auth/csrf/). */
async function ensureCsrf(): Promise<string> {
  let token = getCookie("csrftoken");
  if (!token) {
    await fetch(`${API}/auth/csrf/`, { credentials: "include" });
    token = getCookie("csrftoken");
  }
  return token ?? "";
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  isForm?: boolean;
}

export async function apiFetch<T = unknown>(
  path: string,
  { method = "GET", body, isForm = false }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  const isWrite = method !== "GET" && method !== "HEAD";

  if (isWrite) headers["X-CSRFToken"] = await ensureCsrf();
  if (body && !isForm) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API}${path}`, {
    method,
    credentials: "include",
    headers,
    body: isForm ? (body as FormData) : body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail || JSON.stringify(detail) || `Error ${res.status}`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const auth = {
  login: (email: string, password: string) =>
    apiFetch("/auth/login/", { method: "POST", body: { email, password } }),
  register: (data: Record<string, unknown>) =>
    apiFetch("/auth/register/", { method: "POST", body: data }),
  logout: () => apiFetch("/auth/logout/", { method: "POST" }),
  me: () => apiFetch("/auth/me/"),
};

export const dashboard = {
  // Perfil propio
  getProfile: () => apiFetch<unknown[]>("/me/profile/"),
  createProfile: (data: Record<string, unknown>) =>
    apiFetch("/me/profile/", { method: "POST", body: data }),
  updateProfile: (id: number, data: Record<string, unknown>) =>
    apiFetch(`/me/profile/${id}/`, { method: "PATCH", body: data }),
  // Multimedia
  listMedia: () => apiFetch<unknown[]>("/me/media/"),
  uploadMedia: (form: FormData) =>
    apiFetch("/me/media/", { method: "POST", body: form, isForm: true }),
  deleteMedia: (id: number) => apiFetch(`/me/media/${id}/`, { method: "DELETE" }),
  // Publicaciones y pagos
  listPublications: () => apiFetch<unknown[]>("/me/publications/"),
  createPublication: (data: Record<string, unknown>) =>
    apiFetch("/me/publications/", { method: "POST", body: data }),
  uploadReceipt: (pubId: number, form: FormData) =>
    apiFetch(`/me/publications/${pubId}/receipt/`, { method: "POST", body: form, isForm: true }),
  // KYC
  submitVerification: (form: FormData) =>
    apiFetch("/verification/submit/", { method: "POST", body: form, isForm: true }),
  // Catálogos
  plans: () => apiFetch<unknown[]>("/plans/"),
  regions: () => apiFetch<unknown[]>("/regions/"),
  cities: (regionSlug: string) => apiFetch<unknown[]>(`/cities/?region=${regionSlug}`),
};
