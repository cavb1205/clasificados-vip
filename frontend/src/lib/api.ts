/**
 * Cliente de la API para Server Components (lectura pública SSR).
 * Las escrituras autenticadas del dashboard usan `client-api.ts` (navegador).
 */
import type {
  City,
  Paginated,
  PublicProfile,
  PublicPublication,
  Plan,
  Rating,
  Region,
  Review,
  Service,
  Story,
} from "./types";

const API_URL = process.env.API_URL ?? "http://localhost:8000/api/v1";

async function getJSON<T>(path: string, revalidate = 60): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { next: { revalidate } });
  if (!res.ok) {
    throw new Error(`API ${path} -> ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const getRegions = (opts?: { onlyPopulated?: boolean }) =>
  getJSON<Region[]>(
    opts?.onlyPopulated ? "/regions/?has_profiles=true" : "/regions/",
    opts?.onlyPopulated ? 300 : 3600,  // populadas cambian más seguido
  );

export const getCities = (
  regionSlug: string,
  opts?: { onlyPopulated?: boolean },
) =>
  getJSON<City[]>(
    `/cities/?region=${regionSlug}` + (opts?.onlyPopulated ? "&has_profiles=true" : ""),
    opts?.onlyPopulated ? 300 : 3600,
  );

/**
 * Todas las comunas del país que tienen al menos un perfil visible.
 * Pensado para el selector global de comuna (home + cambio rápido en city page).
 */
export const getAllPopulatedCities = () =>
  getJSON<City[]>("/cities/?has_profiles=true", 300);

export const getPlans = () => getJSON<Plan[]>("/plans/", 3600);

export const getPublications = (region: string, city: string) =>
  getJSON<PublicPublication[]>(`/publications/?region=${region}&city=${city}`, 60);

export const getServices = () => getJSON<Service[]>("/services/", 3600);

/** Slugs de perfiles visibles, para el sitemap. */
export const getProfileSlugs = () =>
  getJSON<{ slug: string; updated_at: string }[]>("/profiles/slugs/", 600);

export interface CityStoryGroup {
  slug: string;
  stage_name: string;
  cover_photo: string | null;
  stories: Story[];
}

/** Modelos con historias activas en una comuna (franja de la página de ciudad). */
export const getCityStories = (region: string, city: string) =>
  getJSON<CityStoryGroup[]>(
    `/stories/by-city/?region=${encodeURIComponent(region)}&city=${encodeURIComponent(city)}`,
    30,
  );

export interface ProfileQuery {
  region?: string;
  city?: string;
  gender?: string;
  q?: string;
  /** Slugs de etiquetas (servicios/extras/características). AND-mode en backend. */
  tag?: string[];
  min_age?: string;
  max_age?: string;
  min_rate?: string;
  max_rate?: string;
  page?: string;
  available_now?: string;
}

function buildQuery(q: ProfileQuery): string {
  const params = new URLSearchParams();
  q.tag?.forEach((s) => params.append("tag", s));
  for (const k of [
    "region", "city", "gender", "q", "min_age", "max_age",
    "min_rate", "max_rate", "page", "available_now",
  ] as const) {
    if (q[k]) params.set(k, q[k] as string);
  }
  return params.toString();
}

export const getProfiles = (region: string, city: string, query: ProfileQuery = {}) =>
  getJSON<Paginated<PublicProfile>>(`/profiles/?${buildQuery({ ...query, region, city })}`, 60);

export const searchProfiles = (query: ProfileQuery) =>
  getJSON<Paginated<PublicProfile>>(`/profiles/?${buildQuery(query)}`, 60);

export async function getProfile(slug: string): Promise<PublicProfile | null> {
  const res = await fetch(`${API_URL}/profiles/${slug}/`, { next: { revalidate: 60 } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API profile -> ${res.status}`);
  return res.json();
}

export const getProfileStories = (slug: string) =>
  getJSON<Story[]>(`/profiles/${slug}/stories/`, 60);

export const getProfileReviews = (slug: string) =>
  getJSON<Review[]>(`/profiles/${slug}/reviews/`, 60);

export const getProfileRating = (slug: string) =>
  getJSON<Rating>(`/profiles/${slug}/rating/`, 60);
