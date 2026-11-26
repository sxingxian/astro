export class ForbiddenOrigin extends Error {}

/** Throws unless the request's Origin is exactly `allowed`'s origin. Call at the top of every state-changing route. */
export function assertSameOrigin(request: Request, allowed: string): void {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(allowed).origin) throw new ForbiddenOrigin();
}

export const forbidden = () => Response.json({ error: "forbidden" }, { status: 403 });
