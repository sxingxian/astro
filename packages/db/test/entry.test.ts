import { describe, expect, it } from "vitest";
import * as root from "../src/index";

describe("@astro/db entry points", () => {
  it("keeps Neon's driver out of the main entry, so the Next.js apps don't load it", () => {
    expect("createHttpDb" in root).toBe(false);
    expect(typeof root.rowsOf).toBe("function");
  });

  it("offers the HTTPS client on its own entry", async () => {
    const http = await import("@astro/db/http");
    expect(typeof http.createHttpDb).toBe("function");
  });
});
