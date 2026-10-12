import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const state = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
import { AgeGate } from "./AgeGate";

describe("AgeGate", () => {
  beforeEach(() => { localStorage.clear(); state.pathname = "/"; document.body.style.overflow = ""; });
  it.each(["/terminos", "/privacidad"])("allows reading %s before confirming age", (path) => {
    state.pathname = path;
    render(<AgeGate />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });
  it("restores scrolling when age is confirmed", async () => {
    render(<AgeGate />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
    await userEvent.click(screen.getByRole("button", { name: "Soy mayor de 18" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
    expect(localStorage.getItem("age_verified")).toBe("1");
  });
});
