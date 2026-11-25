import { z } from "zod";
import { getDb } from "@/lib/db";
import { json, mutation } from "@/lib/http";
import { NOTE_MAX, setNote } from "@/lib/journal";
import { journalAction } from "@/lib/journal-route";

export const dynamic = "force-dynamic";

const idFrom = (request: Request) => new URL(request.url).pathname.split("/").at(-2) ?? "";

export const POST = mutation(z.object({ body: z.string().max(NOTE_MAX + 200) }), ({ request, user, body }) =>
  journalAction(async () => {
    await setNote(getDb(), user.id, idFrom(request), body.body);
    return json({ ok: true });
  })
);
