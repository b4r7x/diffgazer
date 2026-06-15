import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { getRegistry, type ResolvedConfig } from "../context.js";
import { buildExpectedChunkContentsForItem, planComponentCss } from "./css-chunks.js";

let root: string;

const TAILWIND_CSS_IMPORT_RE =
  /@import\s+(?:(?:url\(\s*)?["']tailwindcss(?:\/[^"']*)?["']\s*\)?|tailwindcss(?:\/[^\s;)]+)?(?:\s*;|\s|$))/;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dgadd-css-chunks-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("planComponentCss", () => {
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

    expect(() => planComponentCss(["dialog-shell"], root, config)).toThrow(
      /components\.json has no tailwind\.css path/,
    );
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
