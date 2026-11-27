import { catalogue, type AppKey, type EmailKey } from "@astro/copy";
import { and, desc, eq, gt, schema, type Db } from "@astro/db";
import { headers } from "next/headers";
import { cache } from "react";
import { getDb } from "./db";

type Kind = "app" | "meanings";
export type T = (key: AppKey | EmailKey, values?: Readonly<Record<string, string>>) => string;

const TTL_MS = 60_000;
const live = new Map<Kind, { snapshot: Record<string, string>; at: number }>();
const PREVIEW_ID = /^[A-Za-z0-9_-]{22}$/;

/** The newest published snapshot of a kind. Each isolate keeps it for a minute, so a publish shows within ~60 s. */
export async function liveSnapshot(db: Db, kind: Kind, useCache = true): Promise<Record<string, string>> {
  const hit = live.get(kind);
  if (useCache && hit && Date.now() - hit.at < TTL_MS) return hit.snapshot;
  const [row] = await db.select({ snapshot: schema.textVersion.snapshot }).from(schema.textVersion).where(eq(schema.textVersion.kind, kind)).orderBy(desc(schema.textVersion.id)).limit(1);
  const snapshot = row?.snapshot ?? {};
  live.set(kind, { snapshot, at: Date.now() });
  return snapshot;
}

/** A draft snapshot shown to whoever has a valid, unexpired preview id. Never cached. */
export async function previewSnapshot(db: Db, kind: Kind, previewId: string | null | undefined): Promise<Record<string, string> | null> {
  if (!previewId || !PREVIEW_ID.test(previewId)) return null;
  const [row] = await db
    .select({ snapshot: schema.textPreview.snapshot })
    .from(schema.textPreview)
    .where(and(eq(schema.textPreview.id, previewId), eq(schema.textPreview.kind, kind), gt(schema.textPreview.expiresAt, new Date())))
    .limit(1);
  return row?.snapshot ?? null;
}

const fill = (text: string, values?: Readonly<Record<string, string>>) => (values ? text.replace(/\{([a-z][a-z0-9_]*)\}/g, (m, k: string) => values[k] ?? m) : text);

/** The app's and emails' wording: published overrides (or a preview) over the catalogue defaults. */
export async function loadCopy(db: Db, opts: { cache?: boolean; previewId?: string | null } = {}): Promise<T> {
  const overrides = (await previewSnapshot(db, "app", opts.previewId)) ?? (await liveSnapshot(db, "app", opts.cache ?? true));
  return (key, values) => fill(overrides[key] ?? catalogue[key].default, values);
}

/** The preview id the proxy passed on from ?astro-preview=, if any. */
export async function previewId(): Promise<string | null> {
  return (await headers()).get("x-astro-preview");
}

/** Whether this request carries an unexpired preview id (of any kind), so the layout shows the preview bar. */
export const getPreviewing = cache(async (): Promise<boolean> => {
  const id = await previewId();
  if (!id || !PREVIEW_ID.test(id)) return false;
  const rows = await getDb().select({ id: schema.textPreview.id }).from(schema.textPreview).where(and(eq(schema.textPreview.id, id), gt(schema.textPreview.expiresAt, new Date()))).limit(1);
  return rows.length > 0;
});

/** For server components and routes. Client components use useT() (CopyProvider in the root layout). */
export const getCopy = cache(async (): Promise<T> => loadCopy(getDb(), { previewId: await previewId() }));

/** Every app string, resolved, for the client provider. Placeholders stay for useT() to fill. */
export const getAppStrings = cache(async (): Promise<Record<string, string>> => {
  const t = await getCopy();
  return Object.fromEntries((Object.keys(catalogue) as (AppKey | EmailKey)[]).filter((k) => k.startsWith("app.")).map((k) => [k, t(k)]));
});
