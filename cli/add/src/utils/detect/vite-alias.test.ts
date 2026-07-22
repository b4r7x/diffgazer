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
      name: "Vite aliases with a renamed resolve from the bare path built-in",
      config: [
        "import { resolve as resolvePath } from 'path';",
        "export default {",
        "  resolve: { alias: { '@': resolvePath(__dirname, './src') } },",
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
      name: "Vite aliases with a renamed URL constructor from node:url",
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
      name: "Vite aliases with renamed fileURLToPath from the bare URL built-in",
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
      name: "Vite named alias arrays",
      config: [
        "const aliases = [{ find: '@', replacement: './src' }];",
        "export default { resolve: { alias: aliases } };",
      ],
      expected: { importAliasPrefix: "@", sourceDir: "src" },
    },
    {
      name: "Vite defineConfig exports",
      config: [
        "import { defineConfig } from 'vite';",
        "const aliases = { '@': new URL('./src', import.meta.url).pathname };",
        "const resolve = { alias: aliases };",
        "const config = { resolve };",
        "export default defineConfig(config);",
      ],
      expected: { importAliasPrefix: "@", sourceDir: "src" },
    },
    {
      name: "Vite functional defineConfig exports",
      config: [
        "import { defineConfig } from 'vite';",
        "export default defineConfig(({ mode }) => {",
        "  const root = mode === 'test' ? 'test' : 'src';",
        "  const helper = () => { if (root) return root; return 'src'; };",
        "  return { resolve: { alias: [{ find: '~', replacement: './src' }] } };",
        "});",
      ],
      expected: { importAliasPrefix: "~", sourceDir: "src" },
    },
    {
      name: "Vite exports with plugin-local shadow bindings",
      config: [
        "const rootResolve = { alias: { '~': './app' } };",
        "function plugin() {",
        "  const rootResolve = { alias: { '@': './src' } };",
        "  return { name: 'shadow', rootResolve };",
        "}",
        "export default { resolve: rootResolve, plugins: [plugin()] };",
      ],
      expected: { importAliasPrefix: "~", sourceDir: "app" },
    },
    {
      name: "Vite defineConfig exports with plugin-local alias shadow bindings",
      config: [
        "import { defineConfig } from 'vite';",
        "const aliases = [{ find: '~', replacement: './app' }];",
        "function plugin() {",
        "  const aliases = [{ find: '@', replacement: './src' }];",
        "  return { name: 'shadow', aliases };",
        "}",
        "export default defineConfig({ resolve: { alias: aliases }, plugins: [plugin()] });",
      ],
      expected: { importAliasPrefix: "~", sourceDir: "app" },
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
      name: "a named alias array with an extra path segment",
      config: [
        "import { resolve } from 'node:path';",
        "const aliases = [",
        "  { find: '@', replacement: resolve(__dirname, 'packages', './app') },",
        "];",
        "export default { resolve: { alias: aliases } };",
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
      name: "a named alias array resolved from a nested base",
      config: [
        "import { resolve } from 'node:path';",
        "const aliases = [",
        "  { find: '@', replacement: resolve('packages', './app') },",
        "];",
        "export default { resolve: { alias: aliases } };",
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
    {
      name: "an earlier dynamic alias with the same find value",
      config: [
        "const condition = true;",
        "export default {",
        "  resolve: {",
        "    alias: [",
        "      { find: '@', replacement: condition ? './app' : './src' },",
        "      { find: '@', replacement: './src' },",
        "    ],",
        "  },",
        "};",
      ],
    },
  ])("ignores $name instead of reading a nested token", ({ config }) => {
    writeViteConfig(config);
    assertNoDetectedAlias();
  });

  test.each([
    {
      name: "a dynamic expression after an exported config identifier",
      config: [
        "const root = { resolve: { alias: { '@': './src' } } };",
        "const dynamicConfig = {};",
        "export default root && dynamicConfig;",
      ],
    },
    {
      name: "a dynamic expression after an exported object",
      config: [
        "const dynamicConfig = {};",
        "export default { resolve: { alias: { '@': './src' } } } && dynamicConfig;",
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
      name: "a trailing expression after defineConfig",
      config: [
        "import { defineConfig } from 'vite';",
        "const config = { resolve: { alias: { '@': './src' } } };",
        "const fallback = {};",
        "export default defineConfig(config) && fallback;",
      ],
    },
    {
      name: "a conditional return before a static functional config return",
      config: [
        "import { defineConfig } from 'vite';",
        "const condition = true;",
        "export default defineConfig(() => {",
        "  if (condition) {",
        "    return { resolve: { alias: { '@': './app' } } };",
        "  }",
        "  return { resolve: { alias: { '@': './src' } } };",
        "});",
      ],
    },
  ])("ignores $name", ({ config }) => {
    writeViteConfig(config);
    assertNoDetectedAlias();
  });

  test.each([
    {
      name: "a locally defined resolve function",
      config: [
        "const resolve = () => './src';",
        "export default { resolve: { alias: { '@': resolve(__dirname, './src') } } };",
      ],
    },
    {
      name: "a locally defined path object",
      config: [
        "const path = { resolve: () => './src' };",
        "export default { resolve: { alias: { '@': path.resolve(__dirname, './src') } } };",
      ],
    },
    {
      name: "a locally defined fileURLToPath function",
      config: [
        "const fileURLToPath = () => './src';",
        "export default {",
        "  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },",
        "};",
      ],
    },
    {
      name: "a locally defined defineConfig function",
      config: [
        "const defineConfig = (value) => value;",
        "export default defineConfig({ resolve: { alias: { '@': './src' } } });",
      ],
    },
    {
      name: "a locally defined URL constructor",
      config: [
        "class URL { constructor() { return { pathname: '/app' }; } }",
        "export default {",
        "  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },",
        "};",
      ],
    },
    {
      name: "a URL function declared after the exported config",
      config: [
        "export default {",
        "  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },",
        "};",
        "function URL() { return { pathname: '/app' }; }",
      ],
    },
    {
      name: "a URL constructor imported from an untrusted module",
      config: [
        "import { URL } from './url.js';",
        "export default {",
        "  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },",
        "};",
      ],
    },
    {
      name: "a locally rebound __dirname",
      config: [
        "import path from 'node:path';",
        "const __dirname = '/packages';",
        "export default {",
        "  resolve: { alias: { '@': path.resolve(__dirname, './src') } },",
        "};",
      ],
    },
    {
      name: "an imported resolve function shadowed inside functional config",
      config: [
        "import { resolve } from 'node:path';",
        "import { defineConfig } from 'vite';",
        "export default defineConfig(() => {",
        "  const resolve = () => './app';",
        "  return { resolve: { alias: { '@': resolve(__dirname, './src') } } };",
        "});",
      ],
    },
  ])("ignores $name without trusted import provenance", ({ config }) => {
    writeViteConfig(config);
    assertNoDetectedAlias();
  });

  test.each([
    {
      name: "a top-level config spread",
      config: [
        "const dynamicConfig = {};",
        "export default { resolve: { alias: { '@': './src' } }, ...dynamicConfig };",
      ],
    },
    {
      name: "a resolve spread",
      config: [
        "const dynamicResolve = {};",
        "export default {",
        "  resolve: { alias: { '@': './src' }, ...dynamicResolve },",
        "};",
      ],
    },
    {
      name: "an alias object spread",
      config: [
        "const dynamicAliases = {};",
        "export default {",
        "  resolve: { alias: { '@': './src', ...dynamicAliases } },",
        "};",
      ],
    },
    {
      name: "an alias array entry spread",
      config: [
        "const dynamicAlias = {};",
        "export default {",
        "  resolve: {",
        "    alias: [{ find: '@', replacement: './src', ...dynamicAlias }],",
        "  },",
        "};",
      ],
    },
    {
      name: "duplicate resolve keys",
      config: [
        "export default {",
        "  resolve: { alias: { '@': './src' } },",
        "  resolve: {},",
        "};",
      ],
    },
    {
      name: "duplicate alias keys",
      config: ["export default {", "  resolve: { alias: { '@': './src' }, alias: {} },", "};"],
    },
    {
      name: "duplicate find keys",
      config: [
        "export default {",
        "  resolve: {",
        "    alias: [{ find: '@', find: '~', replacement: './src' }],",
        "  },",
        "};",
      ],
    },
    {
      name: "duplicate replacement keys",
      config: [
        "export default {",
        "  resolve: {",
        "    alias: [{ find: '@', replacement: './src', replacement: './app' }],",
        "  },",
        "};",
      ],
    },
  ])("ignores $name because it can override static alias data", ({ config }) => {
    writeViteConfig(config);
    assertNoDetectedAlias();
  });

  test.each([
    {
      name: "a reassigned let alias collection",
      config: [
        "let aliases = { '@': './src' };",
        "const dynamicAliases = { '@': './app' };",
        "aliases = dynamicAliases;",
        "export default { resolve: { alias: aliases } };",
      ],
    },
    {
      name: "a mutated const alias property",
      config: [
        "const aliases = { '@': './src' };",
        "aliases['@'] = './app';",
        "export default { resolve: { alias: aliases } };",
      ],
    },
  ])("ignores $name instead of following stale initializer data", ({ config }) => {
    writeViteConfig(config);
    assertNoDetectedAlias();
  });
});
