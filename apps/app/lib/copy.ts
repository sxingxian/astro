import { headers } from "next/headers";
import { cache } from "react";
import { loadCopy, PREVIEW_ID, READ_TIMEOUT_MS, withTimeout, type T } from "@astro/app-core/copy";
import { catalogue, type AppKey, type EmailKey } from "@astro/copy";
import { and, eq, gt, schema } from "@astro/db";
import { getDb } from "./db";

export * from "@astro/app-core/copy";

export async function previewId(): Promise<string | null> {
  return (await headers()).get("x-astro-preview");
}

/** Whether this request carries an unexpired preview id (of any kind), so the layout shows the preview bar. */
export const getPreviewing = cache(async (): Promise<boolean> => {
  const id = await previewId();
  if (!id || !PREVIEW_ID.test(id)) return false;
  try {
    const rows = await withTimeout(getDb().select({ id: schema.textPreview.id }).from(schema.textPreview).where(and(eq(schema.textPreview.id, id), gt(schema.textPreview.expiresAt, new Date()))).limit(1), READ_TIMEOUT_MS);
    return rows.length > 0;
  } catch {
    return false;
  }
});

/** For server components and routes. Client components use useT() (CopyProvider in the root layout). */
export const getCopy = cache(async (): Promise<T> => loadCopy(getDb(), { previewId: await previewId() }));

/** Every app string, resolved, for the client provider. Placeholders stay for useT() to fill. */
export const getAppStrings = cache(async (): Promise<Record<string, string>> => {
  const t = await getCopy();
  return Object.fromEntries((Object.keys(catalogue) as (AppKey | EmailKey)[]).filter((k) => k.startsWith("app.")).map((k) => [k, t(k)]));
});
