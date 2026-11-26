import { getEnv } from "./env";

export class ForbiddenOrigin extends Error {}

/** Throws unless the request's Origin is the app's own. Call at the top of every state-changing route. */
export function assertSameOrigin(request: Request, appUrl: string = getEnv().APP_URL): void {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(appUrl).origin) throw new ForbiddenOrigin();
}

export const forbidden = () => Response.json({ error: "forbidden" }, { status: 403 });
