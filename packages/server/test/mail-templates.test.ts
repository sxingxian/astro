import { describe, expect, it } from "vitest";
import { aiKeyChangedEmail, inviteEmail, verifyEmail, type EmailT } from "../src/mail-templates";

describe("email templates", () => {
  it("default to the launch wording", () => {
    const m = verifyEmail("a@example.com", "https://x.test/v");
    expect(m.subject).toBe("Confirm your email for Astro");
    expect(m.text).toBe("Confirm your email\n\nWelcome to Astro. Confirm your email address to finish creating your account.\nThis link expires in one hour.\n\nhttps://x.test/v\n");
    expect(m.html).toContain("You&#39;re receiving this because of activity on your Astro account.");
    const inv = inviteEmail("a@example.com", "moderator", "https://x.test/i", new Date("2026-12-01T00:00:00Z"));
    expect(inv.text).toContain("You're invited to join Astro as a moderator");
    expect(inv.text).toContain("This invitation expires on 1 Dec 2026.");
    expect(aiKeyChangedEmail("o@example.com", { service: "OpenAI", last4: "abcd", by: "b@example.com", at: new Date("2026-12-01T00:00:00Z") }).text).toContain("The key for OpenAI was replaced by b@example.com on 1 Dec 2026. It now ends in abcd.");
  });

  it("use published wording, filled and escaped", () => {
    const t: EmailT = (key, values) => (key === "email.verify.title" ? "<b>Hello</b>" : key === "email.invite.title" ? `Join as ${values?.role}` : "x");
    expect(verifyEmail("a@example.com", "https://x.test/v", t).html).toContain("&lt;b&gt;Hello&lt;/b&gt;");
    expect(inviteEmail("a@example.com", "admin", "https://x.test/i", new Date(), t).subject).toBe("x");
    expect(inviteEmail("a@example.com", "admin", "https://x.test/i", new Date(), t).text).toContain("Join as x");
  });
});
