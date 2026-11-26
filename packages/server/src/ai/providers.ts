import type { schema } from "@astro/db";

export type Provider = (typeof schema.AI_PROVIDERS)[number];
export type Failure = "timeout" | "server" | "quota" | "auth" | "other";

export interface ProviderService {
  provider: Provider;
  model: string;
  /** Only for openai_compatible: its own https address. */
  baseUrl: string | null;
  timeoutMs: number;
}

const PROMPT = "Reply with the single word OK.";

/** The request for a 5-token connection test. Keys always go in a header, never in the address. */
function request(s: ProviderService, key: string, gatewayUrl: string): { url: string; headers: Record<string, string>; body: unknown } {
  const gw = gatewayUrl.replace(/\/$/, "");
  const json = { "content-type": "application/json" };
  switch (s.provider) {
    case "anthropic":
      return { url: `${gw}/anthropic/v1/messages`, headers: { ...json, "x-api-key": key, "anthropic-version": "2023-06-01" }, body: { model: s.model, max_tokens: 5, messages: [{ role: "user", content: PROMPT }] } };
    case "openai":
      return { url: `${gw}/openai/chat/completions`, headers: { ...json, authorization: `Bearer ${key}` }, body: { model: s.model, max_completion_tokens: 5, messages: [{ role: "user", content: PROMPT }] } };
    case "gemini":
      // AI Gateway's name for Google AI Studio.
      return { url: `${gw}/google-ai-studio/v1beta/models/${encodeURIComponent(s.model)}:generateContent`, headers: { ...json, "x-goog-api-key": key }, body: { contents: [{ parts: [{ text: PROMPT }] }], generationConfig: { maxOutputTokens: 5 } } };
    case "openai_compatible":
      return { url: `${(s.baseUrl ?? "").replace(/\/$/, "")}/chat/completions`, headers: { ...json, authorization: `Bearer ${key}` }, body: { model: s.model, max_tokens: 5, messages: [{ role: "user", content: PROMPT }] } };
    default:
      throw new Error(`unknown provider ${String(s.provider)}`);
  }
}

/** Sorts a failed call so the caller knows whether to fall back, cool down, or tell the owner the key is wrong. */
export function classifyFailure(status: number, body: string): Failure {
  if (status === 402 || status === 429 || /insufficient_quota|credit balance|quota/i.test(body)) return "quota";
  if (status === 401 || status === 403) return "auth";
  if (status === 408 || status === 504) return "timeout";
  if (status >= 500) return "server";
  return "other";
}

/** Removes the key, and any piece of it 8 characters or longer, from text that may echo it (error bodies). */
export function redact(text: string, key: string): string {
  if (!key) return text;
  let out = text.split(key).join("[redacted]");
  if (key.length < 8) return out;
  for (let i = 0; i + 8 <= key.length; i++) {
    for (let j = key.length; j >= i + 8; j--) {
      const piece = key.slice(i, j);
      if (out.includes(piece)) {
        out = out.split(piece).join("[redacted]");
        break;
      }
    }
  }
  return out;
}

/** One tiny request to check the address, model and key work. The error, if any, is short and never holds the key. */
export async function testService(s: ProviderService, key: string, fetchFn: typeof fetch, gatewayUrl: string): Promise<{ ok: boolean; ms: number; error?: string; failure?: Failure }> {
  const { url, headers, body } = request(s, key, gatewayUrl);
  const started = Date.now();
  try {
    const res = await fetchFn(url, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(s.timeoutMs), redirect: "manual" });
    const ms = Date.now() - started;
    // Never follow a redirect: the key would go to wherever it points. (Workers don't support redirect: "error".)
    if (res.status >= 300 && res.status < 400) return { ok: false, ms, failure: "other", error: `${res.status} The service redirected elsewhere. Check the address.` };
    if (res.ok) return { ok: true, ms };
    const text = (await res.text().catch(() => "")).slice(0, 2000);
    return { ok: false, ms, failure: classifyFailure(res.status, text), error: redact(`${res.status} ${text}`, key).slice(0, 300) };
  } catch (e) {
    const ms = Date.now() - started;
    const name = e instanceof Error ? e.name : "";
    if (name === "TimeoutError" || name === "AbortError") return { ok: false, ms, failure: "timeout", error: `No answer within ${Math.round(s.timeoutMs / 1000)} s` };
    return { ok: false, ms, failure: "other", error: redact(e instanceof Error ? e.message : "Request failed", key).slice(0, 300) };
  }
}
