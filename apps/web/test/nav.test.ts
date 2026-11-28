import { afterEach, describe, expect, it, vi } from "vitest";
import { appPath, go, setNavigator, shouldHandle } from "../src/nav";

const ORIGIN = "https://astroapp.example";

describe("appPath()", () => {
  it("keeps screens this app draws in the page, with their search and hash", () => {
    expect(appPath("/journal?filter=one#x", ORIGIN)).toBe("/journal?filter=one#x");
    expect(appPath(`${ORIGIN}/today`, ORIGIN)).toBe("/today");
    expect(appPath("/reading/abc/verify", ORIGIN)).toBe("/reading/abc/verify");
    expect(appPath("/journal/patterns?range=30", ORIGIN)).toBe("/journal/patterns?range=30");
    expect(appPath("/", ORIGIN)).toBe("/");
    for (const p of ["/desk", "/desk/log", "/desk/log/new", "/desk/log/abc", "/invite#t=x", "/offer", "/reader-guidelines"]) expect(appPath(p, ORIGIN)).toBe(p);
  });

  it("leaves everything else to the browser: other sites, the API, pages still on the old app, unknown paths", () => {
    expect(appPath("https://evil.example/today", ORIGIN)).toBeNull();
    expect(appPath("/api/auth/sign-out", ORIGIN)).toBeNull();
    expect(appPath("/api/reader/log/export", ORIGIN)).toBeNull();
    expect(appPath("/invite/abc", ORIGIN)).toBeNull();
    expect(appPath("/desk/log/a/b", ORIGIN)).toBeNull();
    expect(appPath("/nope", ORIGIN)).toBeNull();
    expect(appPath("/reading", ORIGIN)).toBeNull();
    expect(appPath("mailto:hi@example.com", ORIGIN)).toBeNull();
    expect(appPath("javascript:alert(1)", ORIGIN)).toBeNull();
  });

  it("leaves a jump within the same screen (the skip link, #anchors) to the browser", () => {
    expect(appPath(`${ORIGIN}/journal?filter=one#main`, ORIGIN, "/journal?filter=one")).toBeNull();
    expect(appPath(`${ORIGIN}/journal#main`, ORIGIN, "/journal?filter=one")).toBe("/journal#main");
    expect(appPath(`${ORIGIN}/journal?filter=three`, ORIGIN, "/journal?filter=one")).toBe("/journal?filter=three");
  });

  it("sends the sign-in and sign-up screens through the browser, so the session is always loaded fresh", () => {
    for (const p of ["/sign-in", "/sign-up", "/two-step", "/forgot-password", "/reset-password?token=x"]) expect(appPath(p, ORIGIN)).toBeNull();
  });
});

function click(over: Partial<{ button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; defaultPrevented: boolean; target: string; download: boolean }> = {}) {
  const a = { target: over.target ?? "", hasAttribute: (n: string) => n === "download" && !!over.download };
  return { button: over.button ?? 0, metaKey: !!over.metaKey, ctrlKey: !!over.ctrlKey, shiftKey: !!over.shiftKey, altKey: !!over.altKey, defaultPrevented: !!over.defaultPrevented, anchor: a };
}

describe("shouldHandle()", () => {
  it("takes plain left clicks", () => {
    const c = click();
    expect(shouldHandle(c, c.anchor)).toBe(true);
  });

  it("leaves new-tab, download and already-handled clicks alone", () => {
    for (const c of [click({ button: 1 }), click({ metaKey: true }), click({ ctrlKey: true }), click({ shiftKey: true }), click({ altKey: true }), click({ defaultPrevented: true }), click({ target: "_blank" }), click({ download: true })]) {
      expect(shouldHandle(c, c.anchor)).toBe(false);
    }
    const self = click({ target: "_self" });
    expect(shouldHandle(self, self.anchor)).toBe(true);
  });
});

describe("go()", () => {
  afterEach(() => {
    setNavigator(null);
    vi.unstubAllGlobals();
  });

  it("moves within the app when the app is running", () => {
    const nav = vi.fn();
    setNavigator(nav);
    vi.stubGlobal("window", { location: { origin: ORIGIN, assign: vi.fn(), replace: vi.fn() } });
    go("/reading/abc");
    go("/today", { replace: true });
    expect(nav.mock.calls).toEqual([["/reading/abc", { replace: false }], ["/today", { replace: true }]]);
  });

  it("falls back to the browser for anything outside the app, or before the app has started", () => {
    const assign = vi.fn();
    const replace = vi.fn();
    vi.stubGlobal("window", { location: { origin: ORIGIN, assign, replace } });
    go("/today");
    setNavigator(vi.fn());
    go("/sign-up", { replace: true });
    expect(assign).toHaveBeenCalledWith("/today");
    expect(replace).toHaveBeenCalledWith("/sign-up");
  });
});
