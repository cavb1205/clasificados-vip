import { describe, expect, it } from "vitest";
import { telegramSupportLink } from "./contact-links";

describe("telegramSupportLink", () => {
  it.each(["@portal_soporte", "portal_soporte", "t.me/portal_soporte", "https://t.me/portal_soporte"])("normalizes %s", (value) => {
    expect(telegramSupportLink(value)).toBe("https://t.me/portal_soporte");
  });
  it.each(["https://evil.invalid/", "https://t.me.evil.invalid/user", "https://t.me/user?redirect=evil", "javascript:alert(1)", ""])("rejects %s", (value) => {
    expect(telegramSupportLink(value)).toBeNull();
  });
});
