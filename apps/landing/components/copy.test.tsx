import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.COPY_PUBLISHED_PATH = join(__dirname, "../test/fixtures/published.json");
});

describe("published wording in the built page", () => {
  it("shows overrides, keeps markup as text, and shows the version in the footer", async () => {
    const { Hero } = await import("./Hero");
    const { Footer } = await import("./Footer");
    const hero = renderToStaticMarkup(<Hero sky={null} />);
    expect(hero).toContain("Each night,");
    expect(hero).toContain("a new card.");
    expect(hero).not.toContain("<script>alert(1)</script>");
    expect(hero).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    const footer = renderToStaticMarkup(<Footer />);
    expect(footer).toContain("v7");
    expect(footer).toContain("For reflection and entertainment.");
  });
});
