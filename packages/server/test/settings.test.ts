import { describe, expect, it } from "vitest";
import { parseSetting, SETTINGS } from "../src/settings";

describe("settings registry", () => {
  it("rejects values outside each setting's limits", () => {
    expect(parseSetting("reversal_rate", 1.5).success).toBe(false);
    expect(parseSetting("reversal_rate", 0.25).success).toBe(true);
    expect(parseSetting("guest_daily_cap", 0).success).toBe(false);
    expect(parseSetting("guest_daily_cap", 21).success).toBe(false);
    expect(parseSetting("guest_daily_cap", 2.5).success).toBe(false);
  });

  it("accepts only https social links, at most 6", () => {
    expect(parseSetting("social_links", ["http://instagram.com/astro"]).success).toBe(false);
    expect(parseSetting("social_links", ["javascript:alert(1)"]).success).toBe(false);
    expect(parseSetting("social_links", ["https://instagram.com/astro"]).success).toBe(true);
    expect(parseSetting("social_links", Array(7).fill("https://example.com")).success).toBe(false);
  });

  it("has a valid default for every setting, and an action that guards it", () => {
    for (const [key, def] of Object.entries(SETTINGS)) {
      expect(parseSetting(key as keyof typeof SETTINGS, def.default).success, key).toBe(true);
      expect(def.action, key).toMatch(/^(settings|ai)\.edit$/);
    }
    expect(SETTINGS.ai_daily_cap_usd.action).toBe("ai.edit");
    expect(SETTINGS.maintenance_mode.action).toBe("settings.edit");
  });

  it("allows an empty contact email but not a malformed one", () => {
    expect(parseSetting("contact_email", "").success).toBe(true);
    expect(parseSetting("contact_email", "not-an-email").success).toBe(false);
  });
});
