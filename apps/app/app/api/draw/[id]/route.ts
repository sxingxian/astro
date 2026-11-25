import { getDb } from "@/lib/db";
import { readerActor } from "@/lib/draw/actor";
import { DrawError } from "@/lib/draw/errors";
import { drawFailure } from "@/lib/draw/respond";
import { getReading } from "@/lib/draw/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const actor = await readerActor(request);
    if (!actor) throw new DrawError("not_found");
    return Response.json(await getReading(getDb(), actor, id), { headers: { "cache-control": "private, no-store" } });
  } catch (e) {
    return drawFailure(e);
  }
}
