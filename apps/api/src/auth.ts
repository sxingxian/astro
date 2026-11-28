import { AsyncLocalStorage } from "node:async_hooks";
import { authOptions } from "@astro/app-core/auth-options";
import { loadCopy } from "@astro/app-core/copy";
import { createMailer } from "@astro/app-core/mail";
import { eq, schema, type AnyDb } from "@astro/db";
import {
  alreadyRegistered,
  defaultEmailT,
  resetPassword,
  verifyEmail,
  type EmailT,
} from "@astro/server";
import { betterAuth } from "better-auth";
import { PASS_COOKIE } from "@astro/server/pass";
import type { App } from "./context";
import { isSecure, type Env } from "./env";
import { sessionToken } from "./session";

/** The request in progress, so Better Auth's background work (emails) is tied to the right request. */
const current = new AsyncLocalStorage<ExecutionContext | undefined>();

const build = (...args: Parameters<typeof authOptions>) =>
  betterAuth(authOptions(...args));
type Auth = ReturnType<typeof build>;
// One Better Auth per isolate, per settings and database client: building it costs ~25 ms. Keyed by the settings'
// values, not the object, so the copy built at startup (index.ts) is the one requests use.
const built = new Map<string, WeakMap<AnyDb, Auth>>();
const settingsKey = (env: Env) =>
  JSON.stringify(Object.entries(env).filter(([, v]) => typeof v === "string" || typeof v === "number").sort(([a], [b]) => a.localeCompare(b)));

/** The published email wording; if it can't be read, emails still go out with the default wording. */
async function emailT(db: AnyDb): Promise<EmailT> {
  try {
    return await loadCopy(db);
  } catch (e) {
    console.error(
      "email wording unavailable, using defaults",
      e instanceof Error ? e.name : "error",
    );
    return defaultEmailT;
  }
}

export function authFor(env: Env, db: AnyDb): Auth {
  const key = settingsKey(env);
  let forEnv = built.get(key);
  if (!forEnv) built.set(key, (forEnv = new WeakMap()));
  let auth = forEnv.get(db);
  if (!auth) {
    const mailer = createMailer({
      driver: env.MAIL_DRIVER,
      from: env.EMAIL_FROM,
      apiKey: env.RESEND_API_KEY,
      db,
    });
    auth = build(
      env,
      {
        db,
        sendMail: (m) => mailer.send(m),
        waitUntil: (p) =>
          current.getStore()
            ? current.getStore()!.waitUntil(p)
            : void p.catch(() => {}),
      },
      {
        verifyEmail: async (to, url) => verifyEmail(to, url, await emailT(db)),
        resetPassword: async (to, url) =>
          resetPassword(to, url, await emailT(db)),
        alreadyRegistered: async (to, signInUrl) =>
          alreadyRegistered(to, signInUrl, await emailT(db)),
      },
    );
    forEnv.set(db, auth);
  }
  return auth;
}

/** Better Auth's own routes (sign-up, sign-in, verification, reset, two-step), at the same paths as before. */
export function authRoutes(app: App) {
  // Signing out without Better Auth (it cost 15-55 ms of CPU live): delete the session row named by the signed cookie,
  // then clear Better Auth's cookies and the pass. Answers success even with no session, so signing out always works.
  app.post("/auth/sign-out", async (c) => {
    const env = c.get("env");
    if (c.req.header("origin") !== new URL(env.APP_URL).origin) return c.json({ error: "forbidden" }, 403);
    const secure = isSecure(env);
    const token = await sessionToken(c.req.header("cookie"), env.BETTER_AUTH_SECRET, secure);
    if (token) await c.get("db")().delete(schema.session).where(eq(schema.session.token, token));
    const prefix = secure ? "__Secure-astro." : "astro.";
    for (const name of ["session_token", "session_data", "dont_remember"]) {
      c.header("set-cookie", `${prefix}${name}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`, { append: true });
    }
    c.header("set-cookie", `${PASS_COOKIE}=; Max-Age=0; Path=/api; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`, { append: true });
    return c.json({ success: true });
  });

  app.on(["GET", "POST"], "/auth/*", async (c) => {
    // Every state-changing auth request must come from the app's own pages (on top of SameSite cookies and Better
    // Auth's own checks). Email links are GETs and stay reachable.
    if (c.req.method === "POST" && c.req.header("origin") !== new URL(c.get("env").APP_URL).origin) return c.json({ error: "forbidden" }, 403);
    const auth = authFor(c.get("env"), c.get("db")());
    let ctx: ExecutionContext | undefined;
    try {
      ctx = c.executionCtx as unknown as ExecutionContext;
    } catch {
      ctx = undefined; // tests call the app without one
    }
    const res = await current.run(ctx, () => auth.handler(c.req.raw));
    // A two-step change ends the pass so the next request reads the new state.
    if (!c.req.path.includes("/two-factor/")) return res;
    const headers = new Headers(res.headers);
    headers.append(
      "set-cookie",
      `${PASS_COOKIE}=; Max-Age=0; Path=/api; HttpOnly; SameSite=Lax${isSecure(c.get("env")) ? "; Secure" : ""}`,
    );
    return new Response(res.body, { status: res.status, headers });
  });
}
