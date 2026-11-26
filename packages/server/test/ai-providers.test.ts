import { describe, expect, it } from "vitest";
import { classifyFailure, redact, testService, type ProviderService } from "../src/ai/providers";

const GW = "https://gateway.ai.cloudflare.com/v1/acct/astro";
const KEY = "sk-test-0123456789abcdefghij";

function recorder(status = 200, body: unknown = { ok: true }) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  };
  return { calls, fetchFn: fetchFn as typeof fetch };
}
const svc = (provider: ProviderService["provider"], extra: Partial<ProviderService> = {}): ProviderService => ({ provider, model: "model-x", baseUrl: null, timeoutMs: 5000, ...extra });
const headers = (init: RequestInit) => new Headers(init.headers);
const body = (init: RequestInit) => JSON.parse(String(init.body));

describe("testService adapters", () => {
  it("anthropic: gateway URL, key in x-api-key, 5 tokens", async () => {
    const { calls, fetchFn } = recorder();
    expect((await testService(svc("anthropic"), KEY, fetchFn, GW)).ok).toBe(true);
    expect(calls[0]!.url).toBe(`${GW}/anthropic/v1/messages`);
    expect(headers(calls[0]!.init).get("x-api-key")).toBe(KEY);
    expect(headers(calls[0]!.init).get("anthropic-version")).toBe("2023-06-01");
    expect(body(calls[0]!.init)).toMatchObject({ model: "model-x", max_tokens: 5 });
    expect(calls[0]!.url).not.toContain(KEY);
  });

  it("openai: gateway URL, bearer key", async () => {
    const { calls, fetchFn } = recorder();
    await testService(svc("openai"), KEY, fetchFn, GW);
    expect(calls[0]!.url).toBe(`${GW}/openai/chat/completions`);
    expect(headers(calls[0]!.init).get("authorization")).toBe(`Bearer ${KEY}`);
    expect(body(calls[0]!.init)).toMatchObject({ model: "model-x", max_completion_tokens: 5 });
    expect(calls[0]!.url).not.toContain(KEY);
  });

  it("gemini: gateway URL, key in a header, never in the URL", async () => {
    const { calls, fetchFn } = recorder();
    await testService(svc("gemini", { model: "gemini-pro" }), KEY, fetchFn, GW);
    expect(calls[0]!.url).toBe(`${GW}/google-ai-studio/v1beta/models/gemini-pro:generateContent`);
    expect(headers(calls[0]!.init).get("x-goog-api-key")).toBe(KEY);
    expect(body(calls[0]!.init).generationConfig.maxOutputTokens).toBe(5);
    expect(calls[0]!.url).not.toContain(KEY);
  });

  it("openai_compatible: its own https address, bearer key", async () => {
    const { calls, fetchFn } = recorder();
    await testService(svc("openai_compatible", { baseUrl: "https://api.example.ai/v1/" }), KEY, fetchFn, GW);
    expect(calls[0]!.url).toBe("https://api.example.ai/v1/chat/completions");
    expect(headers(calls[0]!.init).get("authorization")).toBe(`Bearer ${KEY}`);
    expect(body(calls[0]!.init)).toMatchObject({ model: "model-x", max_tokens: 5 });
  });

  it("never echoes the key back in an error", async () => {
    const { fetchFn } = recorder(401, { error: { message: `Incorrect API key provided: ${KEY}. Also ${KEY.slice(3, 15)}` } });
    const r = await testService(svc("openai"), KEY, fetchFn, GW);
    expect(r.ok).toBe(false);
    expect(r.failure).toBe("auth");
    expect(r.error).toContain("[redacted]");
    expect(r.error).not.toContain(KEY.slice(3, 15));
  });

  it("never follows a redirect", async () => {
    const calls: RequestInit[] = [];
    const fetchFn = (async (_u: unknown, init?: RequestInit) => {
      calls.push(init ?? {});
      return new Response(null, { status: 302, headers: { location: "https://evil.example/collect" } });
    }) as typeof fetch;
    const r = await testService(svc("openai_compatible", { baseUrl: "https://api.example.ai/v1" }), KEY, fetchFn, GW);
    expect(calls[0]!.redirect).toBe("manual");
    expect(r).toMatchObject({ ok: false, failure: "other" });
  });

  it("reports a timeout", async () => {
    const fetchFn = ((_u: unknown, init?: RequestInit) =>
      new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "TimeoutError"))))) as typeof fetch;
    const r = await testService(svc("anthropic", { timeoutMs: 20 }), KEY, fetchFn, GW);
    expect(r).toMatchObject({ ok: false, failure: "timeout" });
  });
});

describe("classifyFailure and redact", () => {
  it("sorts failures the way fallbacks need", () => {
    expect(classifyFailure(429, "")).toBe("quota");
    expect(classifyFailure(402, "")).toBe("quota");
    expect(classifyFailure(400, '{"error":{"code":"insufficient_quota"}}')).toBe("quota");
    expect(classifyFailure(401, "")).toBe("auth");
    expect(classifyFailure(403, "")).toBe("auth");
    expect(classifyFailure(503, "")).toBe("server");
    expect(classifyFailure(504, "")).toBe("timeout");
    expect(classifyFailure(400, "bad model")).toBe("other");
  });

  it("redacts the key and any 8+ character piece of it", () => {
    expect(redact(`x ${KEY} y`, KEY)).toBe("x [redacted] y");
    expect(redact(`piece ${KEY.slice(5, 13)} end`, KEY)).toBe("piece [redacted] end");
    expect(redact(`short ${KEY.slice(5, 11)} stays`, KEY)).toBe(`short ${KEY.slice(5, 11)} stays`);
  });
});
