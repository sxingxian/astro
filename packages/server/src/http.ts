import { APIError } from "better-auth/api";
import type { z } from "zod";
import { assertSameOrigin, forbidden, ForbiddenOrigin } from "./origin";

export const json = (data: unknown, status = 200, headers?: HeadersInit) => Response.json(data, { status, headers });
export const fail = (status: number, error: string, extra?: Record<string, unknown>) => json({ error, ...extra }, status);

/** Copies Set-Cookie headers from a Better Auth call onto our response. */
export function withCookies(res: Response, from?: Headers | null): Response {
  for (const c of from?.getSetCookie?.() ?? []) res.headers.append("set-cookie", c);
  return res;
}

/** An error a route throws on purpose: its status and code go back to the browser as-is. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string
  ) {
    super(code);
  }
}

interface MutationConfig<U> {
  /** The only origin allowed to call state-changing routes. */
  allowedOrigin: () => string;
  /** The signed-in person, or null. */
  getUser: (headers: Headers) => Promise<U | null>;
}

/**
 * Builds `mutation(schema, handler)`: same-origin check, signed-in person, Zod-validated JSON body.
 * Better Auth errors and HttpErrors come back as their status with a safe code; anything else is a 500 with no detail.
 */
export function createMutation<U>({ allowedOrigin, getUser }: MutationConfig<U>) {
  return function mutation<S extends z.ZodType>(
    schema: S,
    handler: (ctx: { request: Request; user: U; body: z.infer<S> }) => Promise<Response>,
    /** Runs before the body is read, so someone without permission learns nothing about the inputs. Throw to refuse. */
    authorize?: (user: U) => void
  ) {
    return async (request: Request): Promise<Response> => {
      try {
        assertSameOrigin(request, allowedOrigin());
        const user = await getUser(request.headers);
        if (!user) return fail(401, "signed_out");
        authorize?.(user);
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return fail(400, "invalid_input");
        return await handler({ request, user, body: parsed.data });
      } catch (e) {
        if (e instanceof ForbiddenOrigin) return forbidden();
        if (e instanceof HttpError) return fail(e.status, e.code);
        if (e instanceof APIError) return fail(e.statusCode, e.body?.code ? String(e.body.code).toLowerCase() : "request_failed", { message: e.body?.message });
        // The kind only: a failed query's message carries its values.
        console.error("route failed", e instanceof Error ? e.name : "error");
        return fail(500, "server_error");
      }
    };
  };
}
