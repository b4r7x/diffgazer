import { execFileSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { REMOVED_PRODUCT_ID } from "@diffgazer/core/schemas/config";
import { describe, expect, it } from "vitest";
import {
  extractInternalLinks,
  findBrokenInternalLinks,
  findRouteContractViolations,
  findStaleRetiredProviderSupportLinks,
  type MdxFile,
  PHASE_5_CONTENT_ROUTES,
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

  it("requires every Phase 5 content route exactly once in the prerender set", () => {
    const pages = getPreRenderPages();
    const violations = findRouteContractViolations({ pages });
    expect(violations).toEqual([]);
    for (const route of PHASE_5_CONTENT_ROUTES) {
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
        content: `[Enable ${REMOVED_PRODUCT_ID} support](/app/reference/configuration)`,
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
        detail: "zai-coding support link",
        filePath: "setup.mdx",
        line: 1,
      },
    ]);
  });

  it("flags a retired product advertised under its documented plan id or vendor name", () => {
    const files: MdxFile[] = [
      {
        filePath: "providers.mdx",
        routePath: "/app/reference/providers",
        content: [
          "Diffgazer now supports `zai-coding-plan` for hosted review.",
          "The NVIDIA hosted API Catalog/build API is selectable again.",
        ].join("\n"),
      },
    ];

    expect(findStaleRetiredProviderSupportLinks(files)).toEqual([
      {
        kind: "stale-retired-provider-link",
        detail: "zai-coding-plan availability claim",
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
          "| `zai-coding-plan` | Z.AI GLM Coding Plan | rejected | hosted-api | Not supported | Not selectable | Not admitted | a | b | c |",
          "Diffgazer does not present the Z.AI Coding Plan route as selectable.",
        ].join("\n"),
      },
    ];

    expect(findStaleRetiredProviderSupportLinks(files)).toEqual([]);
  });

  it("exits non-zero when the shipped corpus re-advertises a retired product", () => {
    const docsRoot = resolve(import.meta.dirname, "..");
    const fixturePath = resolve(docsRoot, "content/docs/app/retired-regression-fixture.mdx");
    const run = (): number => {
      try {
        execFileSync("node", ["--import", "tsx", "./scripts/check-internal-links.ts"], {
          cwd: docsRoot,
          stdio: "pipe",
        });
        return 0;
      } catch (error) {
        return (error as { status?: number }).status ?? -1;
      }
    };

    expect(run()).toBe(0);

    try {
      writeFileSync(
        fixturePath,
        "---\ntitle: Fixture\n---\n\n`zai-coding-plan` is available for setup again.\n",
        "utf8",
      );
      expect(run()).not.toBe(0);
    } finally {
      rmSync(fixturePath, { force: true });
    }

    expect(run()).toBe(0);
  });
});
