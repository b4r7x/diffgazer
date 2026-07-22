import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  DOCS_CODE_THEME_NAME,
  type DocsHighlighter,
  extractImportSpecifiers,
} from "@diffgazer/registry";
import { describe, expect, it, vi } from "vitest";
import {
  buildComponentCopyArchive,
  buildComponentSourceData,
  type ComponentCopyArchive,
} from "./build-docs-data";

interface PublicRegistryFile {
  type: string;
  target?: string;
  content?: string;
}

describe("buildComponentSourceData", () => {
  it("builds registry style source with CSS grammar without changing copy bytes", () => {
    const panel = JSON.parse(
      readFileSync(resolve(import.meta.dirname, "../public/r/panel.json"), "utf8"),
    ) as { files?: PublicRegistryFile[] };
    const cssFile = panel.files?.find(
      (file) => file.type === "registry:style" && file.target === "~/styles/panel.css",
    );
    if (typeof cssFile?.content !== "string") throw new Error("panel CSS source is missing");

    const codeToTokensBase = vi.fn((code: string) => [[{ content: code }]]);
    const highlighter = { codeToTokensBase } as unknown as DocsHighlighter;
    const { copyArchive, source } = buildComponentSourceData("panel", highlighter);
    const archivedCssFile = copyArchive.files.find((file) =>
      file.path.endsWith("/panel/panel.css"),
    );
    if (!archivedCssFile) throw new Error("panel CSS copy archive entry is missing");
    expect(archivedCssFile.type).toBe("registry:style");
    expect(archivedCssFile.content).toBe(cssFile.content);
    const cssSource = source[archivedCssFile.target];

    expect(cssSource?.raw).toBe(cssFile.content);
    expect(codeToTokensBase).toHaveBeenCalledWith(cssFile.content, {
      lang: "css",
      theme: DOCS_CODE_THEME_NAME,
    });
  });
});

describe("buildComponentCopyArchive", () => {
  function fixturePath(root: string, target: string): string {
    if (target.startsWith("@ui/")) {
      return resolve(root, "src/components/ui", target.slice("@ui/".length));
    }
    if (target.startsWith("@hooks/")) {
      return resolve(root, "src/hooks", target.slice("@hooks/".length));
    }
    if (target.startsWith("@lib/")) {
      return resolve(root, "src/lib", target.slice("@lib/".length));
    }
    if (target.startsWith("~/")) return resolve(root, target.slice(2));
    throw new Error(`Unsupported fixture target: ${target}`);
  }

  function resolveFixtureImport(
    root: string,
    sourcePath: string,
    specifier: string,
  ): string | null {
    let base: string;
    if (specifier.startsWith("@/components/ui/")) {
      base = resolve(root, "src/components/ui", specifier.slice("@/components/ui/".length));
    } else if (specifier.startsWith("@/hooks/")) {
      base = resolve(root, "src/hooks", specifier.slice("@/hooks/".length));
    } else if (specifier.startsWith("@/lib/")) {
      base = resolve(root, "src/lib", specifier.slice("@/lib/".length));
    } else if (specifier.startsWith(".")) {
      base = resolve(dirname(sourcePath), specifier);
    } else {
      return null;
    }

    return (
      [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")].find(
        existsSync,
      ) ?? base
    );
  }

  function materializeArchive(root: string, archive: ComponentCopyArchive): string[] {
    const sourceByTarget = new Map<string, string>();
    for (const file of archive.files) {
      const target = fixturePath(root, file.target);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, file.content);
      sourceByTarget.set(file.target, target);
    }

    const unresolved: string[] = [];
    for (const [target, sourcePath] of sourceByTarget) {
      const source = archive.files.find((file) => file.target === target)?.content;
      if (!source || !/\.[cm]?[jt]sx?$/.test(sourcePath)) continue;

      for (const { specifier } of extractImportSpecifiers(source)) {
        const resolved = resolveFixtureImport(root, sourcePath, specifier);
        if (resolved && !existsSync(resolved)) unresolved.push(`${target}: ${specifier}`);
      }
    }
    return unresolved;
  }

  it.each([
    ["button", false],
    ["accordion", true],
  ] as const)("ships a dependency-closed %s copy archive in a clean fixture", (itemName, hasKeys) => {
    const fixture = mkdtempSync(join(tmpdir(), `diffgazer-${itemName}-archive-`));
    try {
      const archive = buildComponentCopyArchive(itemName);
      expect(archive.registryDependencies).toEqual([]);
      expect(new Set(archive.files.map((file) => file.target)).size).toBe(archive.files.length);
      expect(materializeArchive(fixture, archive)).toEqual([]);

      const source = archive.files.map((file) => file.content).join("\n");
      expect(source).not.toContain('from "@diffgazer/keys"');
      expect(archive.files.some((file) => file.target.startsWith("@hooks/"))).toBe(hasKeys);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it("keeps an explicit style target instead of deriving from the registry/ui/ path", () => {
    const archive = buildComponentCopyArchive("sidebar");
    const cssFile = archive.files.find((file) => file.path === "registry/ui/sidebar/sidebar.css");
    if (!cssFile) throw new Error("sidebar CSS copy archive entry is missing");

    expect(cssFile.target).toBe("~/styles/sidebar.css");
  });
});
