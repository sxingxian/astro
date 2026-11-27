import { AsyncLocalStorage } from "node:async_hooks";
import { authOptions } from "@astro/app-core/auth-options";
import { loadCopy } from "@astro/app-core/copy";
import { createMailer } from "@astro/app-core/mail";
import type { AnyDb } from "@astro/db";
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

/** The request in progress, so Better Auth's background work (emails) is tied to the right request. */
const current = new AsyncLocalStorage<ExecutionContext | undefined>();

const build = (...args: Parameters<typeof authOptions>) =>
  betterAuth(authOptions(...args));
type Auth = ReturnType<typeof build>;
// One Better Auth per isolate (settings and database client): building it is the expensive part of a sign-in.
const built = new WeakMap<Env, WeakMap<AnyDb, Auth>>();

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
  let forEnv = built.get(env);
  if (!forEnv) built.set(env, (forEnv = new WeakMap()));
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
    // Signing out ends the pass too, so a pass can never outlive the sign-in it came from.
    if (!c.req.path.endsWith("/sign-out")) return res;
    const headers = new Headers(res.headers);
    headers.append(
      "set-cookie",
      `${PASS_COOKIE}=; Max-Age=0; Path=/api; HttpOnly; SameSite=Lax${isSecure(c.get("env")) ? "; Secure" : ""}`,
    );
    return new Response(res.body, { status: res.status, headers });
  });
}
