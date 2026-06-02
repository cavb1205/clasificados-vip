import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileCard } from "./ProfileCard";
import type { PublicProfile } from "@/lib/types";

// El corazón depende del store/API/router; lo stubeamos para un render puro.
vi.mock("@/components/FavoriteHeart", () => ({ FavoriteHeart: () => null }));

function makeProfile(overrides: Partial<PublicProfile> = {}): PublicProfile {
  return {
    stage_name: "Luna",
    slug: "luna",
    gender: "female",
    description: "Masajes y compañía",
    age: 25,
    services: [],
    base_rate: 50000,
    city: { id: 1, name: "Santiago", slug: "santiago", region: { id: 1, name: "RM", slug: "rm" } } as PublicProfile["city"],
    avatar: null,
    photos: [],
    cover_photo: null,
    is_featured: false,
    rating_average: null,
    rating_count: 0,
    whatsapp: "",
    telegram: "",
    is_available_now: false,
    available_until: null,
    ...overrides,
  };
}

describe("ProfileCard", () => {
  it("muestra nombre, edad, comuna y enlaza al perfil", () => {
    render(<ProfileCard profile={makeProfile()} />);
    expect(screen.getByText("Luna")).toBeInTheDocument();
    expect(screen.getByText(/25 años/)).toBeInTheDocument();
    expect(screen.getByText(/Santiago/)).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/perfil/luna");
    // Siempre verificada (solo perfiles verificados llegan al listado público).
    expect(screen.getByText(/Verificada/)).toBeInTheDocument();
  });

  it("muestra los badges Destacada y Disponible ahora cuando corresponde", () => {
    render(<ProfileCard profile={makeProfile({ is_featured: true, is_available_now: true })} />);
    expect(screen.getByText("Destacada")).toBeInTheDocument();
    expect(screen.getByText(/Disponible ahora/)).toBeInTheDocument();
  });

  it("oculta Disponible ahora si no está disponible", () => {
    render(<ProfileCard profile={makeProfile({ is_available_now: false })} />);
    expect(screen.queryByText(/Disponible ahora/)).not.toBeInTheDocument();
  });
});
