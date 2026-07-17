import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { BaseRegistryBundleSchema, createRegistryLoader } from "../registry.js";
import { createBundler } from "./bundle.js";
import { detectNpmImports } from "./detect-imports.js";

describe("detectNpmImports", () => {
  it("detects packages from multi-line named imports", () => {
    const source = `
      import {
        buttonVariants,
        type ButtonVariantProps,
      } from "class-variance-authority";
    `;

    expect(detectNpmImports(source)).toEqual(["class-variance-authority"]);
  });
});

describe("createBundler", () => {
  it("does not promote an import example string to a bundle dependency", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "dg-registry-bundler-"));
    try {
      const registryDir = join(rootDir, "registry");
      const uiDir = join(registryDir, "ui", "example");
      mkdirSync(uiDir, { recursive: true });
      writeFileSync(
        join(registryDir, "registry.json"),
        JSON.stringify({
          items: [
            {
              name: "example",
              type: "registry:ui",
              dependencies: [],
              registryDependencies: [],
              files: [{ path: "registry/ui/example/example.tsx", type: "registry:ui" }],
            },
          ],
        }),
      );
      writeFileSync(
        join(uiDir, "example.tsx"),
        [
          `const installExample = 'import { phantom } from "phantom-package"';`,
          'client?.import("phantom-optional-import");',
          'client?.require("phantom-optional-require");',
          'if (ok) /import("phantom-regex-import")/.test(text);',
          'while (ok) /require("phantom-regex-require")/.test(text);',
          'if (ok) {} /require("phantom-block-regex")/.test(text);',
          'function check() {} /import("phantom-function-regex")/.test(text);',
          'class Check {} /require("phantom-class-regex")/.test(text);',
          'const jsx = <code>import("phantom-jsx-import") require("phantom-jsx-require")</code>;',
          'const templateExample = `import("phantom-template-import") require("phantom-template-require")`;',
          'import { real } from "real-package/subpath";',
          'export { value } from "real-export-package";',
          'const lazy = import("real-dynamic-package");',
          "const templateLazy = import(`real-template-literal-package`);",
          `const templateValue = \`raw \${import("real-template-expression-package")} \${require("real-template-expression-require-package")} \${\`nested \${import("real-nested-template-expression-package")}\`}\`;`,
          `const nestedBraceTemplate = \`\${({ nested: { lazy: import("real-template-brace-expression-package") } }).nested}\`;`,
          'const jsxLazy = <code>{import("real-jsx-package")}</code>;',
          'const required = require("real-require-package");',
          "const templateRequired = require(`real-template-require-literal-package`);",
          'const objectRatio = {} / require("real-object-package");',
          'const functionRatio = function named() {} / require("real-function-expression-package");',
          'const arrowRatio = (() => {}) / require("real-arrow-expression-package");',
          'const classRatio = class Named {} / require("real-class-expression-package");',
          'if (ok) {} import("real-after-block-package");',
          'import "real-side-effect-package";',
          'import type { TypeOnly } from "type-only-package";',
          "export const example = real ?? installExample ?? lazy ?? jsxLazy ?? required;",
        ].join("\n"),
      );

      const result = createBundler({
        rootDir,
        outputPath: join(rootDir, "bundle.json"),
      })();

      expect(result.items[0]?.dependencies).toEqual([
        "real-package",
        "real-export-package",
        "real-dynamic-package",
        "real-template-literal-package",
        "real-template-expression-package",
        "real-nested-template-expression-package",
        "real-template-brace-expression-package",
        "real-jsx-package",
        "real-after-block-package",
        "real-template-expression-require-package",
        "real-require-package",
        "real-template-require-literal-package",
        "real-object-package",
        "real-function-expression-package",
        "real-arrow-expression-package",
        "real-class-expression-package",
        "real-side-effect-package",
      ]);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

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
