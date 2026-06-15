import { describe, expect, it } from "vitest";
import {
  extractInternalLinks,
  findBrokenInternalLinks,
  type MdxFile,
  resolveInternalHref,
} from "./check-internal-links.ts";

describe("internal link checker", () => {
  it("extracts markdown and JSX href links", () => {
    expect(
      extractInternalLinks(
        [
          "[TUI](/app/tui)",
          "![Image](/ignored.png)",
          '<a href="/app/web">Web</a>',
          "[External](https://example.com)",
        ].join("\n"),
      ),
    ).toEqual([
      { href: "/app/tui", line: 1 },
      { href: "/app/web", line: 3 },
      { href: "https://example.com", line: 4 },
    ]);
  });

  it("resolves relative internal links like the browser does for extensionless routes", () => {
    expect(resolveInternalHref("../components/floating-panel#css-variables", "/ui/theme")).toBe(
      "/components/floating-panel",
    );
    expect(resolveInternalHref("/app/tui#index", "/app/reference/cli")).toBe("/app/tui");
    expect(resolveInternalHref("#local-heading", "/app/tui")).toBeNull();
    expect(resolveInternalHref("https://example.com/page", "/app/tui")).toBeNull();
  });

  it("reports hrefs whose resolved path is not in the prerender page set", () => {
    const files: MdxFile[] = [
      {
        filePath: "page.mdx",
        routePath: "/app/getting-started",
        content: "[Good](/app/tui) [Bad](/app/tui/index)",
      },
    ];

    expect(
      findBrokenInternalLinks({
        files,
        pages: [{ path: "/app/getting-started" }, { path: "/app/tui" }],
      }),
    ).toEqual([
      {
        filePath: "page.mdx",
        line: 1,
        href: "/app/tui/index",
        resolvedPath: "/app/tui/index",
      },
    ]);
  });
});
