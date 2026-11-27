import { applyOverrides, getMeaning, type Meaning } from "@astro/meanings";
import type { Db } from "@astro/db";
import { cache } from "react";
import { liveSnapshot, previewId, previewSnapshot } from "./copy";
import { getDb } from "./db";

/** Card meanings with the owner's published overrides (or a preview) over the built-in text. */
export async function loadMeanings(db: Db, opts: { cache?: boolean; previewId?: string | null } = {}): Promise<(cardId: string) => Meaning> {
  const overrides = (await previewSnapshot(db, "meanings", opts.previewId)) ?? (await liveSnapshot(db, "meanings", opts.cache ?? true));
  return (cardId) => applyOverrides(getMeaning(cardId), overrides);
}

export const getMeanings = cache(async () => loadMeanings(getDb(), { previewId: await previewId() }));
