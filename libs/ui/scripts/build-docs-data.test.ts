import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DOCS_CODE_THEME_NAME, type DocsHighlighter } from "@diffgazer/registry";
import { describe, expect, it, vi } from "vitest";
import { buildComponentSourceData } from "./build-docs-data";

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
