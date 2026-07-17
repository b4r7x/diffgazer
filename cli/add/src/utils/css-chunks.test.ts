import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { buildStylesContent } from "../commands/init.js";
import { getRegistry, type ResolvedConfig, resolveConfig } from "../context.js";
import {
  buildExpectedChunkContentsForItem,
  planComponentCss,
  removeCssChunks,
} from "./css-chunks.js";

let root: string;

const TAILWIND_CSS_IMPORT_RE =
  /@import\s+(?:(?:url\(\s*)?["']tailwindcss(?:\/[^"']*)?["']\s*\)?|tailwindcss(?:\/[^\s;)]+)?(?:\s*;|\s|$))/;

function countOccurrences(content: string, needle: string): number {
  return content.split(needle).length - 1;
}

function styledConfig(): ResolvedConfig {
  return {
    aliases: {
      components: "@/components/ui",
      utils: "@/lib/utils",
      lib: "@/lib",
      hooks: "@/hooks",
    },
    rsc: false,
    componentsFsPath: "src/components/ui",
    hooksFsPath: "src/hooks",
    libFsPath: "src/lib",
    stylesFsPath: "src/styles",
    tailwind: { css: "src/styles/styles.css" },
  };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dgadd-css-chunks-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("planComponentCss", () => {
  function seedOwnedChunk(
    itemName: string,
    body: string,
    retainedOwner?: string,
  ): { hash: string; stylesPath: string } {
    const hash = createHash("sha256").update(body).digest("hex").slice(0, 16);
    const installedComponents: Record<string, object> = {
      [itemName]: { installedAt: "2026-01-01T00:00:00.000Z", cssChunks: [hash] },
    };
    if (retainedOwner) {
      installedComponents[retainedOwner] = {
        installedAt: "2026-01-01T00:00:00.000Z",
        cssChunks: [hash],
      };
    }
    writeFileSync(
      join(root, "diffgazer.json"),
      JSON.stringify({ tailwind: { css: "src/styles/styles.css" }, installedComponents }),
    );
    mkdirSync(join(root, "src/styles"), { recursive: true });
    const stylesPath = join(root, "src/styles/styles.css");
    writeFileSync(stylesPath, `/* dgadd:css ${hash} */\n${body}\n/* dgadd:css-end ${hash} */\n`);
    return { hash, stylesPath };
  }

  test.each([
    "/outside/styles.css",
    "C:\\outside\\styles.css",
    "\\outside\\styles.css",
    "\\\\server\\share\\styles.css",
  ])("rejects absolute tailwind css path %s before creating files", (css) => {
    expect(() => resolveConfig({ tailwind: { css } }, root)).toThrow(
      /Project paths must be relative/,
    );
    expect(readdirSync(root)).toEqual([]);
  });

  test("retains a canonical validated relative tailwind css path", () => {
    const config = resolveConfig({ tailwind: { css: "src\\styles\\styles.css" } }, root);

    expect(config.tailwind).toEqual({ css: "src/styles/styles.css" });
    const plan = planComponentCss(["dialog-shell"], root, config);
    expect(plan.fileOp?.targetPath).toBe(join(root, "src/styles/styles.css"));
    expect(readdirSync(root)).toEqual([]);
  });

  test("blocks CSS-bearing installs when tailwind css path is absent", () => {
    const config = {
      aliases: {
        components: "@/components/ui",
        utils: "@/lib/utils",
        lib: "@/lib",
        hooks: "@/hooks",
      },
      rsc: false,
      tailwind: undefined,
      componentsFsPath: "src/components/ui",
      hooksFsPath: "src/hooks",
      libFsPath: "src/lib",
      stylesFsPath: "src/styles",
    } satisfies ResolvedConfig;

    let thrown: unknown;
    try {
      planComponentCss(["dialog-shell"], root, config);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    if (!(thrown instanceof Error)) throw new Error("Expected the CSS planner to reject");
    expect(thrown.message).toContain("diffgazer.json has no tailwind.css path");
    expect(thrown.message).not.toContain("components.json");
    expect(thrown.message).toContain("Run dgadd init");
  });

  test("writes CSS chunks when tailwind css path is configured", () => {
    mkdirSync(join(root, "src/styles"), { recursive: true });
    writeFileSync(join(root, "src/styles/styles.css"), "/* base */\n");

    const config = {
      aliases: {
        components: "@/components/ui",
        utils: "@/lib/utils",
        lib: "@/lib",
        hooks: "@/hooks",
      },
      rsc: false,
      componentsFsPath: "src/components/ui",
      hooksFsPath: "src/hooks",
      libFsPath: "src/lib",
      stylesFsPath: "src/styles",
      tailwind: { css: "src/styles/styles.css" },
    } satisfies ResolvedConfig;

    const plan = planComponentCss(["dialog-shell"], root, config);

    expect(plan.fileOp).not.toBeNull();
    expect(plan.fileOp?.content).toMatch(/dgadd:css/);
    expect((plan.chunksByItem.get("ui/dialog-shell") ?? []).length).toBeGreaterThan(0);
  });

  test("writes CSS-bearing component selectors exactly once after init seed plus add", () => {
    mkdirSync(join(root, "src/styles"), { recursive: true });
    const stylesPath = join(root, "src/styles/styles.css");
    writeFileSync(stylesPath, buildStylesContent(getRegistry()));

    const config = {
      aliases: {
        components: "@/components/ui",
        utils: "@/lib/utils",
        lib: "@/lib",
        hooks: "@/hooks",
      },
      rsc: false,
      componentsFsPath: "src/components/ui",
      hooksFsPath: "src/hooks",
      libFsPath: "src/lib",
      stylesFsPath: "src/styles",
      tailwind: { css: "src/styles/styles.css" },
    } satisfies ResolvedConfig;

    const plan = planComponentCss(["dialog-shell"], root, config);
    if (!plan.fileOp) throw new Error("Expected dialog-shell to add a CSS chunk.");

    writeFileSync(stylesPath, plan.fileOp.content);

    expect(
      countOccurrences(readFileSync(stylesPath, "utf-8"), 'dialog[data-state="open"]::backdrop'),
    ).toBe(1);
  });

  test("leaves a present-but-drifted chunk untouched without --overwrite", () => {
    mkdirSync(join(root, "src/styles"), { recursive: true });
    const stylesPath = join(root, "src/styles/styles.css");
    writeFileSync(stylesPath, "/* base */\n");

    const config = styledConfig();
    const initial = planComponentCss(["dialog-shell"], root, config);
    if (!initial.fileOp) throw new Error("Expected dialog-shell to add a CSS chunk.");
    writeFileSync(stylesPath, initial.fileOp.content);
    const [hash] = initial.chunksByItem.get("ui/dialog-shell") ?? [];
    if (!hash) throw new Error("Expected dialog-shell to record a chunk hash.");

    const drifted = readFileSync(stylesPath, "utf-8").replace(
      `/* dgadd:css-end ${hash} */`,
      `  --user-drift: teal;\n/* dgadd:css-end ${hash} */`,
    );
    writeFileSync(stylesPath, drifted);

    const replan = planComponentCss(["dialog-shell"], root, config, false);
    expect(replan.fileOp, "a drifted chunk is not repaired without --overwrite").toBeNull();
  });

  test("repairs a present-but-drifted chunk under --overwrite while preserving other content", () => {
    mkdirSync(join(root, "src/styles"), { recursive: true });
    const stylesPath = join(root, "src/styles/styles.css");
    writeFileSync(stylesPath, "/* base */\n.brand { color: red; }\n");

    const config = styledConfig();
    const initial = planComponentCss(["dialog-shell"], root, config);
    if (!initial.fileOp) throw new Error("Expected dialog-shell to add a CSS chunk.");
    writeFileSync(stylesPath, initial.fileOp.content);
    const [hash] = initial.chunksByItem.get("ui/dialog-shell") ?? [];
    if (!hash) throw new Error("Expected dialog-shell to record a chunk hash.");

    const pristineBody = readFileSync(stylesPath, "utf-8");
    const drifted = pristineBody.replace(
      `/* dgadd:css-end ${hash} */`,
      `  --user-drift: teal;\n/* dgadd:css-end ${hash} */`,
    );
    writeFileSync(stylesPath, drifted);

    const replan = planComponentCss(["dialog-shell"], root, config, true);
    expect(replan.fileOp, "a drifted chunk is repaired under --overwrite").not.toBeNull();
    if (!replan.fileOp) throw new Error("Expected a repair fileOp.");

    expect(replan.fileOp.content).not.toContain("--user-drift: teal;");
    expect(replan.fileOp.content).toContain(".brand { color: red; }");
    expect(countOccurrences(replan.fileOp.content, `/* dgadd:css ${hash} */`)).toBe(1);
  });

  test("keeps an obsolete chunk still owned by an unupdated item", () => {
    const { hash } = seedOwnedChunk(
      "ui/dialog-shell",
      ".legacy-dialog { color: red; }",
      "ui/retained-fixture",
    );

    const plan = planComponentCss(["dialog-shell"], root, styledConfig());

    expect(plan.fileOp?.content).toContain(`dgadd:css ${hash}`);
    expect(plan.chunksByItem.get("ui/dialog-shell")).not.toContain(hash);
  });

  test("removes obsolete ownership when an updated item no longer ships CSS", () => {
    const { hash } = seedOwnedChunk("ui/button", ".legacy-button { color: red; }");

    const plan = planComponentCss(["button"], root, styledConfig());

    expect(plan.fileOp?.content).not.toContain(`dgadd:css ${hash}`);
    expect(plan.chunksByItem.get("ui/button")).toEqual([]);
  });

  test("shipped styles seed and CSS chunks do not import Tailwind", () => {
    const registry = getRegistry();
    const cssPayloads = [
      { label: "styles.css seed", content: registry.styles },
      ...registry.items.flatMap((item) =>
        [...buildExpectedChunkContentsForItem(item.name)].map(([hash, content]) => ({
          label: `${item.name} CSS chunk ${hash}`,
          content,
        })),
      ),
    ];

    expect(cssPayloads.length).toBeGreaterThan(1);
    expect(
      cssPayloads
        .filter(({ content }) => TAILWIND_CSS_IMPORT_RE.test(content))
        .map(({ label }) => label),
    ).toEqual([]);
  });
});

describe("removeCssChunks", () => {
  function seedChunk(config: ResolvedConfig): { stylesPath: string; hash: string } {
    mkdirSync(join(root, "src/styles"), { recursive: true });
    const stylesPath = join(root, "src/styles/styles.css");
    writeFileSync(stylesPath, "/* base */\n");
    const plan = planComponentCss(["dialog-shell"], root, config);
    if (!plan.fileOp) throw new Error("Expected dialog-shell to add a CSS chunk.");
    writeFileSync(stylesPath, plan.fileOp.content);
    const [hash] = plan.chunksByItem.get("ui/dialog-shell") ?? [];
    if (!hash) throw new Error("Expected dialog-shell to record a chunk hash.");
    return { stylesPath, hash };
  }

  function editChunkBody(stylesPath: string, hash: string): void {
    const edited = readFileSync(stylesPath, "utf-8").replace(
      `/* dgadd:css-end ${hash} */`,
      `  --user-edit: teal;\n/* dgadd:css-end ${hash} */`,
    );
    writeFileSync(stylesPath, edited);
  }

  test("removes a pristine managed chunk", () => {
    const config = styledConfig();
    const { hash } = seedChunk(config);

    const result = removeCssChunks(new Set([hash]), root, config);

    expect(result.fileOp).not.toBeNull();
    expect(result.removedHashes).toContain(hash);
    expect(result.modifiedHashes).toEqual([]);
    expect(result.fileOp?.content).not.toContain(hash);
  });

  test("preserves an edited chunk instead of deleting the user's work", () => {
    const config = styledConfig();
    const { stylesPath, hash } = seedChunk(config);
    editChunkBody(stylesPath, hash);

    const result = removeCssChunks(new Set([hash]), root, config);

    expect(result.fileOp, "a drifted chunk must not produce a deleting mutation").toBeNull();
    expect(result.removedHashes).toEqual([]);
    expect(result.modifiedHashes).toContain(hash);

    if (result.fileOp) writeFileSync(stylesPath, result.fileOp.content);
    expect(readFileSync(stylesPath, "utf-8")).toContain("--user-edit: teal;");
  });

  test("force removes an edited chunk when the user overrides", () => {
    const config = styledConfig();
    const { stylesPath, hash } = seedChunk(config);
    editChunkBody(stylesPath, hash);

    const result = removeCssChunks(new Set([hash]), root, config, true);

    expect(result.fileOp).not.toBeNull();
    expect(result.removedHashes).toContain(hash);
    expect(result.fileOp?.content).not.toContain(hash);
    expect(result.fileOp?.content).not.toContain("--user-edit: teal;");
  });
});
