import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sourceToMarkdown, writeLlmsFiles } from "./generate-llms.ts";

describe("generate llms files", () => {
  it("strips frontmatter, imports, and MDX block components from page markdown", () => {
    const markdown = sourceToMarkdown(
      [
        "---",
        "title: Example page",
        "description: A short summary.",
        "---",
        'import { Example } from "./example";',
        "",
        "<Steps>",
        '<Step title="Install">',
        "Run this:",
        "",
        "```tsx",
        'import { Button } from "@/components/ui/button";',
        "```",
        "</Step>",
        "</Steps>",
      ].join("\n"),
      "Fallback",
    );

    expect(markdown).toContain("# Example page");
    expect(markdown).toContain("> A short summary.");
    expect(markdown).toContain("Run this:");
    expect(markdown).toContain('import { Button } from "@/components/ui/button";');
    expect(markdown).not.toContain("<Steps>");
    expect(markdown).not.toContain('from "./example"');
  });

  it("writes llms indexes and markdown files that every llms.txt link can resolve", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "diffgazer-docs-llms-"));
    const sourcePath = join(tempDir, "source.mdx");
    writeFileSync(
      sourcePath,
      ["---", "title: Test page", "description: Test description.", "---", "", "Body text."].join(
        "\n",
      ),
      "utf-8",
    );

    try {
      const result = writeLlmsFiles(tempDir, {
        origin: "https://docs.example.test",
        pages: [{ path: "/app/test-page", source: sourcePath }],
      });

      expect(result.count).toBe(1);
      expect(existsSync(join(tempDir, "app/test-page.md"))).toBe(true);
      expect(existsSync(join(tempDir, "llms.txt"))).toBe(true);
      expect(existsSync(join(tempDir, "llms-full.txt"))).toBe(true);

      const llms = readFileSync(join(tempDir, "llms.txt"), "utf-8");
      const links = [...llms.matchAll(/\]\((https:\/\/docs\.example\.test\/[^)]+\.md)\)/g)];
      expect(links).toHaveLength(1);
      for (const link of links) {
        const url = link[1];
        expect(url).toBeDefined();
        if (!url) continue;
        const path = new URL(url).pathname.slice(1);
        expect(existsSync(join(tempDir, path))).toBe(true);
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
