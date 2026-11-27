import { desc, eq, schema } from "@astro/db";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * The published landing wording, read by the landing build (apps/landing/scripts/fetch-copy.mjs). Public and
 * read-only: published wording is on the landing page anyway. 204 means nothing is published yet.
 */
export async function GET() {
  const [row] = await getDb()
    .select({ id: schema.textVersion.id, snapshot: schema.textVersion.snapshot })
    .from(schema.textVersion)
    .where(eq(schema.textVersion.kind, "landing"))
    .orderBy(desc(schema.textVersion.id))
    .limit(1);
  const headers = { "cache-control": "public, max-age=60" };
  if (!row) return new Response(null, { status: 204, headers });
  return Response.json({ version: row.id, overrides: row.snapshot }, { headers });
}
