// Post-build step: hash every inline <script> in the static export and write a
// strict Content-Security-Policy into out/_headers (served by Cloudflare).
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const PLACEHOLDER = "__CSP__";

const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;

/** sha256 source expressions for each inline script in an HTML document. */
export function collectInlineScriptHashes(html) {
  const hashes = [];
  for (const match of html.matchAll(INLINE_SCRIPT)) {
    const body = match[1] ?? "";
    hashes.push("sha256-" + createHash("sha256").update(body, "utf8").digest("base64"));
  }
  return hashes;
}

export function buildPolicy(hashes) {
  const scriptSrc = ["'self'", ...hashes.map((h) => `'${h}'`)].join(" ");
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests"
  ].join("; ");
}

/** Replaces the placeholder in a _headers file with the full policy. */
export function applyCsp(headersText, hashes) {
  if (!headersText.includes(PLACEHOLDER)) throw new Error(`_headers is missing ${PLACEHOLDER}`);
  return headersText.replace(PLACEHOLDER, buildPolicy(hashes));
}

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return htmlFiles(path);
    return name.endsWith(".html") ? [path] : [];
  });
}

function main() {
  const outDir = fileURLToPath(new URL("../out", import.meta.url));
  const hashes = new Set();
  for (const file of htmlFiles(outDir)) {
    for (const h of collectInlineScriptHashes(readFileSync(file, "utf8"))) hashes.add(h);
  }
  const headersPath = join(outDir, "_headers");
  writeFileSync(headersPath, applyCsp(readFileSync(headersPath, "utf8"), [...hashes].sort()));
  console.log(`CSP: ${hashes.size} inline script hashes written to out/_headers`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
