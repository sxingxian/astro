import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createMutation } from "../src/http";

describe("createMutation", () => {
  it("answers 500 on an unexpected error and logs only its kind, never a failed query's values", async () => {
    const mutation = createMutation({ allowedOrigin: () => "https://app.example", getUser: async () => ({ id: "u" }) });
    const route = mutation(z.object({}), async () => {
      throw Object.assign(new Error("Failed query: update session … params: secret-token-123"), { name: "DrizzleQueryError" });
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await route(new Request("https://app.example/x", { method: "POST", headers: { origin: "https://app.example" }, body: "{}" }));
    const written = spy.mock.calls.flat().map(String).join(" ");
    spy.mockRestore();
    expect(res.status).toBe(500);
    expect(written).toContain("DrizzleQueryError");
    expect(written).not.toContain("secret-token-123");
  });
});
