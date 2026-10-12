import { describe, expect, it } from "vitest";
import { positivePage, safeReturnPath } from "./navigation";

describe("safeReturnPath", () => {
  it("preserves local return destinations and query parameters", () => {
    expect(safeReturnPath("/dashboard/habitaciones/4?from=favorite#photos")).toBe("/dashboard/habitaciones/4?from=favorite#photos");
  });
  it.each([null, "https://evil.invalid", "//evil.invalid", "/\\evil.invalid", "/login?next=/login", "/registro", "javascript:alert(1)"])("rejects external destinations or login loops: %s", (path) => {
    expect(safeReturnPath(path)).toBeNull();
  });
});

describe("positivePage", () => {
  it.each([undefined, "NaN", "-1", "0", "1.5", "Infinity", "²", "9".repeat(100)])("normalizes invalid pages: %s", (page) => {
    expect(positivePage(page)).toBe(1);
  });
  it("accepts valid pages", () => { expect(positivePage("12")).toBe(12); });
});
