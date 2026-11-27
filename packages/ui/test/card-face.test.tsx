import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CardFace } from "../src/CardFace";

describe("CardFace", () => {
  it("turns a reversed card upside down as a whole, with the label below and outside it", () => {
    const html = renderToStaticMarkup(<CardFace id="the-star" reversed reversedLabel="Reversed" />);
    const img = /<div role="img"[^>]*>/.exec(html)?.[0] ?? "";
    expect(img).toContain('aria-label="The Star, reversed"');
    expect(img).toContain("rotate(180deg)");
    expect(html).not.toMatch(/<svg[^>]*rotate/);
    // The label is a caption after the card, so it never turns upside down with it.
    expect(html).toMatch(/<\/div><figcaption[^>]*>Reversed<\/figcaption><\/figure>$/);
  });

  it("leaves an upright card as it is, with no label", () => {
    const html = renderToStaticMarkup(<CardFace id="the-star" reversedLabel="Reversed" />);
    expect(html).not.toContain("rotate(180deg)");
    expect(html).not.toContain("Reversed");
    expect(html).toContain('aria-label="The Star"');
  });
});
