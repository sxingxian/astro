import { createMutation } from "@astro/server";
import { getSessionUser } from "./auth";
import { getEnv } from "./env";

export { fail, json, withCookies } from "@astro/server";

/** A state-changing app route: same-origin check, signed-in person, Zod-validated JSON body. */
export const mutation = createMutation({ allowedOrigin: () => getEnv().APP_URL, getUser: getSessionUser });
