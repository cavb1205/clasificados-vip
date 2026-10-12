import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("session renewal and CSRF", () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("renews expired account requests with one shared refresh", async () => {
    let refreshed = false;
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith("/auth/csrf/")) return json({ csrftoken: "csrf" });
      if (url.endsWith("/auth/refresh/")) { refreshed = true; return json({ detail: "ok" }); }
      return refreshed ? json({ ok: true }) : json({ detail: "expired" }, 401);
    });
    vi.stubGlobal("fetch", fetcher);
    const { apiFetch } = await import("./client-api");
    const result = await Promise.all([apiFetch("/auth/me/"), apiFetch("/auth/privacy-requests/")]);
    expect(result).toEqual([{ ok: true }, { ok: true }]);
    expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/auth/refresh/"))).toHaveLength(1);
  });

  it("failed refresh signals expiry without triggering an auth-changed loop", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/auth/csrf/") ? json({ csrftoken: "csrf" }) : json({ detail: "expired" }, 401)));
    const expired = vi.fn();
    const changed = vi.fn();
    window.addEventListener("auth-expired", expired);
    window.addEventListener("auth-changed", changed);
    try {
      const { apiFetch } = await import("./client-api");
      await expect(apiFetch("/auth/me/")).rejects.toMatchObject({ status: 401 });
      expect(expired).toHaveBeenCalledTimes(1);
      expect(changed).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("auth-expired", expired);
      window.removeEventListener("auth-changed", changed);
    }
  });

  it("deduplicates concurrent CSRF preparation for writes", async () => {
    const fetcher = vi.fn(async (url: string) => url.endsWith("/auth/csrf/") ? json({ csrftoken: "csrf" }) : json({ ok: true }));
    vi.stubGlobal("fetch", fetcher);
    const { apiFetch } = await import("./client-api");
    await Promise.all([apiFetch("/write-a/", { method: "POST" }), apiFetch("/write-b/", { method: "POST" })]);
    expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/auth/csrf/"))).toHaveLength(1);
  });

  it("does not repeat a write rejected for permissions", async () => {
    const fetcher = vi.fn(async (url: string) => url.endsWith("/auth/csrf/") ? json({ csrftoken: "csrf" }) : json({ detail: "No tienes permiso" }, 403));
    vi.stubGlobal("fetch", fetcher);
    const { apiFetch } = await import("./client-api");
    await expect(apiFetch("/write/", { method: "POST" })).rejects.toMatchObject({ status: 403 });
    expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/write/"))).toHaveLength(1);
  });
});
