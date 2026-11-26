import { assertSameOrigin as assertOrigin } from "@astro/server";
import { getEnv } from "./env";

export { ForbiddenOrigin, forbidden } from "@astro/server";

/** Throws unless the request's Origin is the app's own. Call at the top of every state-changing route. */
export function assertSameOrigin(request: Request, appUrl: string = getEnv().APP_URL): void {
  assertOrigin(request, appUrl);
}
