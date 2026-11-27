import type { AnyDb } from "@astro/db";
import { createHttpDb } from "@astro/db/http";
import { neonConfig } from "@neondatabase/serverless";
import { securityHeaders } from "@astro/server/csp";
import { PASS_COOKIE, PASS_TTL_S, readPass, signPass } from "@astro/server/pass";
import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { checkEnv, type Env } from "./env";
import { lookupSession, sessionToken } from "./session";
import { todayFor } from "./today";

export interface Who {
  uid: string;
  reader: boolean;
  tz: string;
  email: string;
  emailVerified: boolean;
  twoFactor: boolean;
}
type Vars = { env: Env; db: () => AnyDb };
type C = Context<{ Bindings: Partial<Env>; Variables: Vars }>;

export interface Deps {
  /** The database client for a request (tests pass a client on a local Postgres). */
  db?: (env: Env) => AnyDb;
  now?: () => number;
}

/** The data Worker (free-plan design, Stage 0): reads only, under /api/v2. */
// One HTTPS client per isolate: it holds no connection, and building it reads the whole schema.
const clients = new Map<string, AnyDb>();
function httpDb(env: Env): AnyDb {
  if (env.NEON_FETCH_ENDPOINT) neonConfig.fetchEndpoint = env.NEON_FETCH_ENDPOINT;
  let client = clients.get(env.DATABASE_URL);
  if (!client) clients.set(env.DATABASE_URL, (client = createHttpDb(env.DATABASE_URL)));
  return client;
}

export function createApp({ db = httpDb, now = Date.now }: Deps = {}) {
  const app = new Hono<{ Bindings: Partial<Env>; Variables: Vars }>().basePath("/api/v2");

  app.use("*", async (c, next) => {
    await next();
    for (const [k, v] of Object.entries(securityHeaders)) c.res.headers.set(k, v);
    c.res.headers.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
    c.res.headers.set("Cache-Control", "no-store");
  });
  app.use("*", async (c, next) => {
    if (c.req.method !== "GET" && c.req.method !== "HEAD") return c.json({ error: "method_not_allowed" }, 405);
    const env = checkEnv(c.env);
    if (!env) {
      console.error("astro-api: missing or short settings");
      return c.json({ error: "server_error" }, 500);
    }
    c.set("env", env);
    let client: AnyDb | undefined;
    c.set("db", () => (client ??= db(env)));
    await next();
  });

  /** Who is signed in: from the pass when it is genuine and current, otherwise from Neon (and a fresh pass). */
  async function who(c: C): Promise<Who | null> {
    const env = c.get("env");
    const token = await sessionToken(c.req.header("cookie"), env.BETTER_AUTH_SECRET, env.APP_URL.startsWith("https://"));
    if (!token) return null;
    const pass = await readPass(getCookie(c, PASS_COOKIE), token, env.PASS_SECRET, now());
    if (pass) {
      c.header("x-astro-pass", "hit");
      return { uid: pass.uid, reader: pass.reader, tz: pass.tz, email: pass.email, emailVerified: pass.ev, twoFactor: pass.tf };
    }
    const s = await lookupSession(c.get("db")(), token);
    if (!s) {
      deleteCookie(c, PASS_COOKIE, { path: "/api", secure: true, httpOnly: true, sameSite: "Lax" });
      return null;
    }
    const fresh = await signPass({ uid: s.uid, sid: s.sid, reader: s.reader, tz: s.timeZone, email: s.email, ev: s.emailVerified, tf: s.twoFactor }, token, env.PASS_SECRET, now());
    setCookie(c, PASS_COOKIE, fresh, { path: "/api", secure: true, httpOnly: true, sameSite: "Lax", maxAge: PASS_TTL_S });
    c.header("x-astro-pass", "refresh");
    return { uid: s.uid, reader: s.reader, tz: s.timeZone, email: s.email, emailVerified: s.emailVerified, twoFactor: s.twoFactor };
  }

  app.get("/health", (c) => c.json({ ok: true }));

  app.get("/me", async (c) => {
    const w = await who(c);
    return w ? c.json({ user: { id: w.uid, reader: w.reader } }) : c.json({ user: null }, 401);
  });

  app.get("/today", async (c) => {
    const w = await who(c);
    if (!w) return c.json({ error: "signed_out" }, 401);
    return c.json(await todayFor(c.get("db")(), w.uid, w.tz));
  });

  app.notFound((c) => c.json({ error: "not_found" }, 404));
  app.onError((e, c) => {
    // The error's kind and database code only: Drizzle's messages carry the query's values (a session token).
    const code = (e as { cause?: { code?: unknown } }).cause?.code;
    console.error("astro-api:", e instanceof Error ? e.name : "error", typeof code === "string" ? code : "");
    return c.json({ error: "server_error" }, 500);
  });
  return app;
}

const app = createApp();
export default { fetch: app.fetch } satisfies ExportedHandler<Partial<Env>>;
