import { describe, expect, it } from "vitest";
import { handle } from "../src/index";
import { isLegacy } from "../src/legacy";

describe("reader pages forwarded to the old app", () => {
  it("knows which paths are the old app's", () => {
    for (const p of ["/desk", "/desk/log", "/desk/log/abc", "/invite", "/offer", "/reader-guidelines", "/_next/static/x.js", "/api/reader/log", "/api/invite/accept", "/api/offer/accept"]) expect(isLegacy(p), p).toBe(true);
    for (const p of ["/today", "/reading/abc", "/api/today", "/api/draw/start", "/desktop", "/invites", "/api/readers"]) expect(isLegacy(p), p).toBe(false);
  });

  it("passes the request through unchanged: method, headers and body", async () => {
    let seen: Request | undefined;
    const LEGACY = { fetch: async (r: Request) => ((seen = r), new Response("old app", { status: 200 })) };
    const req = new Request("http://127.0.0.1:8791/api/reader/log", { method: "POST", headers: { cookie: "a=b", origin: "http://127.0.0.1:8791" }, body: '{"x":1}' });
    const res = await handle(req, { LEGACY } as never, {} as ExecutionContext);
    expect(await res.text()).toBe("old app");
    expect(seen?.method).toBe("POST");
    expect(seen?.headers.get("cookie")).toBe("a=b");
    expect(await seen?.text()).toBe('{"x":1}');
  });

  it("drops the pass after a forwarded change, so a new reader role shows at once", async () => {
    const LEGACY = { fetch: async () => new Response("ok", { status: 200, headers: { "set-cookie": "old=1; Path=/" } }) };
    const post = (path: string) => handle(new Request(`https://astroapp.example${path}`, { method: "POST" }), { LEGACY, APP_URL: "https://astroapp.example" } as never, {} as ExecutionContext);
    const res = await post("/api/reader/give-up");
    const cookies = res.headers.getSetCookie();
    expect(cookies).toContain("old=1; Path=/");
    expect(cookies.find((c) => c.startsWith("astro.pass="))).toMatch(/Max-Age=0.*Path=\/api.*HttpOnly.*Secure.*SameSite=Lax/);
    const get = await handle(new Request("https://astroapp.example/desk"), { LEGACY, APP_URL: "https://astroapp.example" } as never, {} as ExecutionContext);
    expect(get.headers.getSetCookie().some((c) => c.startsWith("astro.pass="))).toBe(false);
    const failed = { fetch: async () => new Response("no", { status: 403 }) };
    const refused = await handle(new Request("https://astroapp.example/api/offer/accept", { method: "POST" }), { LEGACY: failed, APP_URL: "https://astroapp.example" } as never, {} as ExecutionContext);
    expect(refused.headers.getSetCookie()).toEqual([]);
  });

  it("never sends the rebuilt screens' API to the old app", async () => {
    let called = false;
    const LEGACY = { fetch: async () => ((called = true), new Response("old app")) };
    await handle(new Request("http://127.0.0.1:8791/api/health"), { LEGACY } as never, {} as ExecutionContext);
    expect(called).toBe(false);
  });

  it("answers 404 for a reader path when the binding is missing", async () => {
    expect((await handle(new Request("http://127.0.0.1:8791/desk"), {} as never, {} as ExecutionContext)).status).toBe(404);
  });
});

describe("wrangler config", () => {
  it("sends every reader path to the Worker before the page files", async () => {
    const { readFileSync } = await import("node:fs");
    const { LEGACY_ROUTES } = await import("../src/legacy");
    const text = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
    const config = JSON.parse(text.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n"));
    const first: string[] = config.assets.run_worker_first;
    for (const r of LEGACY_ROUTES) expect(r.startsWith("/api/") ? first.includes("/api/*") : first.includes(r), r).toBe(true);
    expect(config.services).toEqual([{ binding: "LEGACY", service: "astro-app" }]);
  });
});
