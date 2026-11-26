import { APIError } from "better-auth/api";
import { ZodError } from "zod";
import { ForbiddenOrigin, forbidden } from "../origin";
import { DrawError } from "./errors";

/** Maps draw failures to safe JSON. Nothing here can contain a deck order, orientation or salt. */
export function drawFailure(e: unknown): Response {
  if (e instanceof DrawError) return Response.json({ error: e.code, ...e.details }, { status: e.status });
  if (e instanceof ForbiddenOrigin) return forbidden();
  if (e instanceof ZodError) return Response.json({ error: "invalid_input" }, { status: 400 });
  if (e instanceof APIError) return Response.json({ error: "auth_failed" }, { status: e.statusCode });
  console.error("draw route failed", e instanceof Error ? e.name : "unknown");
  return Response.json({ error: "server_error" }, { status: 500 });
}
