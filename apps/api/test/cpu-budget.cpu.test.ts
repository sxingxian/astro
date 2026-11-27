import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));
const run = (...args: string[]) => spawnSync("pnpm", ["exec", "tsx", "scripts/cpu-budget.ts", ...args], { cwd: root, encoding: "utf8", env: process.env });

describe("CPU budget check", () => {
  it("fails on a request that burns 30 ms", () => {
    const r = run("--budget", "10", "--runs", "4", "--entry", "test/fixtures/spin-worker.ts", "/api/v2/spin");
    expect(r.stdout).toMatch(/OVER\s+\/api\/v2\/spin/);
    expect(r.status).toBe(1);
  });

  it("fails when a route answers with an error, however cheap", () => {
    const r = run("--budget", "10", "--runs", "3", "/api/v2/nope");
    expect(r.stdout).toMatch(/WRONG\s+\/api\/v2\/nope.*status 404/);
    expect(r.status).toBe(1);
  });

  it("also counts CPU spent in the runtime's native Web Crypto", () => {
    const r = run("--budget", "10", "--runs", "4", "--entry", "test/fixtures/spin-worker.ts", "/api/v2/spin-native");
    expect(r.stdout).toMatch(/OVER\s+\/api\/v2\/spin-native/);
    expect(r.status).toBe(1);
  });

  it("passes for the data Worker's routes at the default budget", () => {
    const r = run();
    expect(r.stdout).toMatch(/ok\s+\/api\/v2\/today \(with pass\)/);
    expect(r.status, r.stdout + r.stderr).toBe(0);
  });
});
