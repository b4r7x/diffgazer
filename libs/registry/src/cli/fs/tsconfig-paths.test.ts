import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readTsConfigPaths } from "./tsconfig-paths.js";

describe("readTsConfigPaths", () => {
  let root: string;

  function writeJson(path: string, value: unknown): void {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(value));
  }

  function installPackageBase(): void {
    const packageDir = join(root, "node_modules/@fixture/tsconfig");
    writeJson(join(packageDir, "package.json"), {
      name: "@fixture/tsconfig",
      tsconfig: "./base.json",
    });
    writeJson(join(packageDir, "base.json"), {
      compilerOptions: {
        baseUrl: "../../../src",
        paths: { "~/*": ["*"] },
      },
    });
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "registry-tsconfig-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("resolves a package-name base and its effective baseUrl", () => {
    installPackageBase();
    writeJson(join(root, "tsconfig.json"), { extends: "@fixture/tsconfig" });

    expect(readTsConfigPaths(root)).toEqual({ "~/*": ["src/*"] });
  });

  it("reads JSONC path maps with trailing commas", () => {
    writeFileSync(
      join(root, "tsconfig.json"),
      [
        "{",
        "  // TypeScript accepts both comments and trailing commas.",
        '  "compilerOptions": {',
        '    "baseUrl": ".",',
        '    "paths": { "~/*": ["./src/*",], },',
        "  },",
        "}",
      ].join("\n"),
    );

    expect(readTsConfigPaths(root)).toEqual({ "~/*": ["src/*"] });
  });

  it("applies a child baseUrl override to inherited package paths", () => {
    installPackageBase();
    writeJson(join(root, "tsconfig.json"), {
      extends: "@fixture/tsconfig",
      compilerOptions: { baseUrl: "./app" },
    });

    expect(readTsConfigPaths(root)).toEqual({ "~/*": ["app/*"] });
  });

  it("applies a child paths override against the inherited baseUrl", () => {
    installPackageBase();
    writeJson(join(root, "tsconfig.json"), {
      extends: "@fixture/tsconfig",
      compilerOptions: { paths: { "@/*": ["../app/*"] } },
    });

    expect(readTsConfigPaths(root)).toEqual({ "@/*": ["app/*"] });
  });

  it("follows project references and terminates an extends cycle", () => {
    writeJson(join(root, "tsconfig.json"), { references: [{ path: "packages/app" }] });
    writeJson(join(root, "packages/app/tsconfig.json"), {
      extends: "./base.json",
      compilerOptions: { paths: { "@/*": ["../../src/*"] } },
    });
    writeJson(join(root, "packages/app/base.json"), { extends: "./tsconfig.json" });

    expect(readTsConfigPaths(root)).toEqual({ "@/*": ["src/*"] });
  });
});
