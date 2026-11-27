import { catalogue, parseDoc, type Doc } from "@astro/copy";
import { and, desc, eq, gt, schema, type Db } from "@astro/db";

export type LegalPage = "terms" | "privacy" | "guidelines";

const TTL_MS = 60_000;
const READ_TIMEOUT_MS = 1_500;
const PREVIEW_ID = /^[A-Za-z0-9_-]{22}$/;
const live = new Map<LegalPage, { value: Published; at: number }>();

interface Published {
  value: string | null;
  version: number;
  publishedAt: Date | null;
}

const withTimeout = <V>(p: Promise<V>, ms: number) =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms))]);

async function published(db: Db, page: LegalPage, useCache: boolean): Promise<Published> {
  const hit = live.get(page);
  if (useCache && hit && Date.now() - hit.at < TTL_MS) return hit.value;
  try {
    const [row] = await withTimeout(
      db.select({ id: schema.textVersion.id, snapshot: schema.textVersion.snapshot, at: schema.textVersion.publishedAt }).from(schema.textVersion).where(eq(schema.textVersion.kind, page)).orderBy(desc(schema.textVersion.id)).limit(1),
      READ_TIMEOUT_MS
    );
    const value: Published = row ? { value: row.snapshot[`legal.${page}`] ?? null, version: row.id, publishedAt: row.at } : { value: null, version: 0, publishedAt: null };
    live.set(page, { value, at: Date.now() });
    return value;
  } catch (e) {
    console.error(`published ${page} page unavailable, using the last known version`, e);
    return hit?.value ?? { value: null, version: 0, publishedAt: null };
  }
}

async function preview(db: Db, page: LegalPage, previewId: string | null | undefined): Promise<string | null> {
  if (!previewId || !PREVIEW_ID.test(previewId)) return null;
  try {
    const [row] = await withTimeout(
      db.select({ snapshot: schema.textPreview.snapshot }).from(schema.textPreview).where(and(eq(schema.textPreview.id, previewId), eq(schema.textPreview.kind, page), gt(schema.textPreview.expiresAt, new Date()))).limit(1),
      READ_TIMEOUT_MS
    );
    return row?.snapshot[`legal.${page}`] ?? null;
  } catch {
    return null;
  }
}

const defaultDoc = (page: LegalPage): Doc => (parseDoc(catalogue[`legal.${page}`].default) as { ok: true; doc: Doc }).doc;

/**
 * A legal page's document: a valid preview, else the newest published version, else the default. A stored value
 * that fails the document checks is never shown; the default is used instead.
 */
export async function loadLegalPage(db: Db, page: LegalPage, previewId?: string | null, opts: { cache?: boolean } = {}): Promise<{ doc: Doc; version: number; publishedAt: Date | null }> {
  const draft = await preview(db, page, previewId);
  const pub = await published(db, page, opts.cache ?? true);
  const raw = draft ?? pub.value;
  const parsed = raw === null ? null : parseDoc(raw);
  return { doc: parsed?.ok ? parsed.doc : defaultDoc(page), version: pub.version, publishedAt: pub.publishedAt };
}
