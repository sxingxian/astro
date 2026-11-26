import { z } from "zod";
import { getDb } from "@/lib/db";
import { json, mutation } from "@/lib/http";
import { setPrivate } from "@/lib/journal";
import { journalAction } from "@/lib/journal-route";

export const dynamic = "force-dynamic";

const idFrom = (request: Request) => new URL(request.url).pathname.split("/").at(-2) ?? "";

export const POST = mutation(z.object({ value: z.boolean() }), ({ request, user, body }) =>
  journalAction(async () => {
    await setPrivate(getDb(), user.id, idFrom(request), body.value);
    return json({ ok: true });
  })
);
