import { readFileSync } from "node:fs";
import { join } from "node:path";
import { catalogue, type LandingKey } from "@astro/copy";

interface Published {
  version: number;
  overrides: Record<string, string>;
}

let cached: Published | null = null;

/**
 * The wording published from the admin portal, written to content/published.json by scripts/fetch-copy.mjs before
 * the build (already checked against the catalogue there). Read at build time only: these components never run in
 * the browser. A production build without the file stops rather than quietly using the defaults.
 */
function published(): Published {
  if (cached) return cached;
  const path = process.env.COPY_PUBLISHED_PATH ?? join(process.cwd(), "content/published.json");
  try {
    cached = JSON.parse(readFileSync(path, "utf8")) as Published;
  } catch {
    if (process.env.NODE_ENV === "production") throw new Error(`${path} is missing: the build runs scripts/fetch-copy.mjs first`);
    cached = { version: 0, overrides: {} };
  }
  return cached;
}

/** One piece of landing wording: the published override, or the catalogue default. Rendered as text, never HTML. */
export const copy = (key: LandingKey): string => published().overrides[key] ?? catalogue[key].default;

/** Headings written over several lines in the portal, one string per line. */
export const copyLines = (key: LandingKey): string[] => copy(key).split(/\r?\n/);

export const copyVersion = (): number => published().version;
