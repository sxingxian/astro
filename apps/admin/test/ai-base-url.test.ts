import { describe, expect, it } from "vitest";
import { validateBaseUrl } from "@/lib/ai";

describe("validateBaseUrl", () => {
  it("accepts an https address on a real domain and tidies it", () => {
    expect(validateBaseUrl("https://api.mistral.ai/v1/")).toBe("https://api.mistral.ai/v1");
    expect(validateBaseUrl("https://api.deepseek.com:443")).toBe("https://api.deepseek.com");
  });

  it.each([
    "http://api.mistral.ai/v1",
    "https://127.0.0.1/v1",
    "https://10.0.0.5",
    "https://[::1]/v1",
    "https://localhost/v1",
    "https://foo.localhost",
    "https://metadata.internal",
    "https://intranet",
    "https://api.example.com:8443",
    "https://user:pass@api.example.com",
    "https://api.example.com/v1?x=1",
    "not a url"
  ])("rejects %s", (url) => {
    expect(() => validateBaseUrl(url)).toThrow(/invalid_base_url/);
  });
});
