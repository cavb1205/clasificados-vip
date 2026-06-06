export interface Region {
  id: number;
  name: string;
  slug: string;
  order: number;
}

export interface City {
  id: number;
  name: string;
  slug: string;
  region: Region;
}

export interface Story {
  id: number;
  kind: "photo" | "video";
  file_url: string;
  created_at: string;
  expires_at: string;
}

export type Gender = "female" | "trans" | "male";
/** Slugs que aparecen en la URL. `todos` no filtra por categoría. */
export type GenderSlug = "todos" | "mujeres" | "trans" | "hombres";

export const GENDER_BY_SLUG: Partial<Record<GenderSlug, Gender>> = {
  mujeres: "female",
  trans: "trans",
  hombres: "male",
};
export const SLUG_BY_GENDER: Record<Gender, GenderSlug> = {
  female: "mujeres",
  trans: "trans",
  male: "hombres",
};
export const GENDER_LABEL: Record<GenderSlug, string> = {
  todos: "Todos",
  mujeres: "Mujeres",
  trans: "Trans",
  hombres: "Hombres",
};
/** Orden en que aparecen los tabs en la página de comuna. */
export const ALL_GENDER_SLUGS: GenderSlug[] = ["todos", "mujeres", "trans", "hombres"];
export const DEFAULT_GENDER_SLUG: GenderSlug = "todos";

export type ServiceCategory = "service" | "extra" | "feature";

export interface Service {
  id: number;
  name: string;
  slug: string;
  category: ServiceCategory;
}

export const CATEGORY_LABEL: Record<ServiceCategory, string> = {
  service: "Servicios",
  extra: "Extras",
  feature: "Características",
};

export interface PublicProfile {
  stage_name: string;
  slug: string;
  gender: Gender;
  description: string;
  age: number;
  services: Service[];
  base_rate: number | null;
  city: City | null;
  avatar: string | null;
  photos: string[];
  videos: string[];
  cover_photo: string | null;
  is_featured: boolean;
  rating_average: number | null;
  rating_count: number;
  whatsapp: string;
  telegram: string;
  is_available_now: boolean;
  available_until: string | null;
  photo_authenticity: "pending" | "none" | "light" | "heavy";
}

export interface PublicPublication {
  id: number;
  title: string;
  is_featured: boolean;
  stage_name: string;
  slug: string;
  city: string | null;
}

export interface Plan {
  id: number;
  name: string;
  slug: string;
  duration_days: number;
  price: number;
  includes_featured: boolean;
}

export interface Review {
  id: number;
  client_username: string;
  rating: number;
  comment: string;
  created_at: string;
}

export interface Rating {
  average: number | null;
  count: number;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
