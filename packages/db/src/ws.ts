import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import type { AnyDb } from "./rows";
import * as schema from "./schema";

/**
 * A Drizzle client on Neon's WebSocket driver, for the few requests that need an interactive transaction (an
 * advisory lock, read-then-write). One connection, opened for this request; call `end()` when the request is done
 * (in a Worker, through `ctx.waitUntil`). Everything else should use `@astro/db/http`, which opens nothing.
 * `wsProxy` is for local runs and tests only (see `neonWsOverPostgres`).
 */
export function createWsDb(connectionString: string, opts: { wsProxy?: string } = {}): { db: AnyDb; end: () => Promise<void> } {
  if (opts.wsProxy) {
    const proxy = opts.wsProxy;
    neonConfig.wsProxy = () => proxy;
    neonConfig.useSecureWebSocket = false;
    neonConfig.pipelineTLS = false;
    neonConfig.pipelineConnect = false;
  }
  if (typeof WebSocket === "undefined") throw new Error("createWsDb needs a global WebSocket (Workers and Node 22+ have one)");
  const pool = new Pool({ connectionString, max: 1 });
  return { db: drizzle({ client: pool, schema }) as unknown as AnyDb, end: () => pool.end() };
}
