import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({ me: vi.fn(), cities: vi.fn(), browse: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const router = { replace: mocks.replace };
vi.mock("@/lib/client-api", () => ({
  auth: { me: mocks.me }, rooms: { cities: mocks.cities, browse: mocks.browse },
  ApiRequestError: class extends Error {},
}));
import RoomsBrowsePage from "./page";

describe("room browse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.me.mockResolvedValue({ role: "model" });
    mocks.cities.mockResolvedValue([{ id: 1, name: "Santiago", region_name: "Metropolitana" }]);
    mocks.browse.mockResolvedValue([]);
  });

  it("shows a retryable failure instead of sending network errors to login", async () => {
    mocks.cities.mockRejectedValueOnce(new Error("gateway unavailable"));
    render(<RoomsBrowsePage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cargar");
    expect(mocks.replace).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("No hay habitaciones disponibles con estos filtros.")).toBeInTheDocument();
  });

  it("ignores stale results when mobile filters change quickly", async () => {
    render(<RoomsBrowsePage />);
    await screen.findByText("No hay habitaciones disponibles con estos filtros.");
    let finishOld!: (rooms: unknown[]) => void;
    mocks.browse.mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }));
    await userEvent.click(screen.getByRole("button", { name: /Disponibles ahora/ }));
    mocks.browse.mockResolvedValueOnce([{ id: 2, title: "Resultado nuevo", price: 10000, photos: [], price_period: "monthly" }]);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Filtrar por comuna" }), "1");
    expect(await screen.findByText("Resultado nuevo")).toBeInTheDocument();
    await act(async () => { finishOld([{ id: 1, title: "Resultado antiguo", price: 10000, photos: [], price_period: "monthly" }]); });
    expect(screen.queryByText("Resultado antiguo")).not.toBeInTheDocument();
    expect(screen.getByText("Resultado nuevo")).toBeInTheDocument();
  });
});
