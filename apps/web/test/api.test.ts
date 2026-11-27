import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "../src/api";

function page(search: string, respond: (url: string, init: RequestInit) => Response | Promise<Response>) {
  vi.stubGlobal("window", { location: { search } });
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => (calls.push({ url, init }), respond(url, init)));
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("api()", () => {
  it("asks this site only, with its cookies, never from the browser cache", async () => {
    const calls = page("", () => Response.json({ ok: 1 }));
    expect(await api("/api/today")).toEqual({ ok: 1 });
    expect(calls[0]).toMatchObject({ url: "/api/today", init: { credentials: "same-origin", cache: "no-store" } });
  });

  it("carries a preview link on to every call", async () => {
    const calls = page("?astro-preview=a%20b&x=1", () => Response.json({}));
    await api("/api/journal?filter=all");
    await api("/api/session");
    expect(calls.map((c) => c.url)).toEqual(["/api/journal?filter=all&astro-preview=a%20b", "/api/session?astro-preview=a%20b"]);
  });

  it("turns a refusal into an ApiError with the status and the Worker's error code", async () => {
    page("", () => Response.json({ error: "maintenance" }, { status: 503 }));
    await expect(api("/api/today")).rejects.toMatchObject({ status: 503, code: "maintenance" });
    page("", () => new Response("<html>", { status: 502 }));
    await expect(api("/api/today")).rejects.toMatchObject({ status: 502, code: "request_failed" });
  });

  it("reports a dropped connection as status 0", async () => {
    page("", () => Promise.reject(new TypeError("Failed to fetch")));
    const err = await api("/api/today").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 0, code: "network" });
  });
});
