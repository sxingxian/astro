import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Every date on screen goes through formatDate ("01 Jan 2016"). The browser's own date formatting would follow its
// language setting, so it is allowed only for machine dates ("en-CA" gives YYYY-MM-DD, used as data, not shown).
const roots = [join(__dirname, "../src"), join(__dirname, "../../app/components"), join(__dirname, "../../app/lib")];
const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : /\.tsx?$/.test(f) ? [join(dir, f)] : []));

describe("dates", () => {
  it("are shown only through formatDate", () => {
    const found: string[] = [];
    for (const f of roots.flatMap(files)) {
      readFileSync(f, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (/toLocaleDateString\((?!"en-CA")|month: "(long|short)"/.test(line)) found.push(`${f.split("/apps/")[1]}:${i + 1}`);
        });
    }
    expect(found).toEqual([]);
  });
});
