import type { AnyDb } from "@astro/db";
import { createHttpDb } from "@astro/db/http";
import { createWsDb } from "@astro/db/ws";
import { PASS_COOKIE, PASS_TTL_S, readPass, signPass } from "@astro/server/pass";
import { neonConfig } from "@neondatabase/serverless";
import type { Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { isSecure, type Env, type RawEnv } from "./env";
import { lookupSession, sessionToken } from "./session";

export interface Who {
  uid: string;
  reader: boolean;
  tz: string;
  email: string;
  emailVerified: boolean;
  twoFactor: boolean;
}

export interface Deps {
  /** The HTTPS database client for a request (tests pass one on the local Neon stand-in). */
  db?: (env: Env) => AnyDb;
  /** A WebSocket client for one request's interactive transaction; `end` runs after the response. */
  txDb?: (env: Env) => { db: AnyDb; end: () => Promise<void> };
  now?: () => number;
}

export interface Vars {
  env: Env;
  db: () => AnyDb;
  txDb: () => AnyDb;
  now: () => number;
}

export type AppEnv = { Bindings: RawEnv; Variables: Vars };
export type C = Context<AppEnv>;
export type App = Hono<AppEnv>;

// One HTTPS client per isolate: it holds no connection, and building it reads the whole schema.
const clients = new Map<string, AnyDb>();
export function httpDb(env: Env): AnyDb {
  if (env.NEON_FETCH_ENDPOINT) neonConfig.fetchEndpoint = env.NEON_FETCH_ENDPOINT;
  let client = clients.get(env.DATABASE_URL);
  if (!client) clients.set(env.DATABASE_URL, (client = createHttpDb(env.DATABASE_URL)));
  return client;
}
export const wsDb = (env: Env) => createWsDb(env.DATABASE_URL, { wsProxy: env.NEON_WS_PROXY });

const passOptions = (env: Env) => ({ path: "/api", secure: isSecure(env), httpOnly: true, sameSite: "Lax" as const });

export function clearPass(c: C) {
  deleteCookie(c, PASS_COOKIE, passOptions(c.get("env")));
}

/** Who is signed in: from the pass when it is genuine and current, otherwise from Neon (and a fresh pass). */
export async function who(c: C): Promise<Who | null> {
  const env = c.get("env");
  const now = c.get("now")();
  const token = await sessionToken(c.req.header("cookie"), env.BETTER_AUTH_SECRET, isSecure(env));
  if (!token) return null;
  const pass = await readPass(getCookie(c, PASS_COOKIE), token, env.PASS_SECRET, now);
  if (pass) {
    c.header("x-astro-pass", "hit");
    return { uid: pass.uid, reader: pass.reader, tz: pass.tz, email: pass.email, emailVerified: pass.ev, twoFactor: pass.tf };
  }
  return refreshWho(c, token);
}

/**
 * Who is signed in, always checked in Neon (sensitive actions: password, email, two-step, delete, sign out other
 * sessions). Also refreshes the pass.
 */
export async function whoFresh(c: C): Promise<Who | null> {
  const env = c.get("env");
  const token = await sessionToken(c.req.header("cookie"), env.BETTER_AUTH_SECRET, isSecure(env));
  return token ? refreshWho(c, token) : null;
}

async function refreshWho(c: C, token: string): Promise<Who | null> {
  const env = c.get("env");
  const s = await lookupSession(c.get("db")(), token);
  if (!s) {
    clearPass(c);
    return null;
  }
  const fresh = await signPass({ uid: s.uid, sid: s.sid, reader: s.reader, tz: s.timeZone, email: s.email, ev: s.emailVerified, tf: s.twoFactor }, token, env.PASS_SECRET, c.get("now")());
  setCookie(c, PASS_COOKIE, fresh, { ...passOptions(env), maxAge: PASS_TTL_S });
  c.header("x-astro-pass", "refresh");
  return { uid: s.uid, reader: s.reader, tz: s.timeZone, email: s.email, emailVerified: s.emailVerified, twoFactor: s.twoFactor };
}
