import { APIError } from "better-auth/api";
import { z } from "zod";
import { getSessionUser, type SessionUser } from "./auth";
import { assertSameOrigin, forbidden, ForbiddenOrigin } from "./origin";

export const json = (data: unknown, status = 200, headers?: HeadersInit) => Response.json(data, { status, headers });
export const fail = (status: number, error: string, extra?: Record<string, unknown>) => json({ error, ...extra }, status);

/** Copies Set-Cookie headers from a Better Auth call onto our response. */
export function withCookies(res: Response, from?: Headers | null): Response {
  for (const c of from?.getSetCookie?.() ?? []) res.headers.append("set-cookie", c);
  return res;
}

type Handler<T> = (ctx: { request: Request; user: SessionUser; body: T }) => Promise<Response>;

/**
 * A state-changing route: same-origin check, signed-in person, Zod-validated JSON body.
 * Better Auth errors come back as their status with a safe message; anything else is a 500 with no detail.
 */
export function mutation<S extends z.ZodType>(schema: S, handler: Handler<z.infer<S>>) {
  return async (request: Request): Promise<Response> => {
    try {
      assertSameOrigin(request);
      const user = await getSessionUser(request.headers);
      if (!user) return fail(401, "signed_out");
      const parsed = schema.safeParse(await request.json().catch(() => null));
      if (!parsed.success) return fail(400, "invalid_input");
      return await handler({ request, user, body: parsed.data });
    } catch (e) {
      if (e instanceof ForbiddenOrigin) return forbidden();
      if (e instanceof APIError) return fail(e.statusCode, e.body?.code ? String(e.body.code).toLowerCase() : "request_failed", { message: e.body?.message });
      console.error("route failed", e instanceof Error ? e.message : e);
      return fail(500, "server_error");
    }
  };
}
