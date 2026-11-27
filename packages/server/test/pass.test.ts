import { describe, expect, it } from "vitest";
import { PASS_TTL_S, readPass, signPass } from "../src/pass";

const SECRET = "a-test-secret-that-is-long-enough-123";
const TOKEN = "session-token-abc";
const NOW = 1_800_000_000_000;
const who = { uid: "user-1", sid: "sess-1", reader: true };

describe("pass", () => {
  it("round-trips, bound to the session token, valid for 300 s", async () => {
    const cookie = await signPass(who, TOKEN, SECRET, NOW);
    const p = await readPass(cookie, TOKEN, SECRET, NOW + 1000);
    expect(p).toMatchObject(who);
    expect(p?.exp).toBe(Math.floor(NOW / 1000) + PASS_TTL_S);
    expect(PASS_TTL_S).toBe(300);
  });

  it("expires after 300 s", async () => {
    const cookie = await signPass(who, TOKEN, SECRET, NOW);
    expect(await readPass(cookie, TOKEN, SECRET, NOW + 299_000)).not.toBeNull();
    expect(await readPass(cookie, TOKEN, SECRET, NOW + 301_000)).toBeNull();
  });

  it("refuses a changed pass, another secret, or another session's pass", async () => {
    const cookie = await signPass(who, TOKEN, SECRET, NOW);
    const flipped = cookie.slice(0, 5) + (cookie[5] === "A" ? "B" : "A") + cookie.slice(6);
    expect(await readPass(flipped, TOKEN, SECRET, NOW)).toBeNull();
    expect(await readPass(cookie, TOKEN, "another-secret-that-is-long-enough-456", NOW)).toBeNull();
    expect(await readPass(cookie, "someone-elses-token", SECRET, NOW)).toBeNull();
    expect(await readPass(cookie, undefined, SECRET, NOW)).toBeNull();
  });

  it("reads anything malformed as no pass, never throwing", async () => {
    for (const bad of [undefined, "", ".", "abc", "abc.def", "%%%.%%%", `${btoa("not json")}.x`, `${btoa('{"uid":1}')}.x`]) {
      await expect(readPass(bad, TOKEN, SECRET, NOW)).resolves.toBeNull();
    }
  });

  it("refuses a well-signed pass with missing fields", async () => {
    // Sign a payload by hand that lacks `sid`: the signature is valid but the shape is not.
    const cookie = await signPass({ uid: "u", sid: "", reader: false }, TOKEN, SECRET, NOW);
    expect(await readPass(cookie, TOKEN, SECRET, NOW)).toBeNull();
  });
});
