import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ myFavorites: vi.fn(), favoriteToggle: vi.fn() }));
vi.mock("./client-api", () => ({ dashboard: mocks, ApiRequestError: class extends Error {} }));
import { __resetFavorites, ensureLoaded, isAuthed, isFavorited, subscribe } from "./favorites-store";

describe("favorite account isolation", () => {
  beforeEach(() => { __resetFavorites(); vi.clearAllMocks(); });
  afterEach(() => { __resetFavorites(); });

  it("drops cached favorites when cards unmount so another account reloads", async () => {
    mocks.myFavorites.mockResolvedValueOnce([{ slug: "old-account" }]).mockResolvedValueOnce([{ slug: "new-account" }]);
    const unsubscribe = subscribe(() => {});
    await ensureLoaded();
    expect(isFavorited("old-account")).toBe(true);
    unsubscribe();
    const cleanup = subscribe(() => {});
    await ensureLoaded();
    expect(isFavorited("old-account")).toBe(false);
    expect(isFavorited("new-account")).toBe(true);
    cleanup();
  });

  it("ignores an old account response arriving after expiry", async () => {
    let finish!: (value: unknown[]) => void;
    mocks.myFavorites.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const cleanup = subscribe(() => {});
    const request = ensureLoaded();
    window.dispatchEvent(new Event("auth-expired"));
    finish([{ slug: "private-old-favorite" }]);
    await request;
    expect(isAuthed()).toBe(false);
    expect(isFavorited("private-old-favorite")).toBe(false);
    cleanup();
  });

  it("does not mistake a temporary backend failure for logout", async () => {
    mocks.myFavorites.mockRejectedValueOnce(new Error("gateway"));
    const cleanup = subscribe(() => {});
    await ensureLoaded();
    expect(isAuthed()).toBeNull();
    mocks.myFavorites.mockResolvedValueOnce([{ slug: "recovered" }]);
    await ensureLoaded();
    expect(isAuthed()).toBe(true);
    cleanup();
  });
});
