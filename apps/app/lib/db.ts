import { createDb, type Db } from "@astro/db";
import { cache } from "react";
import { getEnv } from "./env";

/**
 * One database client per request, through Hyperdrive. Workers sockets belong to a single
 * request, so the client is never shared or reused across requests; Hyperdrive pools upstream.
 */
export const getDb = cache((): Db => createDb(getEnv().HYPERDRIVE.connectionString));
