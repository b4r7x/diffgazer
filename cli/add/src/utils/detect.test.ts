import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
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
  function assertDetectedAlias(expected: { importAliasPrefix: string; sourceDir: string }): void {
    const project = detectProject(root);

    expect(project.hasPathAlias).toBe(true);
    expect(project.importAliasPrefix).toBe(expected.importAliasPrefix);
    expect(project.sourceDir).toBe(expected.sourceDir);
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

  test("falls back to Vite alias detection when TypeScript paths are absent", () => {
    writeFileSync(
      join(root, "vite.config.ts"),
      [
        "import path from 'node:path';",
        "export default {",
        "  resolve: { alias: { '~': path.resolve(__dirname, './src') } },",
        "};",
        "",
      ].join("\n"),
    );

    assertDetectedAlias({ importAliasPrefix: "~", sourceDir: "src" });
  });

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
});
