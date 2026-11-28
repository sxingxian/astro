/**
 * CPU budget check for the data Worker (free-plan design). Runs the Worker in the same runtime as Cloudflare
 * (wrangler dev), answers its database queries from the local test Postgres through a stand-in for Neon's HTTPS
 * endpoint, signs a test person in, and profiles each request over the DevTools protocol.
 *
 *   tsx scripts/cpu-budget.ts [--budget 25] [--entry test/fixtures/spin-worker.ts] [/api/me /api/today …]
 *
 * With no paths it checks every screen's read, the writes, the draw start (WebSocket driver) and sign-in (bcrypt in
 * Postgres). Given paths, it checks just those GETs.
 *
 * Exits 1 if any call doesn't answer as expected (status, and for member reads the pass state: `x-astro-pass`
 * `refresh` without a pass, `hit` with one), or if the median CPU of the warm calls is over the budget (ms) for the
 * usual request (with a pass) or over twice the budget for a request that checks Neon (no pass, sign-in, draw start).
 * p90 and max are printed too, as is each read's first (cache-cold) call. A median or first call over 8 ms prints
 * WARN without failing: worth a look before it meets the live 10 ms.
 *
 * Limits: the profiler adds overhead and samples every 0.1 ms (a gap longer than 2 ms between samples is time spent waiting and counts as one sample), and the local machine isn't Cloudflare's. It does
 * count time in the runtime's native Web Crypto (`test/cpu-budget.cpu.test.ts` proves both kinds). So this is a
 * regression guard; the gate is Cloudflare's own CPU numbers (Observability). Local readings vary by 2–3× from run
 * to run (shared machine, profiler), so the default budget (25 ms) is set to catch a Next.js-sized regression
 * (30–100 ms per request) without failing on noise.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { fileURLToPath } from "node:url";
import { neonFetchOverPostgres, neonWsOverPostgres } from "@astro/db/testing";
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
const budget = Number(opt("--budget", "25"));
const entry = opt("--entry");
const runs = Number(opt("--runs", "13"));
// --only <text>: run just the cases whose label contains it; --top: print where each call's CPU went.
const only = opt("--only");
const top = args.includes("--top") ? (args.splice(args.indexOf("--top"), 1), true) : false;
const paths = args;

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST is not set");
const webUrl = url.replace("migrator:migrator", "astro_web:astro_web");
const PORT = 8795;
const INSPECTOR = 9235;
const NEON_PORT = 4445;
const SAMPLE_MS = 0.1;
const GAP_MS = 2;
const WARN_MS = 8;
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

const PASSWORD = "cpu budget correct horse";

/** A signed-in test person with a password; returns their sign-in cookie and email. */
async function testPerson(): Promise<{ cookie: string; email: string }> {
  const sql = postgres(url!, { max: 1, onnotice: () => {} });
  const uid = randomUUID();
  const email = `cpu-${uid}@example.com`;
  const token = randomUUID().replace(/-/g, "");
  const prehash = createHash("sha256").update(PASSWORD).digest("base64");
  await sql`insert into "user" (id, email, name, email_verified, time_zone) values (${uid}, ${email}, '', true, 'Asia/Singapore')`;
  await sql`insert into account (id, account_id, provider_id, user_id, password) values (${randomUUID()}, ${uid}, 'credential', ${uid}, 'bcrypt-sha256$' || crypt(${prehash}, gen_salt('bf', 12)))`;
  await sql`insert into session (id, token, user_id, expires_at, surface) values (${randomUUID()}, ${token}, ${uid}, ${new Date(Date.now() + 3_600_000)}, 'app')`;
  await sql.end();
  return { cookie: `astro.session_token=${encodeURIComponent(`${token}.${createHmac("sha256", AUTH_SECRET).update(token).digest("base64")}`)}`, email };
}

function startWorker(wsProxy: string): ChildProcess {
  const vars = {
    DATABASE_URL: webUrl,
    BETTER_AUTH_SECRET: AUTH_SECRET,
    PASS_SECRET,
    APP_URL: `http://127.0.0.1:${PORT}`,
    NEON_FETCH_ENDPOINT: `http://127.0.0.1:${NEON_PORT}/sql`,
    NEON_WS_PROXY: wsProxy,
    MAIL_DRIVER: "outbox",
    TURNSTILE_MODE: "off",
    HIBP_CHECK: "off"
  };
  const cli = ["exec", "wrangler", "dev", ...(entry ? [entry] : []), "--port", String(PORT), "--host", `127.0.0.1:${PORT}`, "--inspector-port", String(INSPECTOR)];
  for (const [k, v] of Object.entries(vars)) cli.push("--var", `${k}:${v}`);
  // Its own process group, so stopping it also stops wrangler and workerd under pnpm.
  return spawn("pnpm", cli, { cwd: root, stdio: ["ignore", "pipe", "pipe"], detached: true });
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
    new Promise<T>((resolve, reject) => {
      const i = ++id;
      const timer = setTimeout(() => reject(new Error(`inspector: no answer to ${method}`)), 15_000);
      pending.set(i, (v) => {
        clearTimeout(timer);
        resolve(v as T);
      });
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  await send("Profiler.enable");
  await send("Profiler.setSamplingInterval", { interval: SAMPLE_MS * 1000 });
  return { send, close: () => ws.close() };
}

interface Profile {
  nodes: { id: number; callFrame: { functionName: string; url: string; lineNumber: number } }[];
  samples: number[];
  timeDeltas: number[];
}

/** CPU time (ms) the Worker spent on one request: sampled time outside idle. */
interface Call {
  method?: "GET" | "POST";
  path: string;
  cookie?: string;
  body?: () => object;
}

const ORIGIN = `http://127.0.0.1:${PORT}`;
let ip = 0;
function call({ method = "GET", path, cookie, body }: Call) {
  const headers: Record<string, string> = cookie ? { cookie } : {};
  // Writes need the app's own Origin; each gets its own address so sign-in's rate limit isn't what's measured.
  if (method === "POST") Object.assign(headers, { origin: ORIGIN, "content-type": "application/json", "cf-connecting-ip": `198.51.100.${(ip++ % 250) + 1}` });
  return fetch(`${ORIGIN}${path}`, { method, headers, body: body ? JSON.stringify(body()) : undefined, signal: AbortSignal.timeout(15_000) });
}

async function measure(send: Awaited<ReturnType<typeof inspector>>["send"], c: Call): Promise<{ ms: number; status: number; pass: string | null }> {
  await send("Profiler.start");
  const res = await call(c);
  await res.text();
  const { profile } = await send<{ profile: Profile }>("Profiler.stop");
  if (process.env.CPU_PROFILE_OUT) (await import("node:fs")).appendFileSync(process.env.CPU_PROFILE_OUT, JSON.stringify(profile) + "\n");
  const name = new Map(profile.nodes.map((n) => [n.id, n.callFrame.functionName]));
  let busy = 0;
  const self = new Map<string, number>();
  profile.samples.forEach((s, i) => {
    const fn = name.get(s);
    // V8 takes no samples while the Worker waits outside JavaScript (a subrequest, a timer), so the sample after a
    // wait carries the whole gap. Running code is sampled every 0.1 ms; a longer gap was waiting, so count 0.1 ms.
    const ms = profile.timeDeltas[i]! / 1000;
    const spent = ms > GAP_MS ? SAMPLE_MS : ms;
    if (fn !== "(idle)" && fn !== "(program)") busy += spent;
    if (top) {
      const f = profile.nodes.find((n) => n.id === s)!.callFrame;
      const key = `${f.functionName || "(anonymous)"} ${f.url.split("/").slice(-2).join("/")}:${f.lineNumber}`;
      self.set(key, (self.get(key) ?? 0) + spent);
    }
  });
  if (top) console.log([...self].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `  ${v.toFixed(1).padStart(6)} ms  ${k}`).join("\n"));
  return { ms: busy, status: res.status, pass: res.headers.get("x-astro-pass") };
}

const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))]!;

const neon = await startNeon();
const ws = await neonWsOverPostgres();
const worker = startWorker(ws.address);
let failed = false;
try {
  const person = await testPerson();
  const { cookie } = person;
  // Wait on the profiler, not the Worker, so the first request below is the first the isolate ever handles.
  await waitFor(`http://127.0.0.1:${INSPECTOR}/json`);
  const { send, close } = await inspector();
  // The first request after the isolate starts (Workers Free restarts isolates often): nothing cached yet.
  const cold = await measure(send, { path: "/api/session", cookie });
  if (cold.status !== 200) throw new Error(`the first request answered ${cold.status}`);
  console.log(`${cold.ms > WARN_MS ? "WARN " : "ok   "} /api/session (fresh isolate, first request): ${cold.ms.toFixed(1)} ms`);

  /** Runs one case `runs` times; the first call warms the isolate and isn't counted. */
  /** `c` may be a setup run (unmeasured) before each call, for requests that can't repeat (a fresh draw). */
  async function check(label: string, c: Call | (() => Promise<Call>), ok: (r: { status: number; pass: string | null }) => boolean, limit: number) {
    if (only && !label.includes(only)) return;
    const results = [];
    for (let k = 0; k < runs; k++) results.push(await measure(send, typeof c === "function" ? await c() : c));
    // A cheap error page must never pass for a fast route: every call has to be the real answer.
    const wrong = results.find((r) => !ok(r));
    const warm = results.slice(1).map((r) => r.ms);
    const m = pct(warm, 0.5);
    const over = m > limit;
    failed ||= over || Boolean(wrong);
    const stats = `median ${m.toFixed(1)} ms, p90 ${pct(warm, 0.9).toFixed(1)}, max ${Math.max(...warm).toFixed(1)} [${warm.map((x) => x.toFixed(1)).join(", ")}] budget ${limit} ms`;
    // Locally over ~8 ms is worth a look before it meets the live 10 ms (the local run has profiler overhead).
    if (wrong) console.log(`WRONG ${label}: status ${wrong.status}, x-astro-pass ${wrong.pass ?? "none"}`);
    else console.log(`${over ? "OVER " : m > WARN_MS ? "WARN " : "ok   "} ${label}: ${stats}`);
  }

  /** A new person each time, with a sign-in cookie (and pass) and, if asked, today's reading started. */
  async function freshPerson(spread?: "one" | "three") {
    const p = await testPerson();
    const me = await call({ path: "/api/me", cookie: p.cookie });
    const cookie = `${p.cookie}; astro.pass=${/astro\.pass=([^;]*)/.exec(me.headers.get("set-cookie") ?? "")?.[1]}`;
    if (!spread) return { cookie, sessionId: "" };
    const res = await call({ method: "POST", path: "/api/draw/start", cookie, body: () => ({ spread }) });
    return { cookie, sessionId: ((await res.json()) as { sessionId: string }).sessionId };
  }

  // A finished reading to read and write notes on (the draw start and pick, through the Worker).
  const start = await call({ method: "POST", path: "/api/draw/start", cookie, body: () => ({ spread: "one" }) });
  const { sessionId } = (await start.json()) as { sessionId: string };
  const picked = await call({ method: "POST", path: "/api/draw/pick", cookie, body: () => ({ sessionId, stage: "single", positions: [7] }) });
  if (!start.ok || !picked.ok) throw new Error(`could not draw a reading: ${start.status}, ${picked.status}`);

  const reads = paths.length ? paths : ["/api/me", "/api/session", "/api/today", "/api/journal", "/api/patterns", "/api/account", `/api/reading/${sessionId}`];
  for (const path of reads) {
    // Each read twice: without a pass (checks Neon, issues one) and with it (the usual case).
    // The first call: the isolate's wording and maintenance caches may still be empty (more database requests).
    const cold = await measure(send, { path, cookie });
    if (!only || path.includes(only)) console.log(`${cold.ms > WARN_MS ? "WARN " : "ok   "} ${path} (first call): ${cold.ms.toFixed(1)} ms`);
    const first = await call({ path, cookie });
    const pass = /astro\.pass=([^;]*)/.exec(first.headers.get("set-cookie") ?? "")?.[1];
    await check(`${path} (no pass)`, { path, cookie }, (r) => r.status === 200 && r.pass === "refresh", budget * 2);
    await check(`${path} (with pass)`, { path, cookie: pass ? `${cookie}; astro.pass=${pass}` : cookie }, (r) => r.status === 200 && r.pass === "hit", budget);
  }
  if (!paths.length) {
    const first = await call({ path: "/api/me", cookie });
    const withPass = `${cookie}; astro.pass=${/astro\.pass=([^;]*)/.exec(first.headers.get("set-cookie") ?? "")?.[1]}`;
    await check("/api/legal/terms (public)", { path: "/api/legal/terms" }, (r) => r.status === 200, budget);
    await check("POST /api/reading/:id/note (with pass)", { method: "POST", path: `/api/reading/${sessionId}/note`, cookie: withPass, body: () => ({ body: `Note ${Math.random()}` }) }, (r) => r.status === 200, budget);
    // Returns today's three-card reading in progress after the first call (start_draw takes the lock each time).
    await check("POST /api/draw/start (today's reading again)", { method: "POST", path: "/api/draw/start", cookie: withPass, body: () => ({ spread: "three" }) }, (r) => r.status === 200, budget * 2);
    await check("POST /api/draw/start fresh (shuffle and save)", async () => ({ method: "POST", path: "/api/draw/start", cookie: (await freshPerson()).cookie, body: () => ({ spread: "three" }) }), (r) => r.status === 200, budget * 2);
    await check("POST /api/draw/pick", async () => {
      const p = await freshPerson("one");
      return { method: "POST", path: "/api/draw/pick", cookie: p.cookie, body: () => ({ sessionId: p.sessionId, stage: "single", positions: [7] }) };
    }, (r) => r.status === 200, budget);
    await check("POST /api/auth/sign-in/email (bcrypt in Postgres)", { method: "POST", path: "/api/auth/sign-in/email", body: () => ({ email: person.email, password: PASSWORD }) }, (r) => r.status === 200, budget * 2);
  }
  close();
} finally {
  try {
    process.kill(-worker.pid!, "SIGTERM");
  } catch {
    /* already gone */
  }
  neon.server.close();
}
process.exit(failed ? 1 : 0);
