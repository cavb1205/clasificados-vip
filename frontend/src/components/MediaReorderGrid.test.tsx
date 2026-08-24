import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { dashboardMock } = vi.hoisted(() => ({
  dashboardMock: {
    updateMediaOrder: vi.fn(),
    deleteMedia: vi.fn(),
  },
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
vi.mock("@/lib/client-api", () => ({ dashboard: dashboardMock }));

import { MediaReorderGrid } from "./MediaReorderGrid";

const photos = [
  { id: 1, file_url: "/media/a.jpg", order: 0 },
  { id: 2, file_url: "/media/b.jpg", order: 10 },
  { id: 3, file_url: "/media/c.jpg", order: 20 },
];

describe("MediaReorderGrid", () => {
  beforeEach(() => {
    dashboardMock.updateMediaOrder.mockReset().mockResolvedValue({});
    dashboardMock.deleteMedia.mockReset().mockResolvedValue({});
  });

  it("reordena con los controles accesibles y persiste solo las fotos cambiadas", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<MediaReorderGrid photos={photos} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Mover foto 2 a la posición 1" }));

    expect(screen.getAllByRole("img").map((image) => image.getAttribute("src"))).toEqual([
      "/media/b.jpg",
      "/media/a.jpg",
      "/media/c.jpg",
    ]);
    expect(dashboardMock.updateMediaOrder).toHaveBeenNthCalledWith(1, 2, 0);
    expect(dashboardMock.updateMediaOrder).toHaveBeenNthCalledWith(2, 1, 10);
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("permite arrastrar una foto y marcar el destino", async () => {
    const onChange = vi.fn();
    render(<MediaReorderGrid photos={photos} onChange={onChange} />);
    const cards = screen.getAllByRole("listitem");
    const dataTransfer = {
      effectAllowed: "",
      dropEffect: "",
      setData: vi.fn(),
    };

    fireEvent.dragStart(cards[0], { dataTransfer });
    fireEvent.dragOver(cards[2], { dataTransfer });
    expect(cards[2]).toHaveClass("border-pink-500");
    fireEvent.drop(cards[2], { dataTransfer });

    await waitFor(() => expect(onChange).toHaveBeenCalledOnce());
    expect(screen.getAllByRole("img").map((image) => image.getAttribute("src"))).toEqual([
      "/media/b.jpg",
      "/media/c.jpg",
      "/media/a.jpg",
    ]);
  });

  it("revierte el orden y muestra un error si falla la persistencia", async () => {
    dashboardMock.updateMediaOrder.mockRejectedValueOnce(new Error("Sesión expirada"));
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<MediaReorderGrid photos={photos} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Mover foto 2 a la posición 1" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Sesión expirada");
    expect(screen.getAllByRole("img").map((image) => image.getAttribute("src"))).toEqual([
      "/media/a.jpg",
      "/media/b.jpg",
      "/media/c.jpg",
    ]);
    expect(onChange).not.toHaveBeenCalled();
  });
});
