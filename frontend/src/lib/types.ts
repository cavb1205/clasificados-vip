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

export interface Service {
  id: number;
  name: string;
  slug: string;
}

export interface PublicProfile {
  stage_name: string;
  slug: string;
  description: string;
  age: number;
  services: Service[];
  base_rate: number | null;
  city: City | null;
  photos: string[];
  cover_photo: string | null;
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
