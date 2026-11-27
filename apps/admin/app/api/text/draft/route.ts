import { z } from "zod";
import { getDb } from "@/lib/db";
import { json, mutation } from "@/lib/http";
import { saveDraft, useDefault } from "@/lib/text";

export const dynamic = "force-dynamic";

// Values are checked against each entry's own limit in saveDraft; this only caps the request size.
const body = z.union([z.object({ key: z.string().max(120), value: z.string().max(5000) }), z.object({ key: z.string().max(120), useDefault: z.literal(true) })]);

/** Saves a draft override, or removes it ("Use default"). Permissions are checked per key's kind. */
export const POST = mutation(body, async ({ user, body }) => json("value" in body ? await saveDraft(getDb(), user, body.key, body.value) : await useDefault(getDb(), user, body.key)));
