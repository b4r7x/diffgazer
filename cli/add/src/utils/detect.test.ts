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

  test("detects Vite object aliases when TypeScript paths are absent", () => {
    writeFileSync(join(root, "vite.config.ts"), [
      "import path from 'node:path';",
      "export default {",
      "  resolve: { alias: { '~': path.resolve(__dirname, './src') } },",
      "};",
      "",
    ].join("\n"));

    const project = detectProject(root);

    assert.equal(project.hasPathAlias, true);
    assert.equal(project.importAliasPrefix, "~");
    assert.equal(project.sourceDir, "src");
  });

  test("detects Vite array aliases", () => {
    writeFileSync(join(root, "vite.config.ts"), [
      "export default {",
      "  resolve: {",
      "    alias: [{ find: '@app', replacement: './app' }],",
      "  },",
      "};",
      "",
    ].join("\n"));

    const project = detectProject(root);

    assert.equal(project.hasPathAlias, true);
    assert.equal(project.importAliasPrefix, "@app");
    assert.equal(project.sourceDir, "app");
  });

  test("detects Vite aliases with imported resolve", () => {
    writeFileSync(join(root, "vite.config.ts"), [
      "import { resolve } from 'node:path';",
      "export default {",
      "  resolve: { alias: { '@': resolve(__dirname, './src') } },",
      "};",
      "",
    ].join("\n"));

    const project = detectProject(root);

    assert.equal(project.hasPathAlias, true);
    assert.equal(project.importAliasPrefix, "@");
    assert.equal(project.sourceDir, "src");
  });

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

  test("detects Vite aliases with URL pathname", () => {
    writeFileSync(join(root, "vite.config.ts"), [
      "export default {",
      "  resolve: {",
      "    alias: [{ find: '@app', replacement: new URL('./app', import.meta.url).pathname }],",
      "  },",
      "};",
      "",
    ].join("\n"));

    const project = detectProject(root);

    assert.equal(project.hasPathAlias, true);
    assert.equal(project.importAliasPrefix, "@app");
    assert.equal(project.sourceDir, "app");
  });

  test("detects Vite object aliases with fileURLToPath URL targets", () => {
    writeFileSync(join(root, "vite.config.ts"), [
      "import { fileURLToPath } from 'node:url';",
      "export default {",
      "  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },",
      "};",
      "",
    ].join("\n"));

    const project = detectProject(root);

    assert.equal(project.hasPathAlias, true);
    assert.equal(project.importAliasPrefix, "@");
    assert.equal(project.sourceDir, "src");
  });

  test("detects Vite array aliases with fileURLToPath URL targets", () => {
    writeFileSync(join(root, "vite.config.ts"), [
      "import { fileURLToPath } from 'node:url';",
      "export default {",
      "  resolve: {",
      "    alias: [{ find: '~', replacement: fileURLToPath(new URL('./app', import.meta.url)) }],",
      "  },",
      "};",
      "",
    ].join("\n"));

    const project = detectProject(root);

    assert.equal(project.hasPathAlias, true);
    assert.equal(project.importAliasPrefix, "~");
    assert.equal(project.sourceDir, "app");
  });
});
