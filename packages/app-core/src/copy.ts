import { catalogue } from "@astro/copy";
import { and, desc, eq, gt, schema, type AnyDb } from "@astro/db";

export type Kind = "app" | "meanings" | "terms" | "privacy" | "guidelines";
export type { T } from "@astro/copy";
import type { T } from "@astro/copy";

const TTL_MS = 60_000;
/** After a failed read, the last wording is kept and the database is asked again this much later. */
const RETRY_MS = 5_000;
export const READ_TIMEOUT_MS = 1_500;
const live = new Map<Kind, { snapshot: Record<string, string>; at: number }>();
export const PREVIEW_ID = /^[A-Za-z0-9_-]{22}$/;

export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms))]);
}

/**
 * The newest published snapshot of a kind. Each isolate keeps it for a minute, so a publish shows within ~60 s.
 * If the database can't be read, pages keep working: the last wording this isolate saw (or the defaults) is used,
 * and the read is tried again a few seconds later rather than on every request.
 */
export async function liveSnapshot(db: AnyDb, kind: Kind, useCache = true): Promise<Record<string, string>> {
  const hit = live.get(kind);
  if (useCache && liveFresh(kind)) return hit!.snapshot;
  try {
    const [row] = await withTimeout(
      db.select({ snapshot: schema.textVersion.snapshot }).from(schema.textVersion).where(eq(schema.textVersion.kind, kind)).orderBy(desc(schema.textVersion.id)).limit(1),
      READ_TIMEOUT_MS
    );
    const snapshot = row?.snapshot ?? {};
    live.set(kind, { snapshot, at: Date.now() });
    return snapshot;
  } catch (e) {
    console.error(`published ${kind} wording unavailable, using the last known wording`, e instanceof Error ? e.name : "error");
    const snapshot = hit?.snapshot ?? {};
    live.set(kind, { snapshot, at: Date.now() - TTL_MS + RETRY_MS });
    return snapshot;
  }
}

/** Whether this isolate's copy of a kind's published wording is recent enough to use. */
export function liveFresh(kind: Kind): boolean {
  const hit = live.get(kind);
  const age = hit ? Date.now() - hit.at : Infinity;
  return age >= 0 && age < TTL_MS; // an entry dated in the future (the clock moved back) is out of date
}

/** Keeps a snapshot read elsewhere (in a combined query), as `liveSnapshot` would. */
export function rememberLive(kind: Kind, snapshot: Record<string, string>): void {
  live.set(kind, { snapshot, at: Date.now() });
}

/** A draft snapshot shown to whoever has a valid, unexpired preview id. Never cached. */
/** Whether a preview link is current (any kind), so pages show the preview bar only while it is. */
export async function previewLive(db: AnyDb, previewId: string | null | undefined): Promise<boolean> {
  if (!previewId || !PREVIEW_ID.test(previewId)) return false;
  try {
    const rows = await withTimeout(db.select({ id: schema.textPreview.id }).from(schema.textPreview).where(and(eq(schema.textPreview.id, previewId), gt(schema.textPreview.expiresAt, new Date()))).limit(1), READ_TIMEOUT_MS);
    return rows.length > 0;
  } catch {
    return false;
  }
}

export async function previewSnapshot(db: AnyDb, kind: Kind, previewId: string | null | undefined): Promise<Record<string, string> | null> {
  if (!previewId || !PREVIEW_ID.test(previewId)) return null;
  try {
    const [row] = await withTimeout(
      db
        .select({ snapshot: schema.textPreview.snapshot })
        .from(schema.textPreview)
        .where(and(eq(schema.textPreview.id, previewId), eq(schema.textPreview.kind, kind), gt(schema.textPreview.expiresAt, new Date())))
        .limit(1),
      READ_TIMEOUT_MS
    );
    return row?.snapshot ?? null;
  } catch (e) {
    console.error("preview wording unavailable", e instanceof Error ? e.name : "error");
    return null;
  }
}

const fill = (text: string, values?: Readonly<Record<string, string>>) => (values ? text.replace(/\{([a-z][a-z0-9_]*)\}/g, (m, k: string) => values[k] ?? m) : text);

/** The app's and emails' wording: published overrides (or a preview) over the catalogue defaults. */
export async function loadCopy(db: AnyDb, opts: { cache?: boolean; previewId?: string | null } = {}): Promise<T> {
  const overrides = (await previewSnapshot(db, "app", opts.previewId)) ?? (await liveSnapshot(db, "app", opts.cache ?? true));
  return (key, values) => fill(overrides[key] ?? catalogue[key].default, values);
}

/** The preview id the proxy passed on from ?astro-preview=, if any. */
