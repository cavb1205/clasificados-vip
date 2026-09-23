import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch, ApiRequestError } from "./client-api";

describe("apiFetch error responses", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports HTTP status and request path instead of displaying an empty object", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("{}", {
          status: 500,
          statusText: "Internal Server Error",
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const error = await apiFetch("/admin/payments/42/action/", { method: "GET" })
      .then(() => null)
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ status: 500, method: "GET", path: "/admin/payments/42/action/" });
    expect((error as Error).message).toContain("HTTP 500 Internal Server Error");
    expect((error as Error).message).not.toBe("{}");
  });

  it("uses a useful fallback for non-JSON gateway errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html><body>Bad Gateway</body></html>", {
          status: 502,
          statusText: "Bad Gateway",
          headers: { "Content-Type": "text/html" },
        }),
      ),
    );

    await expect(apiFetch("/admin/payments/42/action/"))
      .rejects.toThrow("HTTP 502 Bad Gateway");
  });

  it("preserves a structured DRF error detail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "El comprobante ya fue resuelto." }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(apiFetch("/admin/payments/42/action/"))
      .rejects.toThrow("El comprobante ya fue resuelto. (HTTP 409");
  });
});
