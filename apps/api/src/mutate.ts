import { DrawError } from "@astro/app-core/draw/errors";
import { HttpError } from "@astro/server";
import { APIError } from "better-auth/api";
import type { z } from "zod";
import { who, whoFresh, type C, type Who } from "./context";

export const fail = (c: C, status: number, error: string, extra?: Record<string, unknown>) => c.json({ error, ...extra }, status as never);

/** True when the request comes from the app's own pages (every state-changing route checks this first). */
export const sameOrigin = (c: C) => c.req.header("origin") === new URL(c.get("env").APP_URL).origin;

/**
 * A state-changing route for a signed-in person: same-origin check, the person (from the pass, or always from
 * Neon with `fresh` for sensitive actions), a Zod-checked JSON body. Known errors keep their status and code;
 * anything else is a 500 with no detail.
 */
export function mutation<S extends z.ZodType>(schema: S, handler: (c: C, x: { user: Who; body: z.infer<S> }) => Promise<Response>, opts: { fresh?: boolean } = {}) {
  return async (c: C): Promise<Response> => {
    if (!sameOrigin(c)) return fail(c, 403, "forbidden");
    try {
      const user = await (opts.fresh ? whoFresh(c) : who(c));
      if (!user) return fail(c, 401, "signed_out");
      const parsed = schema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return fail(c, 400, "invalid_input");
      return await handler(c, { user, body: parsed.data });
    } catch (e) {
      return failure(c, e);
    }
  };
}

/** Maps known errors to safe JSON. Nothing here carries a deck order, orientation, salt or query value. */
export function failure(c: C, e: unknown): Response {
  if (e instanceof DrawError) return c.json({ error: e.code, ...e.details }, e.status as never);
  if (e instanceof HttpError) return fail(c, e.status, e.code);
  if (e instanceof APIError) return fail(c, e.statusCode, e.body?.code ? String(e.body.code).toLowerCase() : "request_failed", { message: e.body?.message });
  if ((e as { name?: string })?.name === "ZodError") return fail(c, 400, "invalid_input");
  throw e;
}
