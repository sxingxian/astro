import { describe, expect, it } from "vitest";
import { pickServices, validateRoles, type RoleService, type Slot } from "../src/ai/roles";

const now = new Date("2026-11-27T12:00:00Z");
const svc = (id: string, company: string, extra: Partial<RoleService> = {}): RoleService => ({ id, name: id, company, enabled: true, lastTestOk: true, cooldownUntil: null, ...extra });
const services = [svc("claude", "Anthropic"), svc("claude2", "Anthropic"), svc("gpt", "OpenAI"), svc("gemini", "Google"), svc("mistral", "Mistral AI"), svc("deepseek", "DeepSeek")];
const slots = (writer: string[], c1: string[], c2: string[]): Slot[] => [
  ...writer.map((serviceId, position) => ({ role: "writer" as const, position, serviceId })),
  ...c1.map((serviceId, position) => ({ role: "checker_1" as const, position, serviceId })),
  ...c2.map((serviceId, position) => ({ role: "checker_2" as const, position, serviceId }))
];

describe("validateRoles", () => {
  it("needs a main service and 2 fallbacks in every role", () => {
    const r = validateRoles(slots(["claude", "mistral"], ["gpt", "gemini", "deepseek"], ["gemini", "gpt", "mistral"]), services);
    expect(r.ok).toBe(false);
    expect(r.errors).toContain("too_few:writer");
  });

  it("refuses services that are off or haven't passed a test", () => {
    const list = services.map((s) => (s.id === "deepseek" ? { ...s, lastTestOk: false } : s.id === "mistral" ? { ...s, enabled: false } : s));
    const r = validateRoles(slots(["claude", "mistral", "deepseek"], ["gpt", "gemini", "deepseek"], ["gemini", "gpt", "claude"]), list);
    expect(r.errors).toEqual(expect.arrayContaining(["not_ready:mistral", "not_ready:deepseek"]));
  });

  it("needs at least 3 companies, and warns when there are exactly 3", () => {
    const two = validateRoles(slots(["claude", "claude2", "gpt"], ["gpt", "claude", "claude2"], ["claude", "gpt", "claude2"]), services);
    expect(two.errors).toContain("too_few_companies");
    const three = validateRoles(slots(["claude", "gpt", "gemini"], ["gpt", "gemini", "claude"], ["gemini", "claude", "gpt"]), services);
    expect(three).toEqual({ ok: true, errors: [], warnings: ["fragile"] });
  });

  it("is happy with 5 companies, all tested", () => {
    expect(validateRoles(slots(["claude", "mistral", "deepseek"], ["gpt", "gemini", "deepseek"], ["gemini", "gpt", "mistral"]), services)).toEqual({ ok: true, errors: [], warnings: [] });
  });

  it("refuses the same service twice in one role", () => {
    expect(validateRoles(slots(["claude", "claude", "deepseek"], ["gpt", "gemini", "deepseek"], ["gemini", "gpt", "mistral"]), services).errors).toContain("duplicate:writer");
  });
});

describe("pickServices", () => {
  it("never uses one company twice: a checker whose main shares the writer's company falls back", () => {
    const picked = pickServices(slots(["claude", "mistral", "deepseek"], ["claude2", "claude", "gpt"], ["gemini", "gpt", "mistral"]), services, now);
    expect(picked).toEqual({ writer: "claude", checker_1: "gpt", checker_2: "gemini" });
  });

  it("skips a service that is cooling down", () => {
    const list = services.map((s) => (s.id === "claude" ? { ...s, cooldownUntil: new Date(now.getTime() + 60_000) } : s));
    expect(pickServices(slots(["claude", "mistral", "deepseek"], ["gpt", "gemini", "deepseek"], ["gemini", "gpt", "mistral"]), list, now)?.writer).toBe("mistral");
  });

  it("uses a service whose cooldown has ended", () => {
    const list = services.map((s) => (s.id === "claude" ? { ...s, cooldownUntil: new Date(now.getTime() - 1) } : s));
    expect(pickServices(slots(["claude", "mistral", "deepseek"], ["gpt", "gemini", "deepseek"], ["gemini", "gpt", "mistral"]), list, now)?.writer).toBe("claude");
  });

  it("returns null when a role has nothing left from an unused company", () => {
    expect(pickServices(slots(["claude", "mistral", "deepseek"], ["gpt", "gemini", "deepseek"], ["claude2", "gpt", "claude"]), services, now)).toBeNull();
  });
});
