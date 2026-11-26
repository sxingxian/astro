import { describe, expect, it } from "vitest";
import { describeMigrationError } from "../src/migrate";

describe("describeMigrationError", () => {
  it("shows Postgres's own reason and a fix for a missing CREATE permission", () => {
    const err = new Error('Failed query: CREATE SCHEMA IF NOT EXISTS "drizzle"\nparams: ', {
      cause: Object.assign(new Error("permission denied for database neondb"), { code: "42501" })
    });
    const text = describeMigrationError(err);
    expect(text).toContain('CREATE SCHEMA IF NOT EXISTS "drizzle"');
    expect(text).toContain("permission denied for database neondb (42501)");
    expect(text).toContain("GRANT CREATE ON DATABASE");
  });

  it("falls back to the message when there is no cause", () => {
    expect(describeMigrationError(new Error("boom"))).toBe("boom");
    expect(describeMigrationError("plain")).toBe("plain");
  });

  it("never prints a connection string that appears in an error", () => {
    const text = describeMigrationError(new Error("connect failed postgresql://migrator:Secret123@ep-x.neon.tech/neondb"));
    expect(text).not.toContain("Secret123");
    expect(text).toContain("postgresql://migrator:[hidden]@ep-x.neon.tech/neondb");
  });
});
