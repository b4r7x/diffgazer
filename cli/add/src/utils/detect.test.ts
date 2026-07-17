import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCli } from "@diffgazer/registry/cli";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { addCommand } from "../commands/add/command.js";
import { initCommand } from "../commands/init.js";
import { resolveConfig } from "../context.js";
import { detectProject } from "./detect.js";
import { normalizeManifestPath } from "./paths.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dgadd-detect-"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ type: "module" }));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("project path boundaries", () => {
  test("accepts in-project names beginning with two dots", () => {
    const directory = "..components";
    const absoluteFile = join(root, directory, "button.tsx");

    expect(resolveConfig({ componentsFsPath: directory }, root).componentsFsPath).toBe(directory);
    expect(normalizeManifestPath(root, absoluteFile)).toBe(`${directory}/button.tsx`);
  });

  test("rejects parent traversal", () => {
    const outsideFile = join(root, "..", "escape", "button.tsx");

    expect(() => resolveConfig({ componentsFsPath: "../escape" }, root)).toThrow(
      /Path traversal detected/,
    );
    expect(() => normalizeManifestPath(root, outsideFile)).toThrow(/Path traversal detected/);
  });
});

describe("detectProject aliases", () => {
  function writeViteConfig(lines: string[]): void {
    writeFileSync(join(root, "vite.config.ts"), [...lines, ""].join("\n"));
  }

  function assertDetectedAlias(expected: { importAliasPrefix: string; sourceDir: string }): void {
    const project = detectProject(root);

    expect(project.hasPathAlias).toBe(true);
    expect(project.importAliasPrefix).toBe(expected.importAliasPrefix);
    expect(project.sourceDir).toBe(expected.sourceDir);
  }

  function assertNoDetectedAlias(): void {
    const project = detectProject(root);

    expect(project.hasPathAlias).toBe(false);
    expect(project.importAliasPrefix).toBe("@");
  }

  test("detects a custom TypeScript source alias", () => {
    writeFileSync(
      join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          baseUrl: ".",
          paths: { "~/*": ["./src/*"] },
        },
      }),
    );

    const project = detectProject(root);

    expect(project.hasPathAlias).toBe(true);
    expect(project.importAliasPrefix).toBe("~");
    expect(project.sourceDir).toBe("src");
  });

  test("detects a TypeScript source alias in JSONC with trailing commas", () => {
    writeFileSync(
      join(root, "tsconfig.json"),
      [
        "{",
        "  // dgadd must accept the same JSONC syntax as TypeScript.",
        '  "compilerOptions": {',
        '    "baseUrl": ".",',
        '    "paths": {',
        '      "~/*": ["./src/*",],',
        "    },",
        "  },",
        "}",
      ].join("\n"),
    );

    assertDetectedAlias({ importAliasPrefix: "~", sourceDir: "src" });
  });

  test("initializes and installs under a baseUrl src wildcard alias", async () => {
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({
        name: "fixture",
        type: "module",
        packageManager: "npm@10.9.2",
        devDependencies: { tailwindcss: "^4.1.0" },
      }),
    );
    writeFileSync(
      join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          baseUrl: "./src",
          paths: { "@/*": ["*"] },
        },
      }),
    );

    expect(detectProject(root)).toMatchObject({
      hasPathAlias: true,
      importAliasPrefix: "@",
      sourceDir: "src",
    });

    const init = createCli({
      name: "dgadd-base-url-init-test",
      displayName: "DGADD BASE URL INIT TEST",
      description: "baseUrl init regression",
      version: "0.0.0",
      commands: [initCommand],
    });
    await init.parseAsync(["init", "--cwd", root, "--yes", "--skip-install"], {
      from: "user",
    });

    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8")) as {
      aliases: Record<string, string>;
      componentsFsPath: string;
      hooksFsPath: string;
      libFsPath: string;
      tailwind: { css: string };
    };
    expect(config).toMatchObject({
      aliases: {
        components: "@/components/ui",
        hooks: "@/hooks",
        lib: "@/lib",
        utils: "@/lib/utils",
      },
      componentsFsPath: "src/components/ui",
      hooksFsPath: "src/hooks",
      libFsPath: "src/lib",
      tailwind: { css: "src/styles/styles.css" },
    });

    const add = createCli({
      name: "dgadd-base-url-add-test",
      displayName: "DGADD BASE URL ADD TEST",
      description: "baseUrl add regression",
      version: "0.0.0",
      commands: [addCommand],
    });
    await add.parseAsync(
      ["add", "ui/button", "--integration", "none", "--cwd", root, "--yes", "--skip-install"],
      { from: "user" },
    );

    expect(existsSync(join(root, "src/components/ui/button/button.tsx"))).toBe(true);
    expect(existsSync(join(root, "components/ui/button/button.tsx"))).toBe(false);
  });

  test("detects an alias inherited from a package-name tsconfig base", () => {
    const packageDir = join(root, "node_modules/@fixture/tsconfig");
    mkdirSync(packageDir, { recursive: true });
    writeFileSync(
      join(packageDir, "package.json"),
      JSON.stringify({ name: "@fixture/tsconfig", tsconfig: "./base.json" }),
    );
    writeFileSync(
      join(packageDir, "base.json"),
      JSON.stringify({
        compilerOptions: { baseUrl: "../../../src", paths: { "~/*": ["*"] } },
      }),
    );
    writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ extends: "@fixture/tsconfig" }));

    assertDetectedAlias({ importAliasPrefix: "~", sourceDir: "src" });
  });

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
    test(`detects ${fixture.name} when TypeScript paths are absent`, () => {
      writeViteConfig(fixture.config);
      assertDetectedAlias(fixture.expected);
    });
  }

  test("ignores subpath-only TypeScript aliases", () => {
    writeFileSync(
      join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          baseUrl: ".",
          paths: { "@components/*": ["./src/components/*"] },
        },
      }),
    );

    const project = detectProject(root);

    expect(project.hasPathAlias).toBe(false);
    expect(project.importAliasPrefix).toBe("@");
  });

  test("prefers root TypeScript aliases over subpath aliases", () => {
    writeFileSync(
      join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          baseUrl: ".",
          paths: {
            "@components/*": ["./src/components/*"],
            "~/*": ["./src/*"],
          },
        },
      }),
    );

    const project = detectProject(root);

    expect(project.hasPathAlias).toBe(true);
    expect(project.importAliasPrefix).toBe("~");
    expect(project.sourceDir).toBe("src");
  });

  test("prefers @ root aliases over subpath aliases", () => {
    writeFileSync(
      join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          baseUrl: ".",
          paths: {
            "@components/*": ["./src/components/*"],
            "@/*": ["./src/*"],
          },
        },
      }),
    );

    const project = detectProject(root);

    expect(project.hasPathAlias).toBe(true);
    expect(project.importAliasPrefix).toBe("@");
    expect(project.sourceDir).toBe("src");
  });

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
