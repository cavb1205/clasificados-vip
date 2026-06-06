import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// next/image → <img> simple para el entorno de test.
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

import { PhotoGallery } from "./PhotoGallery";

const photos = ["/media/a.jpg", "/media/b.jpg", "/media/c.jpg"];

describe("PhotoGallery", () => {
  it("renderiza una miniatura clickeable por foto", () => {
    render(<PhotoGallery photos={photos} alt="Luna" />);
    const thumbs = screen.getAllByRole("button", { name: /tamaño completo/ });
    expect(thumbs).toHaveLength(3);
  });

  it("abre el lightbox al hacer click y permite navegar y cerrar", async () => {
    const user = userEvent.setup();
    render(<PhotoGallery photos={photos} alt="Luna" />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver Luna foto 1 en tamaño completo" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByText("2 / 3")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
