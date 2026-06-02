import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

import { AvatarView } from "./AvatarView";

describe("AvatarView", () => {
  it("abre el avatar a tamaño completo al hacer click y cierra con Esc", async () => {
    const user = userEvent.setup();
    render(<AvatarView src="/media/avatar.jpg" alt="Luna" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /tamaño completo/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
