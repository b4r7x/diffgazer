import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createBundler } from "../cli/bundler/bundle.js";
import { BaseRegistryBundleSchema, createRegistryLoader } from "../cli/registry.js";

describe("createBundler", () => {
  it("writes bundles whose integrity validates after installer schema parsing", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "dg-registry-bundler-"));
    try {
      const registryDir = join(rootDir, "registry");
      const uiDir = join(registryDir, "ui", "button");
      mkdirSync(uiDir, { recursive: true });

      writeFileSync(
        join(registryDir, "registry.json"),
        JSON.stringify({
          items: [
            {
              name: "button",
              type: "registry:ui",
              title: "Button",
              description: "A button",
              dependencies: [],
              registryDependencies: [],
              files: [{ path: "registry/ui/button/button.ts", type: "registry:ui" }],
              meta: { client: true },
            },
          ],
        }),
      );
      writeFileSync(join(uiDir, "button.ts"), "export const button = 'button';\n");

      const outputPath = join(rootDir, "bundle.json");
      createBundler({
        rootDir,
        outputPath,
        extraContent: () => ({ theme: "theme", styles: "styles" }),
      })();

      const BundleSchema = BaseRegistryBundleSchema.extend({
        theme: z.string(),
        styles: z.string(),
      });
      const loadBundle = createRegistryLoader(outputPath, BundleSchema, (bundle) => ({
        items: bundle.items,
        theme: bundle.theme,
        styles: bundle.styles,
      }));

      expect(loadBundle().items[0]?.name).toBe("button");
    } finally {
      rmSync(join(tmpdir(), "outside-registry-source.ts"), { force: true });
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it.each([
    {
      label: "parent-escape relative path",
      buildPath: () => "../outside.ts",
      expectedMessage: "Registry file path must not contain '..' segments",
    },
    {
      label: "absolute path outside registry root",
      buildPath: (_rootDir: string) => {
        const outsidePath = join(tmpdir(), "outside-registry-source.ts");
        writeFileSync(outsidePath, "export const outside = true;\n");
        return outsidePath;
      },
      expectedMessage: "Registry file path must be relative",
    },
  ])("rejects source file with $label", ({ buildPath, expectedMessage }) => {
    const rootDir = mkdtempSync(join(tmpdir(), "dg-registry-bundler-"));
    try {
      const registryDir = join(rootDir, "registry");
      mkdirSync(registryDir, { recursive: true });
      const path = buildPath(rootDir);
      writeFileSync(
        join(registryDir, "registry.json"),
        JSON.stringify({
          items: [
            {
              name: "escape",
              type: "registry:ui",
              files: [{ path, type: "registry:ui" }],
            },
          ],
        }),
      );

      expect(() =>
        createBundler({
          rootDir,
          outputPath: join(rootDir, "bundle.json"),
        })(),
      ).toThrow(expectedMessage);
    } finally {
      rmSync(join(tmpdir(), "outside-registry-source.ts"), { force: true });
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("preserves shadcn metadata fields and side-effect import dependencies", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "dg-registry-bundler-"));
    try {
      const registryDir = join(rootDir, "registry");
      const uiDir = join(registryDir, "ui", "reset");
      mkdirSync(uiDir, { recursive: true });
      writeFileSync(
        join(registryDir, "registry.json"),
        JSON.stringify({
          items: [
            {
              name: "reset",
              type: "registry:ui",
              title: "Reset",
              description: "Reset styles",
              dependencies: [],
              registryDependencies: [],
              devDependencies: ["vite"],
              cssVars: { theme: { reset: "1" } },
              css: "body { margin: 0; }",
              envVars: ["RESET_ENABLED"],
              docs: "https://example.com/reset",
              categories: ["layout"],
              author: "Diffgazer",
              files: [{ path: "registry/ui/reset/reset.ts", type: "registry:ui" }],
              meta: { client: true, custom: "kept" },
            },
          ],
        }),
      );
      writeFileSync(
        join(uiDir, "reset.ts"),
        "import 'normalize.css/reset.css';\nexport const reset = true;\n",
      );

      const result = createBundler({
        rootDir,
        outputPath: join(rootDir, "bundle.json"),
      })();

      expect(result.items[0]).toMatchObject({
        name: "reset",
        dependencies: ["normalize.css"],
        devDependencies: ["vite"],
        cssVars: { theme: { reset: "1" } },
        css: "body { margin: 0; }",
        envVars: ["RESET_ENABLED"],
        docs: "https://example.com/reset",
        categories: ["layout"],
        author: "Diffgazer",
        meta: { client: true, custom: "kept" },
      });
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
