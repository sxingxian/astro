import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, securityHeaders } from "./lib/csp";
import { getEnv } from "./lib/env";
import { makeMaintenanceCheck, maintenanceHtml, NOT_PAUSED, readMaintenance } from "./lib/maintenance";

/** One check per isolate. The read uses whichever connection string the first request saw (it never changes). */
let connection = "";
const isMaintenance = makeMaintenanceCheck(() => readMaintenance(connection), NOT_PAUSED);
const MAINTENANCE_TIMEOUT_MS = 1500;

/** Paths that keep working while the app is paused. */
// The landing build reads its wording from /api/copy/landing, so code deploys still work while paused.
const ALWAYS_ON = new Set(["/maintenance", "/api/health", "/api/copy/landing"]);
const PREVIEW_ID = /^[A-Za-z0-9_-]{22}$/;

/** While the owner has paused the app: 503 with the notice (JSON for API calls), and a hint to retry later. */
async function paused(request: NextRequest): Promise<NextResponse | null> {
  const path = request.nextUrl.pathname;
  if (ALWAYS_ON.has(path)) return null;
  const env = getEnv();
  connection = env.HYPERDRIVE.connectionString;
  const state = await isMaintenance(env.MAINTENANCE_CACHE_SECONDS, MAINTENANCE_TIMEOUT_MS);
  if (!state.on) return null;
  const headers = { "retry-after": "300", "cache-control": "no-store" };
  return path.startsWith("/api/")
    ? NextResponse.json({ error: "maintenance" }, { status: 503, headers })
    : new NextResponse(maintenanceHtml(state), { status: 503, headers: { ...headers, "content-type": "text/html; charset=utf-8" } });
}

/** Sets a fresh CSP nonce and the security headers on every page and API response. */
export async function proxy(request: NextRequest) {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const nonce = btoa(String.fromCharCode(...bytes));
  // Production builds always get the strict policy; local http runs (wrangler dev) skip upgrade-insecure-requests.
  const csp = buildCsp(nonce, { dev: process.env.NODE_ENV === "development" });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  // Draft wording only via ?astro-preview=<id>; a header sent by the browser is never trusted.
  requestHeaders.delete("x-astro-preview");
  const preview = request.nextUrl.searchParams.get("astro-preview");
  const previewing = preview !== null && PREVIEW_ID.test(preview);
  if (previewing) requestHeaders.set("x-astro-preview", preview);

  const response = (await paused(request)) ?? NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  for (const [k, v] of Object.entries(securityHeaders)) response.headers.set(k, v);
  if (previewing) {
    response.headers.set("cache-control", "no-store");
    response.headers.set("x-robots-tag", "noindex");
  }
  return response;
}

export const config = {
  // Everything except Next's static files and the favicon, which the assets layer serves with its own headers.
  matcher: [{ source: "/((?!_next/static|_next/image|favicon.ico|icon.svg).*)" }]
};
