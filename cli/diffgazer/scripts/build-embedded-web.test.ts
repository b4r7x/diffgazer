import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PACKAGE_ROOT = resolve(import.meta.dirname, "..");
const WORKSPACE_ROOT = resolve(PACKAGE_ROOT, "../..");
const EMBEDDED_WEB_WORKSPACE_DEPENDENCIES = ["libs/core", "libs/keys", "libs/ui"];
const SENTINEL_API_URL = "https://audit.invalid";
const SENTINEL_SHUTDOWN_TOKEN = "sentinel-shutdown-token";

// The build resolves these packages through their dist trees, which a clean
// checkout or a concurrent `rm -rf dist && tsc` leaves incomplete. Vite then
// blames the manifest, so the missing files are named here instead.
function missingDistEntries(packageDir: string): string[] {
  const manifest = JSON.parse(
    readFileSync(join(WORKSPACE_ROOT, packageDir, "package.json"), "utf8"),
  ) as { exports: Record<string, string | { import?: string }> };

  return Object.values(manifest.exports)
    .map((entry) => (typeof entry === "string" ? entry : entry.import))
    .filter((target): target is string => target?.startsWith("./dist/") === true)
    .filter((target) => !existsSync(join(WORKSPACE_ROOT, packageDir, target)))
    .map((target) => `${packageDir}/${target.slice(2)}`);
}

function collectJsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectJsFiles(path));
      continue;
    }
    if (entry.name.endsWith(".js")) files.push(path);
  }
  return files;
}

describe("cli build graph", () => {
  it("bundles the web app exactly once", () => {
    const manifest = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(manifest.scripts["build:deps"]).not.toContain("@diffgazer/web");
    expect(manifest.scripts["build:web"]).toContain("build-embedded-web.mjs");
  });
});

describe("build-embedded-web", () => {
  it("does not bake inherited VITE_* overrides into emitted chunks", () => {
    const missing = EMBEDDED_WEB_WORKSPACE_DEPENDENCIES.flatMap(missingDistEntries);
    expect(
      missing,
      "the embedded web build resolves its workspace dependencies from dist; build them first",
    ).toEqual([]);

    const outDir = mkdtempSync(join(tmpdir(), "diffgazer-embedded-web-"));
    try {
      execFileSync("node", ["scripts/build-embedded-web.mjs"], {
        cwd: PACKAGE_ROOT,
        env: {
          ...process.env,
          DIFFGAZER_EMBEDDED_WEB_OUT_DIR: outDir,
          VITE_API_URL: SENTINEL_API_URL,
          VITE_DIFFGAZER_SHUTDOWN_TOKEN: SENTINEL_SHUTDOWN_TOKEN,
        },
        stdio: "pipe",
      });

      const bundleText = collectJsFiles(join(outDir, "assets"))
        .map((file) => readFileSync(file, "utf8"))
        .join("\n");
      expect(bundleText).not.toContain(SENTINEL_API_URL);
      expect(bundleText).not.toContain(SENTINEL_SHUTDOWN_TOKEN);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  }, 120_000);
});
