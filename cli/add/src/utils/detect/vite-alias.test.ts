import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { detectViteAlias } from "./vite-alias.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dgadd-vite-alias-"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ type: "module" }));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("detectViteAlias", () => {
  function writeViteConfig(lines: string[]): void {
    writeFileSync(join(root, "vite.config.ts"), [...lines, ""].join("\n"));
  }

  function assertDetectedAlias(expected: { importAliasPrefix: string; sourceDir: string }): void {
    const alias = detectViteAlias(root);

    expect(alias).not.toBeNull();
    expect(alias?.importPrefix).toBe(expected.importAliasPrefix);
    expect(alias?.sourceDir).toBe(expected.sourceDir);
  }

  function assertNoDetectedAlias(): void {
    expect(detectViteAlias(root)).toBeNull();
  }

  for (const fixture of [
    {
      name: "Vite object aliases",
      config: [
        "import path from 'node:path';",
        "export default {",
        "  resolve: { alias: { '~': path.resolve(__dirname, './src') } },",
        "};",
      ],
      expected: { importAliasPrefix: "~", sourceDir: "src" },
    },
    {
      name: "Vite array aliases",
      config: [
        "export default {",
        "  resolve: {",
        "    alias: [{ find: '@app', replacement: './app' }],",
        "  },",
        "};",
      ],
      expected: { importAliasPrefix: "@app", sourceDir: "app" },
    },
    {
      name: "Vite aliases with imported resolve",
      config: [
        "import { resolve } from 'node:path';",
        "export default {",
        "  resolve: { alias: { '@': resolve(__dirname, './src') } },",
        "};",
      ],
      expected: { importAliasPrefix: "@", sourceDir: "src" },
    },
    {
      name: "Vite aliases with a renamed resolve",
      config: [
        "import { resolve as resolvePath } from 'path';",
        "export default {",
        "  resolve: { alias: { '@': resolvePath(__dirname, './src') } },",
        "};",
      ],
      expected: { importAliasPrefix: "@", sourceDir: "src" },
    },
    {
      name: "Vite aliases resolved from import.meta.dirname",
      config: [
        "import { resolve } from 'node:path';",
        "export default {",
        "  resolve: { alias: { '@': resolve(import.meta.dirname, './src') } },",
        "};",
      ],
      expected: { importAliasPrefix: "@", sourceDir: "src" },
    },
    {
      name: "Vite aliases with URL pathname",
      config: [
        "export default {",
        "  resolve: {",
        "    alias: [{ find: '@app', replacement: new URL('./app', import.meta.url).pathname }],",
        "  },",
        "};",
      ],
      expected: { importAliasPrefix: "@app", sourceDir: "app" },
    },
    {
      name: "Vite aliases with a renamed URL constructor",
      config: [
        "import { URL as NodeURL } from 'node:url';",
        "export default {",
        "  resolve: { alias: { '@': new NodeURL('./src', import.meta.url).pathname } },",
        "};",
      ],
      expected: { importAliasPrefix: "@", sourceDir: "src" },
    },
    {
      name: "Vite object aliases with fileURLToPath URL targets",
      config: [
        "import { fileURLToPath } from 'node:url';",
        "export default {",
        "  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },",
        "};",
      ],
      expected: { importAliasPrefix: "@", sourceDir: "src" },
    },
    {
      name: "Vite aliases with a renamed fileURLToPath",
      config: [
        "import { fileURLToPath as toPath } from 'url';",
        "export default {",
        "  resolve: { alias: { '@': toPath(new URL('./src', import.meta.url)) } },",
        "};",
      ],
      expected: { importAliasPrefix: "@", sourceDir: "src" },
    },
    {
      name: "Vite array aliases with fileURLToPath URL targets",
      config: [
        "import { fileURLToPath } from 'node:url';",
        "export default {",
        "  resolve: {",
        "    alias: [{ find: '~', replacement: fileURLToPath(new URL('./app', import.meta.url)) }],",
        "  },",
        "};",
      ],
      expected: { importAliasPrefix: "~", sourceDir: "app" },
    },
    {
      name: "Vite defineConfig exports",
      config: [
        "import { defineConfig } from 'vite';",
        "export default defineConfig({",
        "  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },",
        "});",
      ],
      expected: { importAliasPrefix: "@", sourceDir: "src" },
    },
    {
      name: "Vite functional defineConfig exports",
      config: [
        "import { defineConfig } from 'vite';",
        "export default defineConfig(({ mode }) => ({",
        "  resolve: { alias: [{ find: '~', replacement: './src' }] },",
        "}));",
      ],
      expected: { importAliasPrefix: "~", sourceDir: "src" },
    },
  ]) {
    test(`detects ${fixture.name}`, () => {
      writeViteConfig(fixture.config);
      assertDetectedAlias(fixture.expected);
    });
  }

  test.each([
    {
      name: "a local alias-shaped object",
      config: [
        "const labels = { '@': './src' };",
        "export default { plugins: [{ name: 'labels', labels }] };",
      ],
    },
    {
      name: "a plugin-local resolve.alias object",
      config: [
        "const plugin = { resolve: { alias: { '@': './src' } } };",
        "export default { plugins: [plugin] };",
      ],
    },
    {
      name: "an alias array nested under a plugin",
      config: [
        "export default {",
        "  plugins: [{ alias: [{ find: '@', replacement: './src' }] }],",
        "};",
      ],
    },
    {
      name: "resolve-like text in comments, strings, templates, and regex literals",
      config: [
        "// resolve: { alias: { '@': './src' } }",
        "const text = \"resolve: { alias: { '@': './src' } }\";",
        "const template = `resolve: { alias: { '@': './src' } }`;",
        "const pattern = /resolve: \\{ alias: \\{ '@': '\\.\\/src' \\} \\}/;",
        "export default { plugins: [{ text, template, pattern }] };",
      ],
    },
  ])("ignores $name outside the exported resolve.alias value", ({ config }) => {
    writeViteConfig(config);
    assertNoDetectedAlias();
  });

  test.each([
    {
      name: "an object alias with an extra path segment",
      config: [
        "import path from 'node:path';",
        "export default {",
        "  resolve: { alias: { '@': path.resolve(__dirname, 'packages', 'src') } },",
        "};",
      ],
    },
    {
      name: "an array alias with an extra path segment",
      config: [
        "import { resolve } from 'node:path';",
        "export default {",
        "  resolve: {",
        "    alias: [{ find: '@', replacement: resolve(__dirname, 'packages', './app') }],",
        "  },",
        "};",
      ],
    },
    {
      name: "an object alias resolved from a nested base",
      config: [
        "import path from 'node:path';",
        "export default {",
        "  resolve: { alias: { '@': path.resolve('packages', './src') } },",
        "};",
      ],
    },
    {
      name: "an array alias resolved from a nested base",
      config: [
        "import { resolve } from 'node:path';",
        "export default {",
        "  resolve: {",
        "    alias: [{ find: '@', replacement: resolve('packages', './app') }],",
        "  },",
        "};",
      ],
    },
  ])("ignores $name", ({ config }) => {
    writeViteConfig(config);
    assertNoDetectedAlias();
  });

  test.each([
    {
      name: "an alias object nested in a call",
      config: [
        "const makeAlias = (alias) => alias;",
        "export default {",
        "  resolve: { alias: [makeAlias({ find: '@', replacement: './src' })] },",
        "};",
      ],
    },
    {
      name: "an alias object nested in an array",
      config: [
        "export default {",
        "  resolve: { alias: [[{ find: '@', replacement: './src' }]] },",
        "};",
      ],
    },
    {
      name: "an alias object nested in a container",
      config: [
        "export default {",
        "  resolve: { alias: [{ options: { find: '@', replacement: './src' } }] },",
        "};",
      ],
    },
    {
      name: "a computed alias find value",
      config: [
        "export default {",
        "  resolve: { alias: [{ find: '@' + '/components', replacement: './src' }] },",
        "};",
      ],
    },
  ])("ignores $name instead of reading a nested token", ({ config }) => {
    writeViteConfig(config);
    assertNoDetectedAlias();
  });

  test.each([
    {
      name: "an alias collection referenced through a variable",
      config: [
        "const aliases = [{ find: '@', replacement: './src' }];",
        "export default { resolve: { alias: aliases } };",
      ],
    },
    {
      name: "a config referenced through a variable",
      config: [
        "const root = { resolve: { alias: { '@': './src' } } };",
        "const dynamicConfig = {};",
        "export default root && dynamicConfig;",
      ],
    },
    {
      name: "a dynamic resolve expression",
      config: [
        "const rootResolve = { alias: { '@': './src' } };",
        "const dynamicResolve = {};",
        "export default { resolve: rootResolve && dynamicResolve };",
      ],
    },
    {
      name: "a config passed to defineConfig through a variable",
      config: [
        "import { defineConfig } from 'vite';",
        "const config = { resolve: { alias: { '@': './src' } } };",
        "const fallback = {};",
        "export default defineConfig(config) && fallback;",
      ],
    },
  ])("ignores $name", ({ config }) => {
    writeViteConfig(config);
    assertNoDetectedAlias();
  });
});
