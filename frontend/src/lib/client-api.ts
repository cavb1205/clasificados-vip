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
  if (me.role === "moderator") return "/admin";
  if (me.role === "model") return "/dashboard";
  if (me.role === "host") return "/anfitrion";
  return "/";
}

export const dashboard = {
  // Perfil propio
  getProfile: () => apiFetch<unknown[]>("/me/profile/"),
  createProfile: (data: Record<string, unknown>) =>
    apiFetch("/me/profile/", { method: "POST", body: data }),
  updateProfile: (id: number, data: Record<string, unknown>) =>
    apiFetch(`/me/profile/${id}/`, { method: "PATCH", body: data }),
  uploadAvatar: (form: FormData) =>
    apiFetch<{ avatar: string | null }>("/me/profile/avatar/", { method: "POST", body: form, isForm: true }),
  deleteAvatar: () =>
    apiFetch<{ avatar: string | null }>("/me/profile/avatar/", { method: "DELETE" }),
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
  // Admin: dashboard + colas
  adminStats: () => apiFetch<Record<string, number>>("/admin/stats/"),
  adminPayments: (status: "pending" | "approved" | "rejected" = "pending") =>
    apiFetch<unknown[]>(`/admin/payments/?status=${status}`),
  adminPaymentAction: (
    id: number,
    action: "approve" | "reject",
    note?: string,
  ) =>
    apiFetch(`/admin/payments/${id}/action/`, {
      method: "POST",
      body: { action, note },
    }),
  adminStoryReports: () => apiFetch<unknown[]>("/admin/story-reports/"),
  adminStoryReportAction: (
    id: number,
    action: "delete_story" | "dismiss",
  ) =>
    apiFetch(`/admin/story-reports/${id}/action/`, {
      method: "POST",
      body: { action },
    }),
  adminReviews: (status: "pending" | "approved" | "rejected" | "flagged" = "pending") =>
    apiFetch<unknown[]>(`/admin/reviews/?status=${status}`),
  adminReviewAction: (id: number, action: "approve" | "reject" | "unflag") =>
    apiFetch(`/admin/reviews/${id}/action/`, {
      method: "POST",
      body: { action },
    }),
  adminKycAudit: () => apiFetch<unknown[]>("/admin/kyc/audit/"),
  adminProfiles: (q: string = "", statusFilter: string = "", page = 1) =>
    apiFetch<Paginated<unknown>>(
      `/admin/profiles/?${new URLSearchParams({
        q,
        page: String(page),
        ...(statusFilter ? { status: statusFilter } : {}),
      }).toString()}`,
    ),
  // Usuarios/clientes (solo admin)
  adminUsers: (q = "", role = "", statusFilter = "", page = 1) =>
    apiFetch<Paginated<unknown>>(
      `/auth/admin/users/?${new URLSearchParams({
        q, page: String(page),
        ...(role ? { role } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      }).toString()}`,
    ),
  adminUserAction: (id: number, action: "suspend" | "unsuspend", reason?: string) =>
    apiFetch(`/auth/admin/users/${id}/action/`, { method: "POST", body: { action, reason } }),
  adminUserSetRole: (id: number, role: string) =>
    apiFetch(`/auth/admin/users/${id}/action/`, { method: "POST", body: { action: "set_role", role } }),
  adminUserNotify: (userId: number, message: string, title = "") =>
    apiFetch(`/auth/admin/users/${userId}/notify/`, { method: "POST", body: { message, title } }),
  // Bitácora de acciones admin (solo admin)
  adminActionLog: (action = "", q = "", page = 1) =>
    apiFetch<Paginated<unknown>>(
      `/admin/action-log/?${new URLSearchParams({
        q, page: String(page), ...(action ? { action } : {}),
      }).toString()}`,
    ),
  adminProfileAction: (
    id: number,
    action: "suspend" | "unsuspend",
    reason?: string,
  ) =>
    apiFetch(`/admin/profiles/${id}/action/`, {
      method: "POST",
      body: { action, reason },
    }),
  adminExpirePublication: (id: number) =>
    apiFetch(`/admin/publications/${id}/expire/`, { method: "POST" }),
  adminGrantDays: (publicationId: number, days: number, note = "") =>
    apiFetch(`/admin/publications/${publicationId}/grant/`, {
      method: "POST", body: { days, note },
    }),
  adminProfileDetail: (profileId: number) =>
    apiFetch<{
      profile: Record<string, unknown>;
      media: { id: number; media_type: "photo" | "video"; url: string | null; is_hidden: boolean }[];
      publications: { id: number; title: string; status: string; is_featured: boolean; is_live: boolean; expires_at: string | null; plan_name: string | null }[];
      receipts: { id: number; amount: number; status: string; publication_title: string; created_at: string; reviewed_at: string | null }[];
      reports: { id: number; reason: string; reporter_email: string | null; created_at: string }[];
      recent_actions: { action: string; actor_email: string | null; note: string; created_at: string }[];
    }>(`/admin/profiles/${profileId}/detail/`),
  adminMediaHide: (mediaId: number, action: "hide" | "unhide") =>
    apiFetch(`/admin/media/${mediaId}/hide/`, { method: "POST", body: { action } }),
  adminPlans: () => apiFetch<unknown[]>("/admin/plans/"),
  adminCreatePlan: (data: Record<string, unknown>) =>
    apiFetch("/admin/plans/", { method: "POST", body: data }),
  adminUpdatePlan: (id: number, data: Record<string, unknown>) =>
    apiFetch(`/admin/plans/${id}/`, { method: "PATCH", body: data }),
  adminDeletePlan: (id: number) =>
    apiFetch(`/admin/plans/${id}/`, { method: "DELETE" }),
  adminSiteConfig: () =>
    apiFetch<{ trial_days: number; max_active_rooms_per_host: number; payment_instructions: string; support_telegram: string }>("/admin/site-config/"),
  adminUpdateSiteConfig: (data: { trial_days?: number; max_active_rooms_per_host?: number; payment_instructions?: string; support_telegram?: string }) =>
    apiFetch("/admin/site-config/", { method: "PUT", body: data }),
  // Datos de pago que la modelo ve al elegir plan / subir comprobante
  paymentInfo: () =>
    apiFetch<{ payment_instructions: string }>("/payment-info/"),
  // Canal de soporte (Telegram) para el botón de modelos/anfitriones
  supportInfo: () =>
    apiFetch<{ support_telegram: string }>("/support-info/"),
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
  // Favoritos (clientes) y reportes de perfiles
  myFavorites: () => apiFetch<unknown[]>("/me/favorites/"),
  favoriteToggle: (slug: string) =>
    apiFetch<{ favorited: boolean }>(`/profiles/${slug}/favorite/`, { method: "POST" }),
  reportProfile: (slug: string, reason: string) =>
    apiFetch(`/profiles/${slug}/report/`, { method: "POST", body: { reason } }),
  createReview: (data: { profile_slug: string; rating: number; comment: string }) =>
    apiFetch("/reviews/", { method: "POST", body: data }),
  myReviews: () => apiFetch<MyReview[]>("/me/reviews/"),
  // Historial de pagos de la modelo
  myReceipts: () =>
    apiFetch<{ id: number; publication_title: string; amount: number | null; status: string; note: string; created_at: string; reviewed_at: string | null }[]>(
      "/me/receipts/",
    ),
  // Reseñas recibidas por la modelo (responder/reportar)
  myProfileReviews: () =>
    apiFetch<{ id: number; client_username: string; rating: number; comment: string; reply: string; is_flagged: boolean; flag_reason: string; created_at: string }[]>(
      "/me/profile/reviews/",
    ),
  replyReview: (id: number, reply: string) =>
    apiFetch(`/me/profile/reviews/${id}/reply/`, { method: "POST", body: { reply } }),
  reportReview: (id: number, reason: string) =>
    apiFetch(`/me/profile/reviews/${id}/report/`, { method: "POST", body: { reason } }),
  changePassword: (data: { current_password: string; new_password: string }) =>
    apiFetch("/auth/change-password/", { method: "POST", body: data }),
  adminProfileReports: () => apiFetch<unknown[]>("/admin/profile-reports/"),
  adminProfileReportAction: (id: number, action: "suspend" | "dismiss", reason?: string) =>
    apiFetch(`/admin/profile-reports/${id}/action/`, { method: "POST", body: { action, reason } }),
};

export interface MyReview {
  id: number;
  profile_slug: string;
  stage_name: string;
  rating: number;
  comment: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

/**
 * Clasificado de habitaciones. Tres audiencias:
 *  - Anfitrión (rol host): gestiona su perfil, anuncios, fotos y pagos.
 *  - Modelo activa: navega habitaciones disponibles (`browse`).
 *  - Admin/moderador: cola de pagos y moderación de anuncios.
 */
export const rooms = {
  // Anfitrión
  hostProfile: () => apiFetch<HostProfile>("/me/host-profile/"),
  createHostProfile: (data: Record<string, unknown>) =>
    apiFetch<HostProfile>("/me/host-profile/", { method: "POST", body: data }),
  updateHostProfile: (data: Record<string, unknown>) =>
    apiFetch<HostProfile>("/me/host-profile/", { method: "PUT", body: data }),
  roomPlans: () => apiFetch<RoomPlan[]>("/room-plans/"),
  // Contratar/renovar el plan del anfitrión (multipart: plan_id + image).
  buyPlan: (form: FormData) =>
    apiFetch("/me/room-subscription/", { method: "POST", body: form, isForm: true }),
  myRooms: () => apiFetch<RoomListing[]>("/me/rooms/"),
  createRoom: (data: Record<string, unknown>) =>
    apiFetch<RoomListing>("/me/rooms/", { method: "POST", body: data }),
  updateRoom: (id: number, data: Record<string, unknown>) =>
    apiFetch<RoomListing>(`/me/rooms/${id}/`, { method: "PATCH", body: data }),
  deleteRoom: (id: number) => apiFetch(`/me/rooms/${id}/`, { method: "DELETE" }),
  uploadRoomPhoto: (form: FormData) =>
    apiFetch("/me/room-photos/", { method: "POST", body: form, isForm: true }),
  deleteRoomPhoto: (id: number) =>
    apiFetch(`/me/room-photos/${id}/`, { method: "DELETE" }),
  updateRoomPhotoOrder: (id: number, order: number) =>
    apiFetch(`/me/room-photos/${id}/`, { method: "PATCH", body: { order } }),
  publishRoom: (id: number) => apiFetch<RoomListing>(`/me/rooms/${id}/publish/`, { method: "POST" }),
  unpublishRoom: (id: number) => apiFetch<RoomListing>(`/me/rooms/${id}/unpublish/`, { method: "POST" }),
  pauseRoom: (id: number) => apiFetch<RoomListing>(`/me/rooms/${id}/pause/`, { method: "POST" }),
  resumeRoom: (id: number) => apiFetch<RoomListing>(`/me/rooms/${id}/resume/`, { method: "POST" }),
  setRoomAvailability: (id: number, minutes: number) =>
    apiFetch<RoomListing>(`/me/rooms/${id}/availability/`, { method: "POST", body: { minutes } }),
  cancelRoomAvailability: (id: number) =>
    apiFetch<RoomListing>(`/me/rooms/${id}/availability/`, { method: "POST", body: { cancel: true } }),
  // Modelo activa
  browse: (params: Record<string, string> = {}) =>
    apiFetch<PublicRoom[]>(`/rooms/?${new URLSearchParams(params).toString()}`),
  // Comunas con anuncios activos (para el filtro del browse)
  cities: () =>
    apiFetch<{ id: number; name: string; region_name: string }[]>("/room-cities/"),
  report: (id: number, reason: string) =>
    apiFetch(`/rooms/${id}/report/`, { method: "POST", body: { reason } }),
  // Admin / moderador (reportes de habitaciones)
  adminRoomReports: () => apiFetch<unknown[]>("/admin/room-reports/"),
  adminRoomReportAction: (id: number, action: "suspend" | "dismiss", reason?: string) =>
    apiFetch(`/admin/room-reports/${id}/action/`, { method: "POST", body: { action, reason } }),
  // Admin / moderador
  adminRoomPayments: (status: "pending" | "approved" | "rejected" = "pending") =>
    apiFetch<unknown[]>(`/admin/room-payments/?status=${status}`),
  adminRoomPaymentAction: (id: number, action: "approve" | "reject", note?: string) =>
    apiFetch(`/admin/room-payments/${id}/action/`, { method: "POST", body: { action, note } }),
  adminRooms: (q = "", statusFilter = "", page = 1) =>
    apiFetch<Paginated<unknown>>(
      `/admin/rooms/?${new URLSearchParams({
        q, page: String(page),
        ...(statusFilter ? { status: statusFilter } : {}),
      }).toString()}`,
    ),
  adminRoomAction: (id: number, action: "suspend" | "unsuspend", reason?: string) =>
    apiFetch(`/admin/rooms/${id}/action/`, { method: "POST", body: { action, reason } }),
  // Anfitriones (admin/moderador)
  adminHosts: (q = "", statusFilter = "", page = 1) =>
    apiFetch<Paginated<unknown>>(
      `/admin/hosts/?${new URLSearchParams({
        q, page: String(page),
        ...(statusFilter ? { status: statusFilter } : {}),
      }).toString()}`,
    ),
  adminHostAction: (id: number, action: "suspend" | "unsuspend", reason?: string) =>
    apiFetch(`/admin/hosts/${id}/action/`, { method: "POST", body: { action, reason } }),
};

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface HostProfile {
  id: number;
  display_name: string;
  phone: string;
  whatsapp: string;
  created_at: string;
  plan_name: string | null;
  plan_slots: number;
  plan_featured: boolean;
  plan_expires_at: string | null;
  subscription_active: boolean;
  used_slots: number;
  available_slots: number;
}

export interface RoomPlan {
  id: number;
  name: string;
  slug: string;
  duration_days: number;
  price: number;
  max_listings: number;
  includes_featured: boolean;
}

export interface RoomPhoto {
  id: number;
  image_url: string;
  order: number;
}

export interface RoomListing {
  id: number;
  title: string;
  description: string;
  city: string | null;
  region: string | null;
  sector: string;
  price: number;
  price_period: "daily" | "weekly" | "monthly";
  whatsapp: string;
  phone: string;
  status: "draft" | "active" | "expired";
  is_featured: boolean;
  is_paused: boolean;
  expires_at: string | null;
  available_until: string | null;
  is_available_now: boolean;
  photos: RoomPhoto[];
  created_at: string;
}

export interface PublicRoom {
  id: number;
  title: string;
  description: string;
  city: string | null;
  region: string | null;
  sector: string;
  price: number;
  price_period: "daily" | "weekly" | "monthly";
  whatsapp: string;
  phone: string;
  is_featured: boolean;
  is_available_now: boolean;
  photos: RoomPhoto[];
  created_at: string;
}
