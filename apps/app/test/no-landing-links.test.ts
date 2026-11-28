import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { catalogue } from "@astro/copy";
import { describe, expect, it } from "vitest";

const LANDING = "astro.midnightpoetry.studio";
const root = join(__dirname, "..");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

describe("the app never sends people to the landing site", () => {
  it("has no landing links in its code", () => {
    // The shipped screens (apps/web) and the components and helpers they share from here.
    const dirs = [join(root, "components"), join(root, "lib"), join(root, "../web/src")];
    const hits = dirs.flatMap(files).filter((f) => readFileSync(f, "utf8").includes(LANDING));
    expect(hits).toEqual([]);
  });
  it("has no landing links in its default wording", () => {
    const hits = Object.values(catalogue).filter((e) => (e.surface === "app" || e.surface === "legal") && e.default.includes(LANDING));
    expect(hits.map((e) => e.key)).toEqual([]);
  });
});
