import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  camelToKebab,
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
    expect(docsPackage.scripts.preview).not.toContain("npx");
  });

  it("documents the exact React peer floor for public docs handoff", () => {
    const docs = [
      readRepoFile("libs/ui/README.md"),
      readRepoFile("libs/keys/README.md"),
      readRepoFile("cli/add/README.md"),
      readRepoFile("PACKAGE_GOVERNANCE.md"),
      readRepoFile("libs/ui/docs/content/getting-started/typescript.mdx"),
      readRepoFile("libs/ui/docs/content/getting-started/consumption-modes.mdx"),
      readRepoFile("libs/keys/docs/content/getting-started/index.mdx"),
      readRepoFile("libs/keys/docs/content/api/index.mdx"),
    ].join("\n");

    expect(docs).toContain("React `>=19.2.0`");
    expect(docs).not.toMatch(/React 19(?!\.2|`)/);
    expect(docs).not.toContain("React 19+");
    expect(docs).not.toContain("React 19.2+");
  });

  it("keeps public install snippets local-first or publish-gated", () => {
    const docs = [
      "libs/ui/README.md",
      "libs/keys/README.md",
      "cli/add/README.md",
      "cli/diffgazer/README.md",
      ...listRepoFiles("libs/ui/docs/content", ".mdx").map((file) =>
        file.slice(repoRoot.length + 1),
      ),
    ];

    for (const path of docs) {
      const source = readRepoFile(path);
      if (
        !/(npx @diffgazer\/add|pnpm dlx @diffgazer\/add|yarn dlx @diffgazer\/add|bunx @diffgazer\/add|npm install @diffgazer\/|npm install -g diffgazer)/.test(
          source,
        )
      ) {
        continue;
      }

      if (path === "cli/diffgazer/README.md") {
        expect(source, path).toContain("`diffgazer` is live on npm");
        continue;
      }

      expect(source, path).toMatch(
        /not yet published to npm|first release|local checkout|npm view|publish-gated|After Publication|after publication|after `@diffgazer\/add` is published|after its npm package is published/,
      );
    }
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

  it("documents every exported keys hook under hook handoff pages", () => {
    const indexSource = readRepoFile("libs/keys/src/index.ts");
    const exportedHookSlugs = [
      ...indexSource.matchAll(/export \{ (use[A-Z]\w+) \} from "\.\/hooks\//g),
    ]
      .map((match) => camelToKebab(match[1] ?? ""))
      .sort();
    const documentedHookSlugs = listRepoFiles("libs/keys/docs/content/hooks", ".mdx")
      .map((file) =>
        file
          .replace(/\.mdx$/, "")
          .split("/")
          .at(-1),
      )
      .filter((slug): slug is string => typeof slug === "string" && slug !== "index")
      .sort();

    expect(documentedHookSlugs).toEqual(exportedHookSlugs);
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

  it("READMEs show consumption path matrix for both libraries", () => {
    const rootReadme = readRepoFile("README.md");
    const uiReadme = readRepoFile("libs/ui/README.md");
    const keysReadme = readRepoFile("libs/keys/README.md");
    const cliReadme = readRepoFile("cli/add/README.md");

    expect(rootReadme).toContain("Manual copy");
    expect(rootReadme).toContain("dgadd");
    expect(rootReadme).toContain("npm package");

    expect(uiReadme).toContain("Manual copy");
    expect(uiReadme).toContain("dgadd");
    expect(uiReadme).toContain("npm package");

    expect(keysReadme).toContain("Manual copy");
    expect(keysReadme).toContain("dgadd");
    expect(keysReadme).toContain("npm package");

    expect(cliReadme).toContain("@diffgazer/ui");
    expect(cliReadme).toContain("@diffgazer/keys");

    for (const readme of [rootReadme, uiReadme, keysReadme, cliReadme]) {
      expect(readme).toMatch(/publish-gated|not yet published to npm/);
    }
  });
});
