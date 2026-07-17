import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureWithinDir, readTsConfigPaths, withFileLock } from "./fs.js";

describe("ensureWithinDir", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rk-containment-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("rejects symlink escapes through existing parent directories", () => {
    const base = join(tempDir, "project");
    const outside = join(tempDir, "outside");
    mkdirSync(base, { recursive: true });
    mkdirSync(outside, { recursive: true });
    symlinkSync(outside, join(base, "components"));

    expect(() => ensureWithinDir(join(base, "components/button.tsx"), base)).toThrow(
      /symlink|realpath/,
    );
  });
});

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

describe("withFileLock", () => {
  let root: string;
  let lockPath: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "registry-file-lock-"));
    lockPath = join(root, ".diffgazer", "add.lock");
    mkdirSync(dirname(lockPath), { recursive: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  it("recovers a lock owned by a dead process", async () => {
    const deadPid = 987_654_321;
    writeFileSync(lockPath, JSON.stringify({ pid: deadPid, token: "dead-owner" }));
    vi.spyOn(process, "kill").mockImplementation((pid) => {
      if (pid === deadPid) throw Object.assign(new Error("missing process"), { code: "ESRCH" });
      return true;
    });

    let ran = false;
    await withFileLock(lockPath, async () => {
      ran = true;
    });

    expect(ran).toBe(true);
    expect(existsSync(lockPath)).toBe(false);
  });

  it.each([
    "",
    '{"pid":',
    "{}",
  ])("recovers an unchanged malformed lock after the grace period: %j", async (content) => {
    writeFileSync(lockPath, content);
    const startedAt = Date.now();

    await withFileLock(lockPath, async () => {});

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(40);
    expect(existsSync(lockPath)).toBe(false);
  });

  it("does not steal a valid live lock", async () => {
    let releaseOwner = () => {};
    let markAcquired = () => {};
    const acquired = new Promise<void>((resolve) => {
      markAcquired = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releaseOwner = resolve;
    });
    const owner = withFileLock(lockPath, async () => {
      markAcquired();
      await release;
    });
    await acquired;

    let contenderRan = false;
    const contender = withFileLock(lockPath, async () => {
      contenderRan = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 75));

    expect(contenderRan).toBe(false);
    releaseOwner();
    await Promise.all([owner, contender]);
    expect(contenderRan).toBe(true);
    expect(existsSync(lockPath)).toBe(false);
  });

  it("rechecks a partial lock before recovery when a live owner finishes writing it", async () => {
    writeFileSync(lockPath, '{"pid":');
    let contenderRan = false;
    const contender = withFileLock(lockPath, async () => {
      contenderRan = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 10));
    writeFileSync(lockPath, JSON.stringify({ pid: process.pid, token: "live-owner" }));
    await new Promise((resolve) => setTimeout(resolve, 75));

    expect(contenderRan).toBe(false);
    unlinkSync(lockPath);
    await contender;
    expect(contenderRan).toBe(true);
  });
});
