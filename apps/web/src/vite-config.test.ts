import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface JsonProject {
  compilerOptions?: { tsBuildInfoFile?: string; types?: string[] };
  files?: string[];
  references?: Array<{ path: string }>;
  scripts?: Record<string, string>;
}

function readProject(path: string): JsonProject {
  return JSON.parse(readFileSync(path, "utf8")) as JsonProject;
}

function discoverE2eTypeScriptFiles(packageRoot: string): string[] {
  const files: string[] = [];
  if (existsSync(resolve(packageRoot, "playwright.config.ts"))) {
    files.push("./playwright.config.ts");
  }

  const testsRoot = resolve(packageRoot, "tests");
  if (existsSync(testsRoot)) {
    for (const entry of readdirSync(testsRoot, { recursive: true, encoding: "utf8" })) {
      const normalized = entry.replaceAll("\\", "/");
      if (/\.tsx?$/.test(normalized)) {
        files.push(`./tests/${normalized}`);
      }
    }
  }

  return files.sort();
}

describe("web executable configuration type coverage", () => {
  it("includes both Vite configuration files in the Node-typed project", () => {
    const packageRoot = resolve(import.meta.dirname, "..");
    const tscPath = resolve(packageRoot, "node_modules/typescript/bin/tsc");
    const buildPlan = execFileSync(process.execPath, [tscPath, "--build", "--dry", "--verbose"], {
      cwd: packageRoot,
      encoding: "utf8",
    });
    const config = execFileSync(
      process.execPath,
      [tscPath, "--showConfig", "--project", "tsconfig.config.json"],
      { cwd: packageRoot, encoding: "utf8" },
    );
    const parsedConfig = JSON.parse(config) as JsonProject & { files?: string[] };
    const e2eConfig = JSON.parse(
      execFileSync(process.execPath, [tscPath, "--showConfig", "--project", "tsconfig.e2e.json"], {
        cwd: packageRoot,
        encoding: "utf8",
      }),
    ) as JsonProject;
    const packageJson = readProject(resolve(packageRoot, "package.json"));
    const solution = readProject(resolve(packageRoot, "tsconfig.json"));
    const projects = [
      "tsconfig.app.json",
      "tsconfig.test.json",
      "tsconfig.config.json",
      "tsconfig.e2e.json",
    ];
    const buildInfoFiles = projects.map(
      (project) =>
        (
          JSON.parse(
            execFileSync(process.execPath, [tscPath, "--showConfig", "--project", project], {
              cwd: packageRoot,
              encoding: "utf8",
            }),
          ) as JsonProject
        ).compilerOptions?.tsBuildInfoFile,
    );

    expect(packageJson.scripts?.["type-check"]).toBe("tsc -b");
    expect(solution.references?.map((reference) => reference.path)).toEqual([
      "./tsconfig.app.json",
      "./tsconfig.test.json",
      "./tsconfig.config.json",
      "./tsconfig.e2e.json",
    ]);
    expect(buildInfoFiles.every((path) => typeof path === "string" && path.length > 0)).toBe(true);
    expect(new Set(buildInfoFiles).size).toBe(projects.length);
    expect(buildPlan).toContain("tsconfig.config.json");
    expect(buildPlan).toContain("tsconfig.e2e.json");
    expect(parsedConfig.files).toEqual(["./vite.config.ts", "./vitest.config.ts"]);
    expect(parsedConfig.compilerOptions).toMatchObject({ types: ["node"] });
    expect(e2eConfig.compilerOptions).toMatchObject({
      tsBuildInfoFile: "./node_modules/.tmp/tsconfig.e2e.tsbuildinfo",
      types: ["node", "vite/client", "@playwright/test"],
    });
    const discoveredE2eFiles = discoverE2eTypeScriptFiles(packageRoot);
    expect(discoveredE2eFiles.length).toBeGreaterThan(0);
    for (const file of discoveredE2eFiles) {
      expect(e2eConfig.files, `${file} should be included in tsconfig.e2e`).toContain(file);
    }
  });
});
