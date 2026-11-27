/**
 * The free-plan app, locally, for development and the browser tests: the new Worker (pages, API) on :8792, the old
 * app on :8790 behind it for the reader pages (the LEGACY service binding finds it through wrangler's dev registry),
 * and stand-ins for Neon's HTTPS and WebSocket endpoints that answer from the local test Postgres.
 *
 *   DATABASE_URL_TEST=postgres://migrator:migrator@127.0.0.1:5432/astro_test pnpm --filter @astro/api stack
 *
 * The old app must be built first (`pnpm --filter @astro/app build`). Local only: the Worker honours the stand-ins
 * only while APP_URL is a local address. Stop with Ctrl+C.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { neonFetchOverPostgres, neonWsOverPostgres } from "@astro/db/testing";

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST is not set");
const webUrl = url.replace("migrator:migrator", "astro_web:astro_web");
const pg = new URL(url);
const API_PORT = 8792;
const NEON_PORT = 4445;
const APP_URL = `http://127.0.0.1:${API_PORT}`;
const api = fileURLToPath(new URL("..", import.meta.url));
const app = fileURLToPath(new URL("../../app", import.meta.url));

// The old app's local secret, so both Workers read the same sign-in cookie.
const devVars = Object.fromEntries(
  readFileSync(`${app}/.dev.vars`, "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
);

const fake = neonFetchOverPostgres(webUrl);
const neon = createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  const out = await fake.fetch("http://local/sql", { method: "POST", body });
  res.writeHead(out.status, { "content-type": "application/json" });
  res.end(await out.text());
});
await new Promise<void>((r) => neon.listen(NEON_PORT, "127.0.0.1", () => r()));
const ws = await neonWsOverPostgres(pg.hostname, Number(pg.port || 5432));

const children: ChildProcess[] = [];
function run(cwd: string, args: string[], env: Record<string, string> = {}) {
  // Same process group as this script: Ctrl+C or the test runner stopping the group stops wrangler and workerd too.
  const child = spawn("pnpm", ["exec", "wrangler", "dev", ...args], { cwd, stdio: "inherit", env: { ...process.env, ...env } });
  children.push(child);
}

run(app, ["--var", `APP_URL:${APP_URL}`, "--var", "MAINTENANCE_CACHE_SECONDS:1"], {
  CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: webUrl
});
const vars: Record<string, string> = {
  APP_URL,
  DATABASE_URL: webUrl,
  BETTER_AUTH_SECRET: devVars.BETTER_AUTH_SECRET!,
  PASS_SECRET: "local-stack-pass-secret-0123456789abcdef",
  NEON_FETCH_ENDPOINT: `http://127.0.0.1:${NEON_PORT}/sql`,
  NEON_WS_PROXY: ws.address,
  MAIL_DRIVER: "outbox",
  TURNSTILE_MODE: "off",
  HIBP_CHECK: "off",
  PUBLIC_TURNSTILE_SITE_KEY: devVars.PUBLIC_TURNSTILE_SITE_KEY ?? "1x00000000000000000000AA",
  ADMIN_URL: devVars.ADMIN_URL ?? "http://127.0.0.1:8791/admin",
  MAINTENANCE_CACHE_SECONDS: "1"
};
run(api, ["--port", String(API_PORT), "--inspector-port", "9236", ...Object.entries(vars).flatMap(([k, v]) => ["--var", `${k}:${v}`])]);

// Stop the Workers and exit at once; the stand-ins' open sockets close with the process.
const stop = () => {
  for (const c of children) c.kill("SIGTERM");
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
