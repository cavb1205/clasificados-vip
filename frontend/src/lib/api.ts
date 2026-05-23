/**
 * Cliente de la API para Server Components (lectura pública SSR).
 * Las escrituras autenticadas del dashboard usan `client-api.ts` (navegador).
 */
import type {
  City,
  PublicProfile,
  PublicPublication,
  Plan,
  Rating,
  Region,
  Review,
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

export const getProfiles = (region: string, city: string) =>
  getJSON<PublicProfile[]>(`/profiles/?region=${region}&city=${city}`, 60);

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
