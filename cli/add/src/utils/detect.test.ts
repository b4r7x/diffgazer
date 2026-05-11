import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { afterEach, beforeEach, describe } from "node:test";
import { detectProject } from "./detect.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dgadd-detect-"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ type: "module" }));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("detectProject aliases", () => {
  function writeViteConfig(lines: string[]): void {
    writeFileSync(join(root, "vite.config.ts"), [...lines, ""].join("\n"));
  }

  function assertDetectedAlias(expected: { importAliasPrefix: string; sourceDir: string }): void {
    const project = detectProject(root);

    assert.equal(project.hasPathAlias, true);
    assert.equal(project.importAliasPrefix, expected.importAliasPrefix);
    assert.equal(project.sourceDir, expected.sourceDir);
  }

  test("detects a custom TypeScript source alias", () => {
    writeFileSync(join(root, "tsconfig.json"), JSON.stringify({
      compilerOptions: {
        baseUrl: ".",
        paths: { "~/*": ["./src/*"] },
      },
    }));

    const project = detectProject(root);

    assert.equal(project.hasPathAlias, true);
    assert.equal(project.importAliasPrefix, "~");
    assert.equal(project.sourceDir, "src");
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
  ]) {
    test(`detects ${fixture.name} when TypeScript paths are absent`, () => {
      writeViteConfig(fixture.config);
      assertDetectedAlias(fixture.expected);
    });
  }

  test("ignores subpath-only TypeScript aliases", () => {
    writeFileSync(join(root, "tsconfig.json"), JSON.stringify({
      compilerOptions: {
        baseUrl: ".",
        paths: { "@components/*": ["./src/components/*"] },
      },
    }));

    const project = detectProject(root);

    assert.equal(project.hasPathAlias, false);
    assert.equal(project.importAliasPrefix, "@");
  });

  test("prefers root TypeScript aliases over subpath aliases", () => {
    writeFileSync(join(root, "tsconfig.json"), JSON.stringify({
      compilerOptions: {
        baseUrl: ".",
        paths: {
          "@components/*": ["./src/components/*"],
          "~/*": ["./src/*"],
        },
      },
    }));

    const project = detectProject(root);

    assert.equal(project.hasPathAlias, true);
    assert.equal(project.importAliasPrefix, "~");
    assert.equal(project.sourceDir, "src");
  });

  test("prefers @ root aliases over subpath aliases", () => {
    writeFileSync(join(root, "tsconfig.json"), JSON.stringify({
      compilerOptions: {
        baseUrl: ".",
        paths: {
          "@components/*": ["./src/components/*"],
          "@/*": ["./src/*"],
        },
      },
    }));

    const project = detectProject(root);

    assert.equal(project.hasPathAlias, true);
    assert.equal(project.importAliasPrefix, "@");
    assert.equal(project.sourceDir, "src");
  });

});
