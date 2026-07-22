import { type SpawnSyncReturns, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const docsRoot = resolve(import.meta.dirname, "..");
const routesRoot = resolve(docsRoot, "src/routes");
const ROUTE_GENERATOR_TIMEOUT_MS = 30_000;

function listColocatedRouteTestFilenames(): string[] {
  return readdirSync(routesRoot, { recursive: true, encoding: "utf8" })
    .flatMap((entry) => {
      const base = entry.split(/[/\\]/).pop() ?? entry;
      return /\.test\.tsx?$/.test(base) ? [base] : [];
    })
    .sort();
}

function expectSuccessfulSubprocess(result: SpawnSyncReturns<string>): void {
  expect({
    error: result.error?.message,
    signal: result.signal,
    status: result.status,
  }).toEqual({
    error: undefined,
    signal: null,
    status: 0,
  });
}

function withRestoredRouteTree<T>(run: () => T): T {
  const routeTreePath = resolve(docsRoot, "src/routeTree.gen.ts");
  const existed = existsSync(routeTreePath);
  const contents = existed ? readFileSync(routeTreePath) : undefined;

  try {
    return run();
  } finally {
    if (contents) {
      writeFileSync(routeTreePath, contents);
    } else {
      rmSync(routeTreePath, { force: true });
    }

    expect(existsSync(routeTreePath)).toBe(existed);
    if (contents) {
      expect(readFileSync(routeTreePath)).toEqual(contents);
    }
  }
}

describe("route tree generator", () => {
  it("excludes colocated route tests without warning", () => {
    const routeTestFiles = listColocatedRouteTestFilenames();
    expect(routeTestFiles.length).toBeGreaterThan(0);

    const result = withRestoredRouteTree(() =>
      spawnSync(process.execPath, [resolve(docsRoot, "scripts/generate-route-tree.mjs")], {
        cwd: docsRoot,
        encoding: "utf8",
        env: { ...process.env, NO_COLOR: "1" },
        timeout: ROUTE_GENERATOR_TIMEOUT_MS,
      }),
    );

    expectSuccessfulSubprocess(result);
    expect(result.stdout).toContain("[generate-route-tree] Generated src/routeTree.gen.ts");
    expect(result.stderr).not.toContain("Warning: Route file");
    for (const testFile of routeTestFiles) {
      expect(result.stderr).not.toContain(testFile);
    }
  });

  it("configures the production Vite generator to exclude colocated route tests", () => {
    const routeTestFiles = listColocatedRouteTestFilenames();
    expect(routeTestFiles.length).toBeGreaterThan(0);

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      DOCS_PRERENDER: "0",
      NO_COLOR: "1",
    };
    delete env.VITEST;
    const result = withRestoredRouteTree(() =>
      spawnSync(
        process.execPath,
        [
          "--input-type=module",
          "--eval",
          "import { resolveConfig } from 'vite'; await resolveConfig({ configFile: 'vite.config.ts' }, 'build'); console.log('[vite-config] resolved');",
        ],
        {
          cwd: docsRoot,
          encoding: "utf8",
          env,
          timeout: ROUTE_GENERATOR_TIMEOUT_MS,
        },
      ),
    );

    expectSuccessfulSubprocess(result);
    expect(result.stdout).toContain("[vite-config] resolved");
    expect(result.stderr).not.toContain("Warning: Route file");
    for (const testFile of routeTestFiles) {
      expect(result.stderr).not.toContain(testFile);
    }
  });
});
