// Pre-build step: fetch the published landing wording from the app and write content/published.json, which the
// page reads at build time. Any problem fails the build: a page silently built with the default wording would
// undo the owner's published changes.
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";

const DEFAULT_URL = "https://astroapp.midnightpoetry.studio/api/copy/landing";
const TIMEOUT_MS = 10_000;
const Body = z.object({ version: z.number().int().min(0), overrides: z.record(z.string(), z.string()) });

function write(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n");
  renameSync(tmp, path); // all at once: a half-written file is never left behind
}

/** Returns the exit code. Only writes the file when everything checked out. */
export async function run({ env = process.env, fetchFn = fetch, outPath, log = console }) {
  if (env.COPY_SOURCE === "defaults") {
    write(outPath, { version: 0, overrides: {} });
    log.log("fetch-copy: COPY_SOURCE=defaults, building with the default wording");
    return 0;
  }
  const { catalogue, validateOverride } = await import("@astro/copy");
  const url = env.COPY_SOURCE_URL || DEFAULT_URL;
  let res;
  try {
    res = await fetchFn(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    log.error(`fetch-copy: couldn't reach ${url}: ${e instanceof Error ? e.message : e}`);
    return 1;
  }
  if (res.status === 204) {
    write(outPath, { version: 0, overrides: {} });
    log.log("fetch-copy: nothing published yet, building with the default wording");
    return 0;
  }
  if (res.status !== 200) {
    log.error(`fetch-copy: ${url} answered ${res.status}`);
    return 1;
  }
  let parsed;
  try {
    parsed = Body.safeParse(await res.json());
  } catch {
    parsed = { success: false };
  }
  if (!parsed.success) {
    log.error("fetch-copy: the published wording isn't in the expected shape");
    return 1;
  }
  const overrides = {};
  for (const [key, value] of Object.entries(parsed.data.overrides)) {
    const entry = catalogue[key];
    if (!entry || entry.surface !== "landing") {
      log.warn(`fetch-copy: ignoring unknown key ${key}`);
      continue;
    }
    const check = validateOverride(entry, value);
    if (!check.ok) {
      log.error(`fetch-copy: ${key} is invalid (${check.reason})`);
      return 1;
    }
    overrides[key] = value;
  }
  write(outPath, { version: parsed.data.version, overrides });
  log.log(`fetch-copy: wrote version ${parsed.data.version} with ${Object.keys(overrides).length} change(s)`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  if (!process.features?.typescript && process.env.COPY_SOURCE !== "defaults") {
    console.error("fetch-copy: this Node can't read TypeScript. Use Node 22.18 or later (NODE_VERSION=22).");
    process.exit(1);
  }
  const outPath = join(dirname(fileURLToPath(import.meta.url)), "../content/published.json");
  process.exit(await run({ outPath }));
}
