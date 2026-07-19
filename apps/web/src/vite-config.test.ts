import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
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
    expect(e2eConfig.files).toEqual([
      "./playwright.config.ts",
      "./tests/e2e/responsive-contracts.e2e.ts",
      "./tests/e2e/results-layout.e2e.ts",
      "./tests/e2e/review-parity.e2e.ts",
      "./tests/fixtures/results-layout.tsx",
    ]);
  });
});
