import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// vi.hoisted: variables disponibles dentro de los vi.mock (que se elevan al top).
const { store, pushMock } = vi.hoisted(() => {
  const pushMock = vi.fn();
  const store = {
    ensureLoaded: vi.fn(),
    subscribe: () => () => {},
    isFavorited: vi.fn(() => false),
    isAuthed: vi.fn<() => boolean | null>(() => true),
    toggleFavorite: vi.fn(async () => true),
  };
  return { store, pushMock };
});

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));
vi.mock("@/lib/favorites-store", () => store);

import { FavoriteHeart } from "./FavoriteHeart";

describe("FavoriteHeart", () => {
  beforeEach(() => {
    pushMock.mockClear();
    store.toggleFavorite.mockClear();
    store.isFavorited.mockReturnValue(false);
    store.isAuthed.mockReturnValue(true);
  });

  it("renderiza ♡ cuando no es favorito, con nombre accesible", () => {
    render(<FavoriteHeart slug="luna" />);
    const btn = screen.getByRole("button", { name: "Agregar a favoritos" });
    expect(btn).toHaveTextContent("♡");
    expect(btn).toHaveAttribute("aria-pressed", "false");
  });

  it("al hacer click (con sesión) alterna el favorito", async () => {
    render(<FavoriteHeart slug="luna" />);
    await userEvent.click(screen.getByRole("button"));
    expect(store.toggleFavorite).toHaveBeenCalledWith("luna");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("sin sesión, el click redirige a login en vez de togglear", async () => {
    store.isAuthed.mockReturnValue(false);
    render(<FavoriteHeart slug="luna" />);
    await userEvent.click(screen.getByRole("button"));
    expect(store.toggleFavorite).not.toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalledTimes(1);
  });
});
