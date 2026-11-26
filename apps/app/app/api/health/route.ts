import { assertSameOrigin, forbidden, ForbiddenOrigin } from "@/lib/origin";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true });
}

export function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (e) {
    if (e instanceof ForbiddenOrigin) return forbidden();
    throw e;
  }
  return Response.json({ ok: true });
}
