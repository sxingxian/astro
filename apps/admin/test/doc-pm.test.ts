import type { Doc } from "@astro/copy";
import { describe, expect, it } from "vitest";
import { docToPm, pmToDoc, type PMNode } from "@/components/text/doc-pm";

const sample: Doc = {
  v: 1,
  blocks: [
    { t: "h2", c: [{ t: "text", text: "Your data" }] },
    { t: "h3", c: [{ t: "text", text: "What we keep" }] },
    { t: "p", c: [{ t: "text", text: "Plain " }, { t: "text", text: "bold", b: true }, { t: "text", text: " and ", i: true }, { t: "text", text: "a link", href: "https://example.com/" }] },
    { t: "quote", c: [{ t: "text", text: "A quote" }] },
    { t: "callout", c: [{ t: "text", text: "A note" }] },
    { t: "ul", items: [[{ t: "text", text: "one" }], [{ t: "text", text: "two", b: true }]] },
    { t: "ol", items: [[{ t: "text", text: "first" }]] },
    { t: "divider" }
  ]
};

describe("doc-pm", () => {
  it("round-trips every block and mark", () => {
    expect(pmToDoc(docToPm(sample))).toEqual(sample);
  });

  it("drops what the saved format can't hold", () => {
    const pm: PMNode = {
      type: "doc",
      content: [
        { type: "image", attrs: { src: "x" } },
        { type: "paragraph", content: [{ type: "text", text: "bad link", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] },
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Big" }] },
        { type: "heading", attrs: { level: 4 }, content: [{ type: "text", text: "Small" }] },
        { type: "paragraph" }
      ]
    };
    expect(pmToDoc(pm)).toEqual({
      v: 1,
      blocks: [
        { t: "p", c: [{ t: "text", text: "bad link" }] },
        { t: "h2", c: [{ t: "text", text: "Big" }] },
        { t: "h3", c: [{ t: "text", text: "Small" }] }
      ]
    });
  });
});
