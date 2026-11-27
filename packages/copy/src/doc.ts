import { z } from "zod";

/**
 * Long editable pages (Terms, Privacy, Reader guidelines) are saved as a small block document, never HTML.
 * Modelled on the owner's theseahfamily story format: a strict schema, every field and length listed, anything
 * else refused rather than dropped. Pages render it as React elements.
 */
export const DOC_LIMITS = { bytes: 160_000, blocks: 400, chars: 60_000 } as const;

const RUN_MAX = 20_000;
const HREF_MAX = 500;
// Control and invisible characters are the point of this pattern.
// eslint-disable-next-line no-control-regex
const INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2060-\u2069\uFEFF]/;

/** Web and mail links only; anything else (javascript:, data:, relative) is refused. */
export function safeHref(href: string): string | null {
  const h = href.trim();
  if (/^https?:\/\/[^\s]+$/i.test(h)) {
    try {
      const u = new URL(h);
      return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
    } catch {
      return null;
    }
  }
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(h)) return h;
  return null;
}

/** Built on first use, so pages that only render documents don't ship the schema library. */
function schema() {
  const Text = z
    .object({
      t: z.literal("text"),
      text: z.string().min(1).max(RUN_MAX).refine((s) => !INVISIBLE.test(s)),
      b: z.literal(true).optional(),
      i: z.literal(true).optional(),
      href: z.string().max(HREF_MAX).refine((h) => safeHref(h) !== null).optional()
    })
    .strict();
  const Inlines = z.array(Text).max(400);
  const textBlock = <T extends string>(t: T) => z.object({ t: z.literal(t), c: Inlines }).strict();
  const listBlock = <T extends string>(t: T) => z.object({ t: z.literal(t), items: z.array(Inlines).min(1).max(200) }).strict();
  const Block = z.discriminatedUnion("t", [
    textBlock("p"),
    textBlock("h2"),
    textBlock("h3"),
    textBlock("quote"),
    textBlock("callout"),
    listBlock("ul"),
    listBlock("ol"),
    z.object({ t: z.literal("divider") }).strict()
  ]);
  return { Text, DocSchema: z.object({ v: z.literal(1), blocks: z.array(Block) }).strict() };
}
type Schema = ReturnType<typeof schema>;
let built: Schema | undefined;

export type Doc = z.infer<Schema["DocSchema"]>;
export type Block = Doc["blocks"][number];
export type Inline = z.infer<Schema["Text"]>;

const inlinesOf = (b: Block): Inline[] => ("c" in b ? b.c : "items" in b ? b.items.flat() : []);

/** Parses and checks a saved document. */
export function parseDoc(json: string): { ok: true; doc: Doc } | { ok: false; reason: "doc_invalid" | "doc_too_large" } {
  if (new TextEncoder().encode(json).length > DOC_LIMITS.bytes) return { ok: false, reason: "doc_too_large" };
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, reason: "doc_invalid" };
  }
  const blocks = (raw as { blocks?: unknown } | null)?.blocks;
  if (Array.isArray(blocks) && blocks.length > DOC_LIMITS.blocks) return { ok: false, reason: "doc_too_large" };
  const parsed = (built ??= schema()).DocSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: "doc_invalid" };
  const chars = parsed.data.blocks.reduce((n, b) => n + inlinesOf(b).reduce((m, r) => m + r.text.length, 0), 0);
  if (chars > DOC_LIMITS.chars) return { ok: false, reason: "doc_too_large" };
  return { ok: true, doc: parsed.data };
}

/** A document with one paragraph per line of text (used for defaults). */
export const docOf = (paragraphs: { h?: string; p?: string }[]): string =>
  JSON.stringify({ v: 1, blocks: paragraphs.map((x) => (x.h ? { t: "h2", c: [{ t: "text", text: x.h }] } : { t: "p", c: [{ t: "text", text: x.p }] })) });
