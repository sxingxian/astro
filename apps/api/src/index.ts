import { securityHeaders } from "@astro/server/csp";
import { Hono } from "hono";
import { authRoutes } from "./auth";
import { httpDb, who, wsDb, type AppEnv, type Deps } from "./context";
import { checkEnv, type RawEnv } from "./env";
import { todayFor } from "./today";

/** The data Worker: the app's API under /api (the pages themselves are static files). */
export function createApp({ db = httpDb, txDb = wsDb, now = Date.now }: Deps = {}) {
  const app = new Hono<AppEnv>().basePath("/api");

  app.use("*", async (c, next) => {
    await next();
    for (const [k, v] of Object.entries(securityHeaders)) c.res.headers.set(k, v);
    c.res.headers.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
    c.res.headers.set("Cache-Control", "no-store");
  });
  app.use("*", async (c, next) => {
    const env = checkEnv(c.env);
    if (!env) {
      console.error("astro-api: missing or invalid settings");
      return c.json({ error: "server_error" }, 500);
    }
    c.set("env", env);
    c.set("now", now);
    let client: ReturnType<typeof db> | undefined;
    c.set("db", () => (client ??= db(env)));
    let tx: ReturnType<typeof txDb> | undefined;
    c.set("txDb", () => (tx ??= txDb(env)).db);
    try {
      await next();
    } finally {
      if (tx) {
        const end = tx.end().catch(() => {});
        try {
          c.executionCtx.waitUntil(end);
        } catch {
          await end; // tests call the app without an execution context
        }
      }
    }
  });

  app.get("/health", (c) => c.json({ ok: true }));
  authRoutes(app);

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
export default { fetch: app.fetch } satisfies ExportedHandler<RawEnv>;
