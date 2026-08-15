import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
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

  test("ignores exact TypeScript path keys without a wildcard suffix", () => {
    writeFileSync(
      join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          baseUrl: ".",
          paths: { "@": ["./src"] },
        },
      }),
    );

    const project = detectProject(root);

    expect(project.hasPathAlias).toBe(false);
    expect(project.importAliasPrefix).toBe("@");
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

describe("detectProject dependency versions", () => {
  test("prefers the installed tailwindcss version over the declared range", () => {
    const tailwindDir = join(root, "node_modules/tailwindcss");
    mkdirSync(tailwindDir, { recursive: true });
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({
        type: "module",
        devDependencies: { tailwindcss: "^3.4.17" },
      }),
    );
    writeFileSync(
      join(tailwindDir, "package.json"),
      JSON.stringify({ name: "tailwindcss", version: "4.1.0" }),
    );

    const project = detectProject(root);

    expect(project.tailwindVersion).toBe("4.1.0");
  });

  test("accepts an installed package from a canonical ancestor node_modules", () => {
    const workspace = join(root, "workspace");
    const projectRoot = join(workspace, "apps/web");
    const linkedProject = join(root, "linked-project");
    const tailwindDir = join(workspace, "node_modules/tailwindcss");
    mkdirSync(projectRoot, { recursive: true });
    mkdirSync(tailwindDir, { recursive: true });
    writeFileSync(
      join(projectRoot, "package.json"),
      JSON.stringify({ devDependencies: { tailwindcss: "^3.4.17" } }),
    );
    writeFileSync(
      join(tailwindDir, "package.json"),
      JSON.stringify({ name: "tailwindcss", version: "4.1.0" }),
    );
    symlinkSync(projectRoot, linkedProject, "dir");

    const project = detectProject(linkedProject);

    expect(project.tailwindVersion).toBe("4.1.0");
  });

  test("ignores an installed package reachable only through NODE_PATH", () => {
    const projectRoot = join(root, "project");
    const externalModules = join(root, "external/node_modules");
    const tailwindDir = join(externalModules, "tailwindcss");
    mkdirSync(projectRoot, { recursive: true });
    mkdirSync(tailwindDir, { recursive: true });
    writeFileSync(
      join(projectRoot, "package.json"),
      JSON.stringify({ devDependencies: { tailwindcss: "^3.4.17" } }),
    );
    writeFileSync(
      join(tailwindDir, "package.json"),
      JSON.stringify({ name: "tailwindcss", version: "4.1.0" }),
    );

    const detectModule = pathToFileURL(join(import.meta.dirname, "detect.ts")).href;
    const output = execFileSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--input-type=module",
        "--eval",
        `import { detectProject } from ${JSON.stringify(detectModule)}; process.stdout.write(String(detectProject(${JSON.stringify(projectRoot)}).tailwindVersion));`,
      ],
      {
        encoding: "utf8",
        env: { ...process.env, NODE_PATH: externalModules },
      },
    );

    expect(output).toBe("^3.4.17");
  });

  test("ignores an installed tailwindcss package when package.json does not declare it", () => {
    const tailwindDir = join(root, "node_modules/tailwindcss");
    mkdirSync(tailwindDir, { recursive: true });
    writeFileSync(
      join(tailwindDir, "package.json"),
      JSON.stringify({ name: "tailwindcss", version: "4.1.0" }),
    );

    const project = detectProject(root);

    expect(project.tailwindVersion).toBeNull();
  });

  test("resolves dist-tag next specs for RSC detection", () => {
    const nextDir = join(root, "node_modules/next");
    mkdirSync(join(root, "app"), { recursive: true });
    mkdirSync(nextDir, { recursive: true });
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({
        type: "module",
        dependencies: { next: "latest" },
      }),
    );
    writeFileSync(
      join(nextDir, "package.json"),
      JSON.stringify({ name: "next", version: "15.1.0" }),
    );

    const project = detectProject(root);

    expect(project.rsc).toBe(true);
  });
});
