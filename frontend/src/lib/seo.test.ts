import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "./seo";

describe("serializeJsonLd", () => {
  it("escapa caracteres que podrían cerrar el script inline", () => {
    const result = serializeJsonLd({ name: "</script><script>alert(1)</script> &" });

    expect(result).not.toContain("</script>");
    expect(result).toContain("\\u003c/script\\u003e");
    expect(result).toContain("\\u0026");
  });
});
