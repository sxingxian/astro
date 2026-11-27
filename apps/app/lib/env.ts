import { getCloudflareContext } from "@opennextjs/cloudflare";
import { parseEnv, type AppVars } from "@astro/app-core/env";

export { parseEnv };
export type Env = AppVars & { HYPERDRIVE: Hyperdrive; GUEST_DRAWS: RateLimit };

export function getEnv(): Env {
  const { env } = getCloudflareContext();
  const raw = env as unknown as Record<string, unknown> & { HYPERDRIVE: Hyperdrive; GUEST_DRAWS: RateLimit };
  return { ...parseEnv(raw), HYPERDRIVE: raw.HYPERDRIVE, GUEST_DRAWS: raw.GUEST_DRAWS };
}
