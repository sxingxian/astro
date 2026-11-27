import { catalogue, parseDoc } from "@astro/copy";
import { createDb } from "@astro/db";
import { resetAndMigrate } from "@astro/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadLegalPage } from "@/lib/legal";

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST is not set");
const db = createDb(url);
const page = (text: string) => JSON.stringify({ v: 1, blocks: [{ t: "h2", c: [{ t: "text", text }] }] });
const first = (doc: { blocks: unknown[] }) => JSON.stringify(doc.blocks[0]);

beforeAll(async () => {
  await resetAndMigrate(url);
});
afterAll(async () => {
  await db.$client.end();
});

describe("loadLegalPage", () => {
  it("uses the default document when nothing is published", async () => {
    const r = await loadLegalPage(db, "terms", null, { cache: false });
    expect(r.version).toBe(0);
    expect(r.publishedAt).toBeNull();
    expect(r.doc).toEqual((parseDoc(catalogue["legal.terms"].default) as { doc: unknown }).doc);
  });

  it("uses the newest version of that page only", async () => {
    await db.$client`insert into text_version (kind, snapshot) values ('terms', ${JSON.stringify({ "legal.terms": page("Old terms") })}::jsonb)`;
    const [v] = await db.$client<{ id: string }[]>`insert into text_version (kind, snapshot) values ('terms', ${JSON.stringify({ "legal.terms": page("New terms") })}::jsonb) returning id`;
    await db.$client`insert into text_version (kind, snapshot) values ('privacy', ${JSON.stringify({ "legal.privacy": page("Privacy v1") })}::jsonb)`;
    const r = await loadLegalPage(db, "terms", null, { cache: false });
    expect(r.version).toBe(Number(v!.id));
    expect(r.publishedAt).toBeInstanceOf(Date);
    expect(first(r.doc)).toContain("New terms");
  });

  it("shows a live preview of that page", async () => {
    await db.$client`insert into text_preview (id, kind, snapshot, expires_at) values ('legal-preview-id-00000', 'privacy', ${JSON.stringify({ "legal.privacy": page("Draft privacy") })}::jsonb, now() + interval '30 minutes')`;
    const r = await loadLegalPage(db, "privacy", "legal-preview-id-00000", { cache: false });
    expect(first(r.doc)).toContain("Draft privacy");
    expect(first((await loadLegalPage(db, "terms", "legal-preview-id-00000", { cache: false })).doc)).toContain("New terms");
  });

  it("falls back to the default if a stored document doesn't pass the checks", async () => {
    await db.$client`insert into text_version (kind, snapshot) values ('guidelines', ${JSON.stringify({ "legal.guidelines": "<b>not a document</b>" })}::jsonb)`;
    const r = await loadLegalPage(db, "guidelines", null, { cache: false });
    expect(r.doc).toEqual((parseDoc(catalogue["legal.guidelines"].default) as { doc: unknown }).doc);
  });
});
