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
