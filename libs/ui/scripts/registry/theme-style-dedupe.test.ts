import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RegistryItem } from "@diffgazer/registry/schemas";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createThemeStyleStripPolicy,
  removeDuplicateThemeStylesInPublicRegistry,
} from "./theme-style-dedupe.js";

const AGGREGATE_THEME_CSS = "/* panel */\n/* dialog */\n/* shared */";

// The published item JSONs carry the CSS payloads; the index mirrors them for
// every item except the shared `mixed.css` carrier, which the shadcn builder
// emits without content.
const publicItems = {
  panel: {
    name: "panel",
    files: [
      { path: "registry/ui/panel/panel.tsx", type: "registry:ui" },
      { path: "registry/ui/panel/panel.css", type: "registry:style", content: "/* panel */" },
    ],
  },
  theme: {
    name: "theme",
    type: "registry:theme",
    files: [
      {
        path: "styles/styles.css",
        type: "registry:style",
        target: "~/styles/styles.css",
        content: AGGREGATE_THEME_CSS,
      },
    ],
  },
  "dialog-shell": {
    name: "dialog-shell",
    files: [
      { path: "registry/ui/shared/dialog.css", type: "registry:style", content: "/* dialog */" },
    ],
  },
  unique: {
    name: "unique",
    files: [
      { path: "registry/ui/unique/unique.css", type: "registry:style", content: "/* panel */" },
    ],
  },
  themed: {
    name: "themed",
    files: [
      { path: "registry/ui/shared/mixed.css", type: "registry:style", content: "/* shared */" },
    ],
  },
  unthemed: {
    name: "unthemed",
    files: [
      { path: "registry/ui/shared/mixed.css", type: "registry:style", content: "/* shared */" },
    ],
  },
};

const sourceItem = (
  name: string,
  registryDependencies: string[],
  extra: Partial<RegistryItem> = {},
): RegistryItem => ({
  name,
  type: "registry:ui",
  dependencies: [],
  registryDependencies,
  files: [],
  ...extra,
});

const sourceItems: RegistryItem[] = [
  sourceItem("panel", ["theme"]),
  sourceItem("dialog", ["dialog-shell", "theme"]),
  sourceItem("dialog-shell", [], { meta: { hidden: true } }),
  sourceItem("unique", []),
  sourceItem("theme", [], { type: "registry:theme" }),
  sourceItem("themed", ["shared-style", "theme"]),
  sourceItem("unthemed", ["shared-style"]),
  sourceItem("shared-style", [], { meta: { hidden: true } }),
];

function writeDedupeFixture(): string {
  const outputDir = mkdtempSync(join(tmpdir(), "dg-ui-public-styles-"));
  writeFileSync(
    join(outputDir, "registry.json"),
    JSON.stringify({
      items: Object.values(publicItems).map((item) =>
        item.name === "themed" || item.name === "unthemed"
          ? { ...item, files: item.files.map(({ content: _content, ...file }) => file) }
          : item,
      ),
    }),
  );
  for (const item of Object.values(publicItems)) {
    writeFileSync(join(outputDir, `${item.name}.json`), JSON.stringify(item));
  }
  return outputDir;
}

describe("removeDuplicateThemeStylesInPublicRegistry", () => {
  describe("stripping payloads duplicated byte-for-byte in the aggregate theme", () => {
    let outputDir: string;

    const readItem = (name: string) =>
      JSON.parse(readFileSync(join(outputDir, `${name}.json`), "utf8")) as {
        files: Array<{ path: string; content?: string }>;
      };
    const readIndexItem = (name: string) => {
      const index = JSON.parse(readFileSync(join(outputDir, "registry.json"), "utf8")) as {
        items: Array<{ name: string; files: Array<{ path: string }> }>;
      };
      const item = index.items.find((entry) => entry.name === name);
      if (!item) throw new Error(`index is missing ${name}`);
      return item;
    };

    beforeEach(() => {
      outputDir = writeDedupeFixture();
      removeDuplicateThemeStylesInPublicRegistry(
        outputDir,
        createThemeStyleStripPolicy(sourceItems, AGGREGATE_THEME_CSS),
      );
    });

    afterEach(() => {
      rmSync(outputDir, { recursive: true, force: true });
    });

    it("strips the CSS payload of an item that depends on the theme", () => {
      expect(readItem("panel").files.map((file) => file.path)).toEqual([
        "registry/ui/panel/panel.tsx",
      ]);
      expect(readIndexItem("panel").files).toHaveLength(1);
    });

    it("strips the CSS payload reached through a hidden dependency", () => {
      expect(readItem("dialog-shell").files).toHaveLength(0);
      expect(readIndexItem("dialog-shell").files).toHaveLength(0);
    });

    it("keeps an identical payload on an item with no theme dependency", () => {
      expect(readItem("unique").files.map((file) => file.content)).toEqual(["/* panel */"]);
      expect(readIndexItem("unique").files).toHaveLength(1);
    });

    it("keeps the theme item's own payload", () => {
      expect(readItem("theme").files).toHaveLength(1);
      expect(readIndexItem("theme").files).toHaveLength(1);
    });

    it("strips a shared carrier for the themed owner only", () => {
      expect(readItem("themed").files).toHaveLength(0);
      expect(readIndexItem("themed").files).toHaveLength(0);
      expect(readItem("unthemed").files).toHaveLength(1);
      expect(readIndexItem("unthemed").files).toHaveLength(1);
    });
  });

  // The shadcn builder emits a content-less index: every file payload lives only in
  // the per-item JSON. So the index can only be stripped through the carrier map,
  // and a map keyed by path alone would strip both owners of a shared CSS carrier
  // while the per-item JSON — which still has the content to test — keeps one.
  it("keeps index and item JSON in agreement when a themed and unthemed item share a carrier", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "dg-ui-public-mixed-carrier-"));
    const sharedCss = "registry/ui/shared/mixed.css";
    const sharedContent = ".mixed { color: red; }";
    const writeItem = (name: string, item: unknown) =>
      writeFileSync(join(outputDir, `${name}.json`), `${JSON.stringify(item, null, 2)}\n`);
    const styleFile = { path: sharedCss, type: "registry:style", target: "@ui/shared/mixed.css" };
    const indexItem = (name: string, registryDependencies: string[]) => ({
      name,
      type: "registry:ui",
      registryDependencies,
      files: [{ path: `registry/ui/${name}/${name}.tsx`, type: "registry:ui" }, { ...styleFile }],
    });

    try {
      writeFileSync(
        join(outputDir, "registry.json"),
        `${JSON.stringify(
          {
            name: "diffgazer",
            items: [
              indexItem("themed", ["shared-style", "theme"]),
              indexItem("unthemed", ["shared-style"]),
              { name: "shared-style", type: "registry:ui", files: [{ ...styleFile }] },
              {
                name: "theme",
                type: "registry:theme",
                files: [
                  {
                    path: "styles/styles.css",
                    type: "registry:style",
                    target: "~/styles/styles.css",
                  },
                ],
              },
            ],
          },
          null,
          2,
        )}\n`,
      );
      for (const name of ["themed", "unthemed"]) {
        writeItem(name, {
          name,
          type: "registry:ui",
          files: [
            {
              path: `registry/ui/${name}/${name}.tsx`,
              content: `export const ${name} = null;\n`,
              type: "registry:ui",
            },
            { ...styleFile, content: sharedContent },
          ],
        });
      }
      writeItem("shared-style", {
        name: "shared-style",
        type: "registry:ui",
        files: [{ ...styleFile, content: sharedContent }],
      });
      writeItem("theme", {
        name: "theme",
        type: "registry:theme",
        files: [
          {
            path: "styles/styles.css",
            content: `@import "tailwindcss";\n${sharedContent}`,
            type: "registry:style",
            target: "~/styles/styles.css",
          },
        ],
      });

      const sourceItem = (name: string, registryDependencies: string[]): RegistryItem => ({
        name,
        type: "registry:ui",
        dependencies: [],
        registryDependencies,
        files: [],
      });
      removeDuplicateThemeStylesInPublicRegistry(
        outputDir,
        createThemeStyleStripPolicy(
          [
            sourceItem("themed", ["shared-style", "theme"]),
            sourceItem("unthemed", ["shared-style"]),
            { ...sourceItem("shared-style", []), meta: { hidden: true } },
            { ...sourceItem("theme", []), type: "registry:theme" },
          ],
          `@import "tailwindcss";\n${sharedContent}`,
        ),
      );

      const readItem = (name: string) =>
        JSON.parse(readFileSync(join(outputDir, `${name}.json`), "utf8")) as {
          files: Array<{ path: string }>;
        };
      const index = JSON.parse(readFileSync(join(outputDir, "registry.json"), "utf8")) as {
        items: Array<{ name: string; files: Array<{ path: string }> }>;
      };
      const indexPaths = (name: string) =>
        index.items.find((item) => item.name === name)?.files.map((file) => file.path);
      const itemPaths = (name: string) => readItem(name).files.map((file) => file.path);

      expect(indexPaths("themed")).toEqual(["registry/ui/themed/themed.tsx"]);
      expect(indexPaths("unthemed")).toEqual(["registry/ui/unthemed/unthemed.tsx", sharedCss]);
      expect(indexPaths("shared-style")).toEqual([sharedCss]);
      expect(itemPaths("themed")).toEqual(indexPaths("themed"));
      expect(itemPaths("unthemed")).toEqual(indexPaths("unthemed"));
      expect(itemPaths("shared-style")).toEqual(indexPaths("shared-style"));
      expect(itemPaths("theme")).toEqual(["styles/styles.css"]);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
