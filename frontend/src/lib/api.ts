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
} from "./types";

const API_URL = process.env.API_URL ?? "http://localhost:8000/api/v1";

async function getJSON<T>(path: string, revalidate = 60): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { next: { revalidate } });
  if (!res.ok) {
    throw new Error(`API ${path} -> ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const getRegions = () => getJSON<Region[]>("/regions/", 3600);

export const getCities = (regionSlug: string) =>
  getJSON<City[]>(`/cities/?region=${regionSlug}`, 3600);

export const getPlans = () => getJSON<Plan[]>("/plans/", 3600);

export const getPublications = (region: string, city: string) =>
  getJSON<PublicPublication[]>(`/publications/?region=${region}&city=${city}`, 60);

export const getServices = () => getJSON<Service[]>("/services/", 3600);

export interface ProfileQuery {
  service?: string[];
  min_age?: string;
  max_age?: string;
  min_rate?: string;
  max_rate?: string;
  page?: string;
}

function buildQuery(region: string, city: string, q: ProfileQuery): string {
  const params = new URLSearchParams({ region, city });
  q.service?.forEach((s) => params.append("service", s));
  for (const k of ["min_age", "max_age", "min_rate", "max_rate", "page"] as const) {
    if (q[k]) params.set(k, q[k] as string);
  }
  return params.toString();
}

export const getProfiles = (region: string, city: string, query: ProfileQuery = {}) =>
  getJSON<Paginated<PublicProfile>>(`/profiles/?${buildQuery(region, city, query)}`, 60);

export async function getProfile(slug: string): Promise<PublicProfile | null> {
  const res = await fetch(`${API_URL}/profiles/${slug}/`, { next: { revalidate: 60 } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API profile -> ${res.status}`);
  return res.json();
}

export const getProfileReviews = (slug: string) =>
  getJSON<Review[]>(`/profiles/${slug}/reviews/`, 60);

export const getProfileRating = (slug: string) =>
  getJSON<Rating>(`/profiles/${slug}/rating/`, 60);
