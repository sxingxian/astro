import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, securityHeaders } from "./lib/csp";

/** Sets a fresh CSP nonce and the security headers on every page and API response. */
export function proxy(request: NextRequest) {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const nonce = btoa(String.fromCharCode(...bytes));
  // Production builds always get the strict policy; local http runs (wrangler dev) skip upgrade-insecure-requests.
  const csp = buildCsp(nonce, { dev: process.env.NODE_ENV === "development" });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  for (const [k, v] of Object.entries(securityHeaders)) response.headers.set(k, v);
  return response;
}

export const config = {
  // Everything except Next's static files and the favicon, which the assets layer serves with its own headers.
  matcher: [{ source: "/((?!_next/static|_next/image|favicon.ico|icon.svg).*)" }]
};
