import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";

const packageRoot = resolve(import.meta.dirname, "..");
const workspaceRoot = resolve(packageRoot, "../..");
const tsupPath = resolve(packageRoot, "node_modules/tsup/dist/cli-default.js");

describe("dgadd bundle contract", () => {
  test("bundles from workspace source without registry dist or docs-only Shiki payloads", () => {
    const root = mkdtempSync(join(tmpdir(), "dgadd-bundle-contract-"));
    try {
      const packageCopy = join(root, "cli/add");
      const registryCopy = join(root, "libs/registry");
      mkdirSync(packageCopy, { recursive: true });
      mkdirSync(registryCopy, { recursive: true });
      cpSync(join(packageRoot, "src"), join(packageCopy, "src"), { recursive: true });
      cpSync(join(workspaceRoot, "libs/registry/src"), join(registryCopy, "src"), {
        recursive: true,
      });
      cpSync(join(workspaceRoot, "libs/core/tsconfig"), join(root, "libs/core/tsconfig"), {
        recursive: true,
      });
      for (const file of ["package.json", "tsconfig.json", "tsup.config.ts"]) {
        copyFileSync(join(packageRoot, file), join(packageCopy, file));
      }
      copyFileSync(
        join(workspaceRoot, "libs/registry/package.json"),
        join(registryCopy, "package.json"),
      );
      mkdirSync(join(packageCopy, "node_modules"));
      symlinkSync(join(packageRoot, "node_modules/tsup"), join(packageCopy, "node_modules/tsup"));

      expect(existsSync(join(registryCopy, "dist"))).toBe(false);
      const outDir = join(root, "bundle");
      execFileSync(process.execPath, [tsupPath, "--out-dir", outDir], {
        cwd: packageCopy,
        env: { ...process.env, npm_config_offline: "true" },
        stdio: "pipe",
      });

      const bundle = readFileSync(join(outDir, "index.js"), "utf-8");
      expect(bundle).not.toContain("@shikijs/langs");
      expect(bundle).not.toContain("shiki/langs/tsx.mjs");
      expect(bundle).not.toContain("Pine Wu");
      expect(bundle).not.toContain("Anthony Fu");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
