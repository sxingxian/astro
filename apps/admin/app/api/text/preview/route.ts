import { z } from "zod";
import { getDb } from "@/lib/db";
import { json, mutation } from "@/lib/http";
import { createPreview } from "@/lib/text";

export const dynamic = "force-dynamic";

const body = z.object({ kind: z.enum(["app", "meanings", "terms", "privacy", "guidelines"]) });

/** Saves the current drafts as a 30-minute preview and returns its id for ?astro-preview=. */
export const POST = mutation(body, async ({ user, body }) => json(await createPreview(getDb(), user, body.kind, new Date())));
