import { safeHref, type Block, type Doc, type Inline } from "@astro/copy";

/** The editor's JSON (Tiptap/ProseMirror), as much of it as these converters read. */
export interface PMNode {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: PMNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

// ---------------------------------------------------------------- saved format → editor

function inlineToPm(r: Inline): PMNode {
  const marks: NonNullable<PMNode["marks"]> = [];
  if (r.b) marks.push({ type: "bold" });
  if (r.i) marks.push({ type: "italic" });
  if (r.href) marks.push({ type: "link", attrs: { href: r.href } });
  return marks.length ? { type: "text", text: r.text, marks } : { type: "text", text: r.text };
}

const para = (c: Inline[]): PMNode => (c.length ? { type: "paragraph", content: c.map(inlineToPm) } : { type: "paragraph" });

function blockToPm(b: Block): PMNode {
  switch (b.t) {
    case "p": return para(b.c);
    case "h2": return { type: "heading", attrs: { level: 2 }, content: b.c.map(inlineToPm) };
    case "h3": return { type: "heading", attrs: { level: 3 }, content: b.c.map(inlineToPm) };
    case "quote": return { type: "blockquote", content: [para(b.c)] };
    case "callout": return { type: "callout", content: [para(b.c)] };
    case "ul": return { type: "bulletList", content: b.items.map((it) => ({ type: "listItem", content: [para(it)] })) };
    case "ol": return { type: "orderedList", content: b.items.map((it) => ({ type: "listItem", content: [para(it)] })) };
    case "divider": return { type: "horizontalRule" };
  }
}

export const docToPm = (doc: Doc): PMNode => ({ type: "doc", content: doc.blocks.map(blockToPm) });

// ---------------------------------------------------------------- editor → saved format

/** Text runs of a node. Unsafe links lose their link; hard breaks become spaces; anything else is dropped. */
function inlinesOf(node: PMNode): Inline[] {
  const out: Inline[] = [];
  for (const n of node.content ?? []) {
    if (n.type === "hardBreak") {
      out.push({ t: "text", text: " " });
      continue;
    }
    if (n.type !== "text" || !n.text) continue;
    const r: Inline = { t: "text", text: n.text };
    for (const m of n.marks ?? []) {
      if (m.type === "bold") r.b = true;
      if (m.type === "italic") r.i = true;
      if (m.type === "link" && typeof m.attrs?.href === "string") {
        const href = safeHref(m.attrs.href);
        if (href) r.href = href;
      }
    }
    out.push(r);
  }
  return out;
}

/** Paragraph-like children of a container (blockquote, callout, list item), flattened. */
const paragraphsOf = (node: PMNode): Inline[][] =>
  (node.content ?? []).flatMap((c) => (c.type === "paragraph" || c.type === "heading" ? [inlinesOf(c)] : c.content ? paragraphsOf(c) : [])).filter((r) => r.length > 0);

function listItems(node: PMNode): Inline[][] {
  // Nested lists are flattened into the parent list, in order.
  return (node.content ?? []).flatMap((li) => paragraphsOf(li));
}

function pmBlock(node: PMNode): Block[] {
  switch (node.type) {
    case "paragraph": {
      const c = inlinesOf(node);
      return c.length ? [{ t: "p", c }] : [];
    }
    case "heading": {
      const c = inlinesOf(node);
      if (!c.length) return [];
      const level = Number(node.attrs?.level ?? 2);
      return [{ t: level <= 2 ? "h2" : "h3", c }];
    }
    case "blockquote": return paragraphsOf(node).map((c) => ({ t: "quote", c }));
    case "callout": return paragraphsOf(node).map((c) => ({ t: "callout", c }));
    case "bulletList": {
      const items = listItems(node);
      return items.length ? [{ t: "ul", items }] : [];
    }
    case "orderedList": {
      const items = listItems(node);
      return items.length ? [{ t: "ol", items }] : [];
    }
    case "horizontalRule": return [{ t: "divider" }];
    default: return [];
  }
}

/** Fits the editor's document into the saved format: only allowed blocks and marks survive. */
export const pmToDoc = (pm: PMNode): Doc => ({ v: 1, blocks: (pm.content ?? []).flatMap(pmBlock) });
