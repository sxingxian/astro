import { z } from "zod";
import { getDb } from "@/lib/db";
import { readerActor } from "@/lib/draw/actor";
import { DrawError } from "@/lib/draw/errors";
import { drawFailure } from "@/lib/draw/respond";
import { pick } from "@/lib/draw/service";
import { assertSameOrigin } from "@/lib/origin";

export const dynamic = "force-dynamic";

const Body = z.object({
  sessionId: z.uuid(),
  stage: z.enum(["single", "majors", "minors"]),
  positions: z.array(z.number().int().min(0).max(77)).min(1).max(3)
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = Body.parse(await request.json().catch(() => null));
    const actor = await readerActor(request);
    if (!actor) throw new DrawError("not_found");
    return Response.json(await pick(getDb(), actor, body.sessionId, body.stage, body.positions));
  } catch (e) {
    return drawFailure(e);
  }
}
