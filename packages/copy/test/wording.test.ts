import { describe, expect, it } from "vitest";
import { catalogue } from "../src/index.ts";

// The Stage 2 wording rules (docs/spec/2026-11-28-stage2-design.md): one name per thing, British spelling, finished
// sentences. Checked on the built-in defaults; the owner can still change any line in admin.

const entries = Object.values(catalogue).filter((e) => e.surface === "app" || e.surface === "email");
const text = (key: string) => catalogue[key as keyof typeof catalogue].default;

describe("wording", () => {
  it("calls signing up one thing: 'Create a free account'", () => {
    for (const e of entries) {
      expect(e.default, e.key).not.toMatch(/\bSign up free\b/i);
      expect(e.default, e.key).not.toMatch(/^Create (an )?account$/);
    }
    for (const key of ["app.today.sign_up", "app.sign_up.button", "app.sign_in.create_link", "app.reading.keep_button", "app.ask.guest_cta", "app.invite.create"]) expect(text(key), key).toBe("Create a free account");
  });

  it("uses British spelling", () => {
    const us = /\b(colou?r(?<!colour)|favorite|center|organiz\w*|recogniz\w*|realiz\w*|analyz\w*|behavior|apologiz\w*|customiz\w*|personaliz\w*|prioritiz\w*|license)\b/i;
    for (const e of entries) expect(e.default, e.key).not.toMatch(us);
  });

  it("has no stray spaces at the end of a line", () => {
    for (const e of entries) expect(e.default, e.key).toBe(e.default.trimEnd());
  });

  it("writes finished sentences where the audit found broken ones", () => {
    expect(text("app.common.check_failed")).toBe("Verification failed. Please try again.");
    expect(text("app.today.drawn_note")).toBe("Drawn today. Your next draw opens at {time} on {day}.");
    expect(text("app.patterns.checked_in_one")).toMatch(/of 1 reading /); // not "of 1 readings"
    expect(text("app.patterns.checked_in_none")).toBeTruthy();
  });
});
