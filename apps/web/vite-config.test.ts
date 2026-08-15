import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface JsonProject {
  compilerOptions?: { incremental?: boolean; tsBuildInfoFile?: string; types?: string[] };
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

  const testsRoot = resolve(packageRoot, "testing");
  if (existsSync(testsRoot)) {
    for (const entry of readdirSync(testsRoot, { recursive: true, encoding: "utf8" })) {
      const normalized = entry.replaceAll("\\", "/");
      if (/\.tsx?$/.test(normalized)) {
        files.push(`./testing/${normalized}`);
      }
    }
  }

  return files.sort();
}

describe("web executable configuration type coverage", () => {
  it("includes both Vite configuration files in the Node-typed project", () => {
    const packageRoot = import.meta.dirname;
    const tscPath = resolve(packageRoot, "node_modules/typescript/bin/tsc");
    const buildPlan = execFileSync(process.execPath, [tscPath, "--build", "--dry", "--verbose"], {
      cwd: packageRoot,
      encoding: "utf8",
    });
    const packageJson = readProject(resolve(packageRoot, "package.json"));
    const solution = readProject(resolve(packageRoot, "tsconfig.json"));
    const projects = [
      "tsconfig.app.json",
      "tsconfig.test.json",
      "tsconfig.config.json",
      "tsconfig.e2e.json",
    ];
    const resolvedProjects = new Map(
      projects.map((project) => [
        project,
        JSON.parse(
          execFileSync(process.execPath, [tscPath, "--showConfig", "--project", project], {
            cwd: packageRoot,
            encoding: "utf8",
          }),
        ) as JsonProject,
      ]),
    );
    const parsedConfig = resolvedProjects.get("tsconfig.config.json");
    const e2eConfig = resolvedProjects.get("tsconfig.e2e.json");
    const buildInfoFiles = [...resolvedProjects.values()].map(
      (project) => project.compilerOptions?.tsBuildInfoFile,
    );

    expect(packageJson.scripts?.["type-check"]).toBe("tsc -b --force");
    expect(solution.references?.map((reference) => reference.path)).toEqual([
      "./tsconfig.app.json",
      "./tsconfig.test.json",
      "./tsconfig.config.json",
      "./tsconfig.e2e.json",
    ]);
    expect(buildInfoFiles.every((path) => typeof path === "string" && path.length > 0)).toBe(true);
    expect(new Set(buildInfoFiles).size).toBe(projects.length);
    // Every leaf is noEmit, so without incremental mode the `build` script's
    // `tsc -b` and the editor re-check all four projects on every run instead of
    // reusing the build-info files above. `type-check` opts out with `--force`:
    // incremental state does not reliably invalidate on external `.d.ts` changes,
    // so the gate re-checks from scratch rather than false-green on stale info.
    expect(
      [...resolvedProjects.values()].map((project) => project.compilerOptions?.incremental),
    ).toEqual(projects.map(() => true));
    expect(buildPlan).toContain("tsconfig.config.json");
    expect(buildPlan).toContain("tsconfig.e2e.json");
    expect(parsedConfig?.files).toEqual([
      "./vite.config.ts",
      "./vite.embedded.config.ts",
      "./vitest.config.ts",
    ]);
    expect(parsedConfig?.compilerOptions).toMatchObject({ types: ["node"] });
    expect(e2eConfig?.compilerOptions).toMatchObject({
      tsBuildInfoFile: "./node_modules/.tmp/tsconfig.e2e.tsbuildinfo",
      types: ["node", "vite/client"],
    });
    const discoveredE2eFiles = discoverE2eTypeScriptFiles(packageRoot);
    expect(discoveredE2eFiles.length).toBeGreaterThan(0);
    for (const file of discoveredE2eFiles) {
      expect(e2eConfig?.files, `${file} should be included in tsconfig.e2e`).toContain(file);
    }
  });
});
