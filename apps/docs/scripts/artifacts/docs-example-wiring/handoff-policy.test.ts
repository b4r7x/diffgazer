import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  hasConsumptionMetadata,
  listRepoFiles,
  readAbsolute,
  readRepoFile,
  repoRoot,
} from "./repo-files.js";

describe("docs example wiring — handoff policy", () => {
  it("uses deterministic docs preview without npx network dependency", () => {
    const docsPackage = JSON.parse(readRepoFile("apps/docs/package.json"));

    expect(docsPackage.scripts.preview).toBe("vite preview --outDir .output/public");
  });

  it("every public UI component/hook page has consumption metadata block", () => {
    const componentPages = listRepoFiles("libs/ui/docs/content/components", ".mdx");
    const hookPages = listRepoFiles("libs/ui/docs/content/hooks", ".mdx");

    for (const file of [...componentPages, ...hookPages]) {
      if (file.endsWith("/index.mdx")) continue;
      const source = readAbsolute(file);
      const relPath = file.slice(repoRoot.length + 1);
      expect(
        hasConsumptionMetadata(source),
        `${relPath} must include <ConsumptionBlock /> or a docs scaffold that renders it`,
      ).toBe(true);
    }
  });

  it("every public keys hook page has consumption metadata block", () => {
    const hookPages = listRepoFiles("libs/keys/docs/content/hooks", ".mdx");

    for (const file of hookPages) {
      if (file.endsWith("/index.mdx")) continue;
      const source = readAbsolute(file);
      const relPath = file.slice(repoRoot.length + 1);
      expect(
        source.includes("<ConsumptionBlock"),
        `${relPath} must include <ConsumptionBlock />`,
      ).toBe(true);
    }
  });

  it("does not render empty API Reference headings in component pages", () => {
    const componentPages = listRepoFiles("libs/ui/docs/content/components", ".mdx");

    for (const file of componentPages) {
      const source = readAbsolute(file);
      const relPath = file.slice(repoRoot.length + 1);

      if (source.includes("## API Reference")) {
        expect(
          source,
          `${relPath} has standalone ## API Reference heading -- use <APIReference /> instead`,
        ).not.toMatch(/## API Reference\s*\n\s*\n\s*<PropsTable/);
      }
    }
  });

  it("docs-libraries.json does not point enabled libraries to missing content", () => {
    const config = JSON.parse(readRepoFile("apps/docs/config/docs-libraries.json"));
    const enabledLibraries = config.libraries.filter((lib: { enabled: boolean }) => lib.enabled);

    for (const lib of enabledLibraries) {
      const contentDir = `apps/docs/content/docs/${lib.id}`;
      const contentDirFull = resolve(repoRoot, contentDir);
      let hasContent = false;
      try {
        const entries = readdirSync(contentDirFull);
        hasContent = entries.length > 0;
      } catch {
        hasContent = false;
      }
      expect(hasContent, `enabled library "${lib.id}" has no content in ${contentDir}`).toBe(true);
    }
  });
});
