import { authOptions as coreOptions, type AuthDeps } from "@astro/app-core/auth-options";
import type { parseEnv } from "./env";
import { alreadyRegistered, resetPassword, verifyEmail } from "./mail-templates";

export * from "@astro/app-core/auth-options";

/** The core auth options with this app's email templates (published wording read through Next's request cache). */
export const authOptions = (env: Omit<ReturnType<typeof parseEnv>, "MAINTENANCE_CACHE_SECONDS">, deps: AuthDeps) => coreOptions(env, deps, { verifyEmail, resetPassword, alreadyRegistered });
