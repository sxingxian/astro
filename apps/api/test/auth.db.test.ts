import { resetAndMigrate } from "@astro/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/index";
import { admin, closeAll, dbUrl, env, execution, fake, freshIp, http, passFrom } from "./helpers";

// Better Auth runs on the Neon HTTPS driver (through the stand-in), as it will on Cloudflare.
const app = createApp({ db: () => http, txDb: () => ({ db: http, end: async () => {} }) });
const origin = { origin: env.APP_URL, "content-type": "application/json" };
const run = execution();
const post = async (path: string, body: unknown, headers: Record<string, string> = {}, e: Record<string, string> = env) => {
  const res = await app.request(path, { method: "POST", headers: { ...origin, "cf-connecting-ip": freshIp(), ...headers }, body: JSON.stringify(body) }, e, run.ctx);
  await run.settle();
  return res;
};
const sessionCookie = (res: Response) => /astro\.session_token=([^;]+)/.exec(res.headers.getSetCookie().join("\n"))?.[1];

beforeAll(async () => {
  await resetAndMigrate(dbUrl);
});
afterAll(closeAll);

async function signUp(email: string, password = "correct horse battery staple") {
  const res = await post("/api/auth/sign-up/email", { email, password, name: "Friend", timeZone: "Asia/Singapore", callbackURL: "/today" });
  expect(res.status).toBe(200);
  const [mail] = await admin<{ text: string }[]>`select text from mail_outbox where "to" = ${email} order by created_at desc limit 1`;
  return /(https?:\/\/\S+)/.exec(mail!.text)![1]!;
}

describe("Better Auth in the data Worker", () => {
  it("signs up, refuses sign-in until the email is verified, then signs in", async () => {
    const email = `auth-${Date.now()}@example.com`;
    const link = await signUp(email);
    const early = await post("/api/auth/sign-in/email", { email, password: "correct horse battery staple" });
    expect(early.status).toBe(403);

    const verify = await app.request(new URL(link).pathname + new URL(link).search, {}, env);
    expect([200, 302]).toContain(verify.status);
    expect(sessionCookie(verify)).toBeTruthy();

    const res = await post("/api/auth/sign-in/email", { email, password: "correct horse battery staple" });
    expect(res.status).toBe(200);
    const cookie = sessionCookie(res);
    expect(cookie).toBeTruthy();
    const me = await app.request("/api/me", { headers: { cookie: `astro.session_token=${cookie}` } }, env);
    expect(me.status).toBe(200);
  });

  it("refuses a wrong password", async () => {
    const email = `wrong-${Date.now()}@example.com`;
    const link = await signUp(email);
    await app.request(new URL(link).pathname + new URL(link).search, {}, env);
    const res = await post("/api/auth/sign-in/email", { email, password: "not the password at all" });
    expect(res.status).toBe(401);
    expect(sessionCookie(res)).toBeFalsy();
  });

  it("signing out ends the session and the pass", async () => {
    const email = `out-${Date.now()}@example.com`;
    const link = await signUp(email);
    await app.request(new URL(link).pathname + new URL(link).search, {}, env);
    const signIn = await post("/api/auth/sign-in/email", { email, password: "correct horse battery staple" });
    const cookie = `astro.session_token=${sessionCookie(signIn)}`;
    const me = await app.request("/api/me", { headers: { cookie } }, env);
    const pass = passFrom(me);
    expect(pass).toBeTruthy();

    const out = await post("/api/auth/sign-out", {}, { cookie: `${cookie}; astro.pass=${pass}` });
    expect(out.status).toBe(200);
    expect(out.headers.getSetCookie().join("\n")).toMatch(/astro\.pass=;.*Max-Age=0/);
    const after = await app.request("/api/me", { headers: { cookie } }, env);
    expect(after.status).toBe(401);
  });

  it("refuses an auth POST with no Origin at all", async () => {
    const res = await app.request("/api/auth/sign-in/email", { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": freshIp() }, body: JSON.stringify({ email: "x@example.com", password: "whatever-password" }) }, env);
    expect(res.status).toBe(403);
  });

  it("keeps the endpoints the app never calls from the browser closed", async () => {
    for (const path of ["/api/auth/change-password", "/api/auth/delete-user", "/api/auth/list-sessions"]) {
      expect((await post(path, {})).status).toBe(404);
    }
  });

  it("needs a Turnstile answer when Turnstile is on", async () => {
    const on = { ...env, TURNSTILE_MODE: "on", TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA" };
    const res = await post("/api/auth/sign-in/email", { email: "x@example.com", password: "whatever-password" }, {}, on);
    expect(res.status).toBe(400);
  });

  it("refuses a cookie-carrying request from another site (Better Auth's own origin check)", async () => {
    const res = await app.request("/api/auth/sign-out", { method: "POST", headers: { "content-type": "application/json", cookie: "astro.session_token=x", origin: "https://evil.example", "cf-connecting-ip": freshIp() }, body: JSON.stringify({ email: "x@example.com", password: "whatever-password" }) }, env);
    expect(res.status).toBe(403);
  });

  it("answers sign-in requests in a small number of database requests", async () => {
    const email = `count-${Date.now()}@example.com`;
    const link = await signUp(email);
    await app.request(new URL(link).pathname + new URL(link).search, {}, env);
    const before = fake.calls();
    await post("/api/auth/sign-in/email", { email, password: "correct horse battery staple" });
    // Recorded so a regression shows: Better Auth's sign-in makes several reads and writes of its own.
    expect(fake.calls() - before).toBeLessThanOrEqual(12);
  });
});
