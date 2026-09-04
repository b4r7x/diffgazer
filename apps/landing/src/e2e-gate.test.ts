import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packageRoot = resolve(import.meta.dirname, "..");
const repoRoot = resolve(packageRoot, "../..");

const scripts = (
  JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  }
).scripts;
const turboTasks = (
  JSON.parse(readFileSync(join(repoRoot, "turbo.json"), "utf8")) as {
    tasks: Record<string, { dependsOn?: string[]; cache?: boolean }>;
  }
).tasks;

describe("landing browser suite gate", () => {
  it("orders the build ahead of the suite in the task graph", () => {
    const task = turboTasks["@diffgazer/landing#test:e2e"];

    expect(task?.dependsOn).toContain("build");
    expect(task?.cache).toBe(false);
  });

  it("stops with a build instruction instead of previewing an unbuilt tree", () => {
    const emptyTree = mkdtempSync(join(tmpdir(), "diffgazer-landing-unbuilt-"));
    try {
      const result = spawnSync("sh", ["-c", scripts["test:e2e"] ?? ""], {
        cwd: emptyTree,
        encoding: "utf8",
      });

      expect(result.status).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).toMatch(/run pnpm build first/i);
    } finally {
      rmSync(emptyTree, { force: true, recursive: true });
    }
  });
});
