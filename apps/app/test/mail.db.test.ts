import { createDb, eq, schema } from "@astro/db";
import { describe, expect, it } from "vitest";
import { createMailer } from "@/lib/mail";

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST is not set");

describe("mail", () => {
  it("the outbox driver stores the message instead of sending it", async () => {
    const db = createDb(url);
    const to = `outbox-${Date.now()}@example.com`;
    await createMailer({ driver: "outbox", from: "Astro <hello@example.com>", db }).send({ to, subject: "Hello", text: "Body", html: "<p>Body</p>" });
    const rows = await db.select().from(schema.mailOutbox).where(eq(schema.mailOutbox.to, to));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.subject).toBe("Hello");
    await db.$client.end();
  });

  it("the resend driver needs an API key", () => {
    expect(() => createMailer({ driver: "resend", from: "Astro <hello@example.com>", db: {} as never })).toThrow(/RESEND_API_KEY/);
  });
});
