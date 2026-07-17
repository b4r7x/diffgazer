import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PACKAGE_MANAGER_LOCKFILES,
  restorePackageManagerFiles,
  snapshotPackageManagerFiles,
  validateDependencyProtocol,
} from "./package-manager.js";

describe("validateDependencyProtocol", () => {
  const validDeps = [
    "react",
    "react@19",
    "react@>=18 <20",
    "react@18 || 19",
    "@diffgazer/ui",
    "@diffgazer/ui@^1.0.0",
    "lodash.debounce",
    "my-pkg@latest",
  ];

  it.each(validDeps)("accepts valid npm dependency: %s", (dep) => {
    expect(() => validateDependencyProtocol(dep)).not.toThrow();
  });

  const rejectedDeps = [
    { dep: "-foo", reason: "leading-dash option-shaped name" },
    { dep: "--force", reason: "double-dash flag" },
    { dep: "-foo@1.0.0", reason: "option-shaped name with version" },
    { dep: "file:../local-pkg", reason: "file: protocol" },
    { dep: "file:/absolute/path", reason: "file: with absolute path" },
    { dep: "git+ssh://git@github.com:user/repo.git", reason: "git+ssh protocol" },
    { dep: "git+https://github.com/user/repo.git", reason: "git+https protocol" },
    { dep: "git://github.com/user/repo.git", reason: "git: protocol" },
    { dep: "https://registry.example.com/pkg.tgz", reason: "https: protocol" },
    { dep: "http://registry.example.com/pkg.tgz", reason: "http: protocol" },
    { dep: "../evil-package", reason: "path traversal" },
    { dep: "foo/../bar", reason: "embedded path traversal" },
    { dep: "/etc/passwd", reason: "absolute unix path" },
    { dep: "\\\\server\\share", reason: "absolute windows path" },
    { dep: "local-safe@file:/tmp/local-pkg", reason: "package-qualified file source" },
    {
      dep: "@scope/local-safe@file:/tmp/local-pkg",
      reason: "scoped package-qualified file source",
    },
    { dep: "local-safe@link:/tmp/local-pkg", reason: "package-qualified link source" },
    {
      dep: "local-safe@https://registry.example.com/pkg.tgz",
      reason: "package-qualified HTTPS source",
    },
    {
      dep: "local-safe@http://registry.example.com/pkg.tgz",
      reason: "package-qualified HTTP source",
    },
    {
      dep: "local-safe@git+https://github.com/example/repo.git",
      reason: "package-qualified git+ source",
    },
    {
      dep: "@scope/local-safe@git://github.com/example/repo.git",
      reason: "scoped package-qualified git source",
    },
    {
      dep: "local-safe@ssh://git@github.com/example/repo.git",
      reason: "package-qualified SSH git source",
    },
    {
      dep: "@scope/local-safe@github:example/repo",
      reason: "scoped package-qualified GitHub shorthand",
    },
    {
      dep: "local-safe@example/repo",
      reason: "package-qualified hosted git shorthand",
    },
    { dep: "local-safe@npm:lodash@4", reason: "package-qualified npm alias" },
    { dep: "local-safe@workspace:*", reason: "package-qualified workspace source" },
    { dep: "local-safe@.", reason: "package-qualified current directory" },
    { dep: "@scope/local-safe@.", reason: "scoped package-qualified current directory" },
    { dep: "local-safe@.git", reason: "package-qualified dot-relative directory" },
    { dep: "local-safe@portal:local", reason: "package-qualified portal source" },
    { dep: "local-safe@catalog:default", reason: "package-qualified catalog source" },
    { dep: "local-safe@patch:pkg@1.0.0", reason: "package-qualified patch source" },
    { dep: "local-safe@exec:generator", reason: "package-qualified exec source" },
  ];

  it.each(rejectedDeps)("rejects $reason: $dep", ({ dep }) => {
    expect(() => validateDependencyProtocol(dep)).toThrow(/Rejected dependency/);
  });
});

describe("package-manager transaction files", () => {
  it("covers every supported lockfile and restores new files to their absent state", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "registry-package-manager-"));
    try {
      expect(PACKAGE_MANAGER_LOCKFILES).toEqual([
        "pnpm-lock.yaml",
        "yarn.lock",
        "bun.lockb",
        "bun.lock",
        "package-lock.json",
      ]);

      const packageJson = join(tempDir, "package.json");
      const originalPackageJson = '{"name":"fixture"}\n';
      writeFileSync(packageJson, originalPackageJson);
      for (const lockfile of PACKAGE_MANAGER_LOCKFILES.slice(0, 2)) {
        writeFileSync(join(tempDir, lockfile), `original ${lockfile}\n`);
      }

      const snapshot = snapshotPackageManagerFiles(tempDir);
      writeFileSync(packageJson, '{"dependencies":{"added":"1.0.0"}}\n');
      for (const lockfile of PACKAGE_MANAGER_LOCKFILES) {
        writeFileSync(join(tempDir, lockfile), `mutated ${lockfile}\n`);
      }

      restorePackageManagerFiles(snapshot);

      expect(readFileSync(packageJson, "utf-8")).toBe(originalPackageJson);
      for (const [index, lockfile] of PACKAGE_MANAGER_LOCKFILES.entries()) {
        const path = join(tempDir, lockfile);
        if (index < 2) {
          expect(readFileSync(path, "utf-8")).toBe(`original ${lockfile}\n`);
        } else {
          expect(existsSync(path)).toBe(false);
        }
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
