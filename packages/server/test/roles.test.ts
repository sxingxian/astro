import { describe, expect, it } from "vitest";
import { ACTIONS, can, canGrant, type Action, type Role } from "../src/roles";

// Design §2 (owner-approved 26 Nov), one row per action: [owner, admin, moderator, reader].
const MATRIX: Record<Action, [boolean, boolean, boolean, boolean]> = {
  "dashboard.view": [true, true, true, false],
  "text.edit": [true, true, false, false],
  "text.publish": [true, true, false, false],
  "meanings.view": [true, true, false, true],
  "meanings.edit": [true, false, false, false],
  "meanings.publish": [true, false, false, false],
  "settings.edit": [true, true, false, false],
  "ai.edit": [true, false, false, false],
  "team.invite": [true, true, false, false],
  "team.manage": [true, true, false, false],
  "users.help": [true, true, true, false],
  "audit.view": [true, true, false, false],
  "requests.manage": [true, true, true, false]
};
const ROLES: Role[] = ["owner", "admin", "moderator", "reader"];

describe("can", () => {
  it("matches the approved access table for every role and action", () => {
    expect([...ACTIONS].sort()).toEqual(Object.keys(MATRIX).sort());
    for (const action of ACTIONS) ROLES.forEach((role, i) => expect(can(role, action), `${role} ${action}`).toBe(MATRIX[action][i]));
  });
});

describe("canGrant", () => {
  it("lets the owner grant admin, moderator and reader, and an admin only moderator and reader", () => {
    expect(["admin", "moderator", "reader"].every((r) => canGrant("owner", r as Role))).toBe(true);
    expect(canGrant("admin", "moderator") && canGrant("admin", "reader")).toBe(true);
    expect(canGrant("admin", "admin")).toBe(false);
  });

  it("never lets anyone grant owner, and gives moderators and readers nothing", () => {
    for (const r of ROLES) expect(canGrant(r, "owner")).toBe(false);
    for (const t of ROLES) expect(canGrant("moderator", t) || canGrant("reader", t)).toBe(false);
  });
});
