import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RegistryItem } from "@diffgazer/registry/schemas";
import { describe, expect, it } from "vitest";
import {
  createThemeStyleStripPolicy,
  removeDuplicateThemeStylesInPublicRegistry,
} from "./theme-style-dedupe.js";

describe("removeDuplicateThemeStylesInPublicRegistry", () => {
  it("strips only CSS payloads duplicated byte-for-byte in the aggregate theme", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "dg-ui-public-styles-"));
    try {
      writeFileSync(
        join(outputDir, "registry.json"),
        JSON.stringify({
          items: [
            {
              name: "panel",
              files: [
                { path: "registry/ui/panel/panel.tsx", type: "registry:ui" },
                {
                  path: "registry/ui/panel/panel.css",
                  type: "registry:style",
                  content: "/* panel */",
                },
              ],
            },
            {
              name: "theme",
              type: "registry:theme",
              files: [
                {
                  path: "styles/styles.css",
                  type: "registry:style",
                  target: "~/styles/styles.css",
                  content: "/* panel */\n/* dialog */\n/* shared */",
                },
              ],
            },
            {
              name: "dialog-shell",
              files: [
                {
                  path: "registry/ui/shared/dialog.css",
                  type: "registry:style",
                  content: "/* dialog */",
                },
              ],
            },
            {
              name: "unique",
              files: [
                {
                  path: "registry/ui/unique/unique.css",
                  type: "registry:style",
                  content: "/* panel */",
                },
              ],
            },
            {
              name: "themed",
              files: [{ path: "registry/ui/shared/mixed.css", type: "registry:style" }],
            },
            {
              name: "unthemed",
              files: [{ path: "registry/ui/shared/mixed.css", type: "registry:style" }],
            },
          ],
        }),
      );
      writeFileSync(
        join(outputDir, "panel.json"),
        JSON.stringify({
          name: "panel",
          files: [
            { path: "registry/ui/panel/panel.tsx", type: "registry:ui" },
            {
              path: "registry/ui/panel/panel.css",
              type: "registry:style",
              content: "/* panel */",
            },
          ],
        }),
      );
      writeFileSync(
        join(outputDir, "theme.json"),
        JSON.stringify({
          name: "theme",
          type: "registry:theme",
          files: [
            {
              path: "styles/styles.css",
              type: "registry:style",
              target: "~/styles/styles.css",
              content: "/* panel */\n/* dialog */\n/* shared */",
            },
          ],
        }),
      );
      writeFileSync(
        join(outputDir, "dialog-shell.json"),
        JSON.stringify({
          name: "dialog-shell",
          files: [
            {
              path: "registry/ui/shared/dialog.css",
              type: "registry:style",
              content: "/* dialog */",
            },
          ],
        }),
      );
      writeFileSync(
        join(outputDir, "unique.json"),
        JSON.stringify({
          name: "unique",
          files: [
            {
              path: "registry/ui/unique/unique.css",
              type: "registry:style",
              content: "/* panel */",
            },
          ],
        }),
      );
      writeFileSync(
        join(outputDir, "themed.json"),
        JSON.stringify({
          name: "themed",
          files: [
            {
              path: "registry/ui/shared/mixed.css",
              type: "registry:style",
              content: "/* shared */",
            },
          ],
        }),
      );
      writeFileSync(
        join(outputDir, "unthemed.json"),
        JSON.stringify({
          name: "unthemed",
          files: [
            {
              path: "registry/ui/shared/mixed.css",
              type: "registry:style",
              content: "/* shared */",
            },
          ],
        }),
      );

      const stylePolicy = createThemeStyleStripPolicy(
        [
          {
            name: "panel",
            type: "registry:ui",
            dependencies: [],
            registryDependencies: ["theme"],
            files: [],
          },
          {
            name: "dialog",
            type: "registry:ui",
            dependencies: [],
            registryDependencies: ["dialog-shell", "theme"],
            files: [],
          },
          {
            name: "dialog-shell",
            type: "registry:ui",
            dependencies: [],
            registryDependencies: [],
            meta: { hidden: true },
            files: [],
          },
          {
            name: "unique",
            type: "registry:ui",
            dependencies: [],
            registryDependencies: [],
            files: [],
          },
          {
            name: "theme",
            type: "registry:theme",
            dependencies: [],
            registryDependencies: [],
            files: [],
          },
          {
            name: "themed",
            type: "registry:ui",
            dependencies: [],
            registryDependencies: ["shared-style", "theme"],
            files: [],
          },
          {
            name: "unthemed",
            type: "registry:ui",
            dependencies: [],
            registryDependencies: ["shared-style"],
            files: [],
          },
          {
            name: "shared-style",
            type: "registry:ui",
            dependencies: [],
            registryDependencies: [],
            meta: { hidden: true },
            files: [],
          },
        ],
        "/* panel */\n/* dialog */\n/* shared */",
      );
      removeDuplicateThemeStylesInPublicRegistry(outputDir, stylePolicy);

      const index = JSON.parse(readFileSync(join(outputDir, "registry.json"), "utf8"));
      const panel = JSON.parse(readFileSync(join(outputDir, "panel.json"), "utf8"));
      const theme = JSON.parse(readFileSync(join(outputDir, "theme.json"), "utf8"));
      const dialog = JSON.parse(readFileSync(join(outputDir, "dialog-shell.json"), "utf8"));
      const unique = JSON.parse(readFileSync(join(outputDir, "unique.json"), "utf8"));
      const themed = JSON.parse(readFileSync(join(outputDir, "themed.json"), "utf8"));
      const unthemed = JSON.parse(readFileSync(join(outputDir, "unthemed.json"), "utf8"));
      expect(index.items[0].files).toHaveLength(1);
      expect(index.items[1].files).toHaveLength(1);
      expect(index.items[2].files).toHaveLength(0);
      expect(index.items[3].files).toHaveLength(1);
      expect(panel.files).toHaveLength(1);
      expect(dialog.files).toHaveLength(0);
      expect(theme.files).toHaveLength(1);
      expect(unique.files).toHaveLength(1);
      expect(unique.files[0].content).toBe("/* panel */");
      expect(index.items[4].files).toHaveLength(0);
      expect(index.items[5].files).toHaveLength(1);
      expect(themed.files).toHaveLength(0);
      expect(unthemed.files).toHaveLength(1);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
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
