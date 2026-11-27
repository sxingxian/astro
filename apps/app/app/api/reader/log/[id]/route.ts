import { z } from "zod";
import { getDb } from "@/lib/db";
import { json, mutation } from "@/lib/http";
import { deleteEntry, saveEntry } from "@/lib/reader-log";

export const dynamic = "force-dynamic";

const idFrom = (request: Request) => new URL(request.url).pathname.split("/").at(-1) ?? "";

/** Edits one of the reader's own entries; anyone else's is "not found". */
export const PUT = mutation(z.record(z.string(), z.unknown()), async ({ request, user, body }) => json({ id: await saveEntry(getDb(), user.id, body, idFrom(request)) }));

export const DELETE = mutation(z.object({}), async ({ request, user }) => {
  await deleteEntry(getDb(), user.id, idFrom(request));
  return json({ ok: true });
});
