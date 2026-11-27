import { z } from "zod";
import { getDb } from "@/lib/db";
import { json, mutation } from "@/lib/http";
import { saveEntry } from "@/lib/reader-log";

export const dynamic = "force-dynamic";

/** Records a reading in the signed-in reader's own log. saveEntry checks the role and validates the entry. */
export const POST = mutation(z.record(z.string(), z.unknown()), async ({ user, body }) => json({ id: await saveEntry(getDb(), user.id, body) }));
