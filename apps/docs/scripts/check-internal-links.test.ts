import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  collectHeadingIds,
  collectMdxFiles,
  extractInternalLinks,
  findBrokenAnchors,
  findBrokenInternalLinks,
  findRouteContractViolations,
  findStaleRetiredProviderSupportLinks,
  type MdxFile,
  REQUIRED_APP_DOC_ROUTES,
  resolveInternalHref,
} from "./check-internal-links.ts";
import { getPreRenderPages } from "./generate-sitemap.ts";

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

  it("requires every canonical app doc route exactly once in the prerender set", () => {
    const pages = getPreRenderPages();
    const violations = findRouteContractViolations({ pages });
    expect(violations).toEqual([]);
    for (const route of REQUIRED_APP_DOC_ROUTES) {
      expect(pages.filter((page) => page.path === route)).toHaveLength(1);
    }
  });

  it("reports missing canonical destinations", () => {
    const pages = getPreRenderPages().filter(
      (page) => page.path !== "/app/operations/troubleshooting",
    );
    expect(findRouteContractViolations({ pages })).toEqual([
      {
        kind: "missing-route",
        detail: "/app/operations/troubleshooting",
      },
    ]);
  });

  it("reports duplicate routed destinations", () => {
    const pages = [
      ...getPreRenderPages(),
      { path: "/app/reference/providers", source: "duplicate.mdx" },
    ];
    expect(findRouteContractViolations({ pages })).toEqual([
      {
        kind: "duplicate-route",
        detail: "/app/reference/providers appears 2 times",
      },
    ]);
  });

  it("derives heading ids the way the renderer does", () => {
    const ids = collectHeadingIds(
      [
        "## Wrong product, region, or workspace",
        "```bash",
        "# not a heading",
        "```",
        "### Custom slug [#pinned-id]",
        "## Repeat",
        "## Repeat",
      ].join("\n"),
    );

    expect([...ids]).toEqual([
      "wrong-product-region-or-workspace",
      "pinned-id",
      "repeat",
      "repeat-1",
    ]);
  });

  it("reports link fragments that no heading on the target page provides", () => {
    const files: MdxFile[] = [
      {
        filePath: "pipeline.mdx",
        routePath: "/app/concepts/review-pipeline",
        content: [
          "[Good](/app/operations/troubleshooting#transport-failed)",
          "[Bad](/app/operations/troubleshooting#provider-or-key-errors)",
          "[Same page](#sequential-vs-parallel)",
        ].join("\n"),
      },
      {
        filePath: "troubleshooting.mdx",
        routePath: "/app/operations/troubleshooting",
        content: "## Transport failed",
      },
    ];

    expect(findBrokenAnchors(files)).toEqual([
      {
        kind: "broken-anchor",
        detail:
          "/app/operations/troubleshooting#provider-or-key-errors -> /app/operations/troubleshooting#provider-or-key-errors",
        filePath: "pipeline.mdx",
        line: 2,
      },
      {
        kind: "broken-anchor",
        detail: "#sequential-vs-parallel -> /app/concepts/review-pipeline#sequential-vs-parallel",
        filePath: "pipeline.mdx",
        line: 3,
      },
    ]);
  });

  it("fails fixtures that imply retired providers are available", () => {
    const files: MdxFile[] = [
      {
        filePath: "providers.mdx",
        routePath: "/app/reference/providers",
        content: "GitHub Models is available for setup in Diffgazer.",
      },
      {
        filePath: "setup.mdx",
        routePath: "/app/getting-started/first-review",
        content: "[Enable nvidia-api-catalog support](/app/reference/configuration)",
      },
    ];

    expect(findStaleRetiredProviderSupportLinks(files)).toEqual([
      {
        kind: "stale-retired-provider-link",
        detail: "github-models availability claim",
        filePath: "providers.mdx",
        line: 1,
      },
      {
        kind: "stale-retired-provider-link",
        detail: "nvidia-api-catalog support link",
        filePath: "setup.mdx",
        line: 1,
      },
    ]);
  });

  it("keeps scanning a subject that already matched a support link on an earlier line", () => {
    const files: MdxFile[] = [
      {
        filePath: "providers.mdx",
        routePath: "/app/reference/providers",
        content: [
          "[Enable github-models support](/app/reference/configuration)",
          "GitHub Models is available for setup in Diffgazer.",
        ].join("\n"),
      },
    ];

    expect(findStaleRetiredProviderSupportLinks(files)).toEqual([
      {
        kind: "stale-retired-provider-link",
        detail: "github-models support link",
        filePath: "providers.mdx",
        line: 1,
      },
      {
        kind: "stale-retired-provider-link",
        detail: "github-models availability claim",
        filePath: "providers.mdx",
        line: 2,
      },
    ]);
  });

  it("flags a retired product advertised under its documented plan id or vendor name", () => {
    const files: MdxFile[] = [
      {
        filePath: "providers.mdx",
        routePath: "/app/reference/providers",
        content: [
          "Diffgazer now supports `alibaba-coding-plan` for hosted review.",
          "The NVIDIA hosted API Catalog/build API is selectable again.",
        ].join("\n"),
      },
    ];

    expect(findStaleRetiredProviderSupportLinks(files)).toEqual([
      {
        kind: "stale-retired-provider-link",
        detail: "alibaba-coding-plan availability claim",
        filePath: "providers.mdx",
        line: 1,
      },
      {
        kind: "stale-retired-provider-link",
        detail: "nvidia-api-catalog availability claim",
        filePath: "providers.mdx",
        line: 2,
      },
    ]);
  });

  it("keeps the support matrix's own retirement rows and negated prose clean", () => {
    const files: MdxFile[] = [
      {
        filePath: "providers.mdx",
        routePath: "/app/reference/providers",
        content: [
          "| `alibaba-coding-plan` | Alibaba Coding / Token Plan | rejected | hosted-api | Not supported | Not selectable | Not admitted | a | b | c |",
          "Diffgazer does not present the Alibaba Coding / Token Plan route as selectable.",
        ].join("\n"),
      },
    ];

    expect(findStaleRetiredProviderSupportLinks(files)).toEqual([]);
  });

  it("detects retired-product prose in isolated fixture roots", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "diffgazer-docs-link-check-"));
    const fixturePath = join(fixtureRoot, "retired-regression-fixture.mdx");

    try {
      writeFileSync(
        fixturePath,
        "---\ntitle: Fixture\n---\n\n`alibaba-coding-plan` is available for setup again.\n",
        "utf8",
      );

      const files = collectMdxFiles([fixtureRoot]);
      expect(findStaleRetiredProviderSupportLinks(files)).toEqual([
        expect.objectContaining({
          kind: "stale-retired-provider-link",
          detail: "alibaba-coding-plan availability claim",
          filePath: fixturePath,
        }),
      ]);
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
});
