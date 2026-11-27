/**
 * CPU budget check for the data Worker (free-plan design). Runs the Worker in the same runtime as Cloudflare
 * (wrangler dev), answers its database queries from the local test Postgres through a stand-in for Neon's HTTPS
 * endpoint, signs a test person in, and profiles each request over the DevTools protocol.
 *
 *   tsx scripts/cpu-budget.ts --budget 6 [--entry test/fixtures/spin-worker.ts] /api/v2/me /api/v2/today
 *
 * Exits 1 if the median CPU of the warm calls to any path, with a pass (the usual request), is over the budget (ms),
 * or over twice the budget without one (the request that checks Neon). The profiler adds overhead, so the local
 * budget is a regression guard, not the live number (that comes from Cloudflare's logs).
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { fileURLToPath } from "node:url";
import { neonFetchOverPostgres } from "@astro/db/testing";
import postgres from "postgres";
import WebSocket from "ws";

const args = process.argv.slice(2);
const opt = (name: string, fallback?: string) => {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const budget = Number(opt("--budget", "10"));
const entry = opt("--entry");
const runs = Number(opt("--runs", "7"));
const paths = args.length ? args : ["/api/v2/me", "/api/v2/today"];

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST is not set");
const webUrl = url.replace("migrator:migrator", "astro_web:astro_web");
const PORT = 8795;
const INSPECTOR = 9235;
const NEON_PORT = 4445;
const AUTH_SECRET = "cpu-budget-auth-secret-0123456789abcdef";
const PASS_SECRET = "cpu-budget-pass-secret-0123456789abcdef";
const root = fileURLToPath(new URL("..", import.meta.url));

/** Neon's SQL-over-HTTP endpoint, answered from the local Postgres. */
function startNeon(): Promise<{ server: Server; end: () => Promise<void> }> {
  const fake = neonFetchOverPostgres(webUrl);
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const out = await fake.fetch("http://local/sql", { method: "POST", body });
    res.writeHead(out.status, { "content-type": "application/json" });
    res.end(await out.text());
  });
  return new Promise((resolve) => server.listen(NEON_PORT, "127.0.0.1", () => resolve({ server, end: fake.end })));
}

async function testPerson(): Promise<string> {
  const sql = postgres(url!, { max: 1, onnotice: () => {} });
  const uid = randomUUID();
  const token = randomUUID().replace(/-/g, "");
  await sql`insert into "user" (id, email, name, email_verified, time_zone) values (${uid}, ${`cpu-${uid}@example.com`}, '', true, 'Asia/Singapore')`;
  await sql`insert into session (id, token, user_id, expires_at, surface) values (${randomUUID()}, ${token}, ${uid}, ${new Date(Date.now() + 3_600_000)}, 'app')`;
  await sql.end();
  return `astro.session_token=${encodeURIComponent(`${token}.${createHmac("sha256", AUTH_SECRET).update(token).digest("base64")}`)}`;
}

function startWorker(): ChildProcess {
  const vars = {
    DATABASE_URL: webUrl,
    BETTER_AUTH_SECRET: AUTH_SECRET,
    PASS_SECRET,
    APP_URL: `http://127.0.0.1:${PORT}`,
    NEON_FETCH_ENDPOINT: `http://127.0.0.1:${NEON_PORT}/sql`
  };
  const cli = ["exec", "wrangler", "dev", ...(entry ? [entry] : []), "--port", String(PORT), "--inspector-port", String(INSPECTOR)];
  for (const [k, v] of Object.entries(vars)) cli.push("--var", `${k}:${v}`);
  return spawn("pnpm", cli, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
}

async function waitFor(u: string, ms = 90_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if ((await fetch(u)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`timed out waiting for ${u}`);
}

async function inspector() {
  const list = (await (await fetch(`http://127.0.0.1:${INSPECTOR}/json`)).json()) as { webSocketDebuggerUrl: string }[];
  const ws = new WebSocket(list[0]!.webSocketDebuggerUrl, { origin: "https://devtools.devprod.cloudflare.dev" });
  await new Promise((r) => ws.once("open", r));
  let id = 0;
  const pending = new Map<number, (v: unknown) => void>();
  ws.on("message", (m) => {
    const d = JSON.parse(m.toString()) as { id?: number; result?: unknown };
    if (d.id && pending.has(d.id)) {
      pending.get(d.id)!(d.result);
      pending.delete(d.id);
    }
  });
  const send = <T>(method: string, params: object = {}) =>
    new Promise<T>((r) => {
      const i = ++id;
      pending.set(i, r as (v: unknown) => void);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  await send("Profiler.enable");
  await send("Profiler.setSamplingInterval", { interval: 100 });
  return { send, close: () => ws.close() };
}

interface Profile {
  nodes: { id: number; callFrame: { functionName: string } }[];
  samples: number[];
  timeDeltas: number[];
}

/** CPU time (ms) the Worker spent on one request: sampled time outside idle. */
async function measure(send: Awaited<ReturnType<typeof inspector>>["send"], path: string, cookie: string): Promise<{ ms: number; status: number }> {
  await send("Profiler.start");
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`, { headers: { cookie } });
  await res.text();
  const { profile } = await send<{ profile: Profile }>("Profiler.stop");
  const name = new Map(profile.nodes.map((n) => [n.id, n.callFrame.functionName]));
  let busy = 0;
  profile.samples.forEach((s, i) => {
    const fn = name.get(s);
    if (fn !== "(idle)" && fn !== "(program)") busy += profile.timeDeltas[i]! / 1000;
  });
  return { ms: busy, status: res.status };
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

const neon = await startNeon();
const worker = startWorker();
let failed = false;
try {
  const cookie = await testPerson();
  await waitFor(`http://127.0.0.1:${PORT}/api/v2/health`);
  const { send, close } = await inspector();
  for (const path of paths) {
    // Each path twice: without a pass (checks Neon, issues one) and with it (the usual case).
    const first = await fetch(`http://127.0.0.1:${PORT}${path}`, { headers: { cookie } });
    const pass = /astro\.pass=([^;]*)/.exec(first.headers.get("set-cookie") ?? "")?.[1];
    for (const [label, c] of [["no pass", cookie], ["with pass", pass ? `${cookie}; astro.pass=${pass}` : cookie]] as const) {
      const results = [];
      for (let k = 0; k < runs; k++) results.push(await measure(send, path, c));
      const warm = results.slice(1).map((r) => r.ms);
      const m = median(warm);
      const limit = label === "no pass" ? budget * 2 : budget;
      const over = m > limit;
      failed ||= over;
      console.log(`${over ? "OVER " : "ok   "} ${path} (${label}) status ${results[1]!.status}: median ${m.toFixed(1)} ms [${warm.map((x) => x.toFixed(1)).join(", ")}] budget ${limit} ms`);
    }
  }
  close();
} finally {
  worker.kill("SIGTERM");
  neon.server.close();
  await neon.end();
}
process.exit(failed ? 1 : 0);
