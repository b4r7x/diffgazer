import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { detectPackageManager, detectSourceDir } from "./detect.js";
import { installDeps } from "./install-deps.js";
import { setSilent } from "./terminal.js";

describe("detectPackageManager", () => {
  let root: string;
  let originalPath: string | undefined;
  let originalUserAgent: string | undefined;
  let originalTestLog: string | undefined;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "registry-detect-"));
    originalPath = process.env.PATH;
    originalUserAgent = process.env.npm_config_user_agent;
    originalTestLog = process.env.DIFFGAZER_PACKAGE_MANAGER_TEST_LOG;
    // Boundary mock: console.warn — detectPackageManager emits expected ambiguity
    // warnings via cli/terminal (which writes to console.warn). Silence them
    // so the test runner output stays focused on real failures.
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    if (originalUserAgent === undefined) delete process.env.npm_config_user_agent;
    else process.env.npm_config_user_agent = originalUserAgent;
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
    if (originalTestLog === undefined) delete process.env.DIFFGAZER_PACKAGE_MANAGER_TEST_LOG;
    else process.env.DIFFGAZER_PACKAGE_MANAGER_TEST_LOG = originalTestLog;
    setSilent(false);
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  it("prefers packageManager over one-off executor user agent", () => {
    writeFileSync(join(root, "package.json"), JSON.stringify({ packageManager: "pnpm@10.0.0" }));
    process.env.npm_config_user_agent = "npm/10.0.0 node/v22";

    expect(detectPackageManager(root)).toBe("pnpm");
  });

  it("recognizes an npm packageManager declaration at the name/version boundary", () => {
    writeFileSync(join(root, "package.json"), JSON.stringify({ packageManager: "npm@10.9.2" }));
    process.env.npm_config_user_agent = "pnpm/10.0.0 node/v22";

    expect(detectPackageManager(root)).toBe("npm");
  });

  it("does not treat a package-manager name prefix as a declaration", () => {
    writeFileSync(join(root, "package.json"), JSON.stringify({ packageManager: "npmrc@1.0.0" }));
    process.env.npm_config_user_agent = "pnpm/10.0.0 node/v22";

    expect(detectPackageManager(root)).toBe("pnpm");
  });

  it("falls back when packageManager is not a string", () => {
    writeFileSync(join(root, "package.json"), JSON.stringify({ packageManager: 10 }));
    writeFileSync(join(root, "pnpm-lock.yaml"), "");

    expect(detectPackageManager(root)).toBe("pnpm");
  });

  it("runs the installer selected by the npm packageManager declaration", async () => {
    const bin = join(root, "bin");
    const log = join(root, "package-manager.log");
    mkdirSync(bin);
    for (const packageManager of ["npm", "pnpm"]) {
      writeFileSync(
        join(bin, packageManager),
        `#!/usr/bin/env node\nconst fs = require("node:fs");\nfs.appendFileSync(process.env.DIFFGAZER_PACKAGE_MANAGER_TEST_LOG, JSON.stringify({ packageManager: ${JSON.stringify(packageManager)}, args: process.argv.slice(2) }) + "\\n");\n`,
        { mode: 0o755 },
      );
    }
    writeFileSync(join(root, "package.json"), JSON.stringify({ packageManager: "npm@10.9.2" }));
    process.env.PATH = `${bin}:${originalPath ?? ""}`;
    process.env.DIFFGAZER_PACKAGE_MANAGER_TEST_LOG = log;
    process.env.npm_config_user_agent = "pnpm/10.0.0 node/v22";
    setSilent(true);

    await installDeps(["react"], root);

    expect(
      readFileSync(log, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line)),
    ).toEqual([{ packageManager: "npm", args: ["install", "react"] }]);
  });

  it("does not crash on malformed package.json and falls back to lockfile detection", () => {
    writeFileSync(join(root, "package.json"), "{ not valid json");
    writeFileSync(join(root, "package-lock.json"), "{}");
    process.env.npm_config_user_agent = "pnpm/10.0.0 node/v22";

    expect(detectPackageManager(root)).toBe("npm");
  });

  it.each([
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["bun.lockb", "bun"],
    ["bun.lock", "bun"],
    ["package-lock.json", "npm"],
  ] as const)("detects %s over one-off executor user agent", (lockfile, expected) => {
    writeFileSync(join(root, "package.json"), "{}");
    writeFileSync(join(root, lockfile), "");
    process.env.npm_config_user_agent = "npm/10.0.0 node/v22";

    expect(detectPackageManager(root)).toBe(expected);
  });

  it("prefers the most recently modified lockfile over one discovered earlier", () => {
    writeFileSync(join(root, "package.json"), "{}");
    writeFileSync(join(root, "pnpm-lock.yaml"), "");
    writeFileSync(join(root, "package-lock.json"), "{}");
    const now = Date.now() / 1000;
    utimesSync(join(root, "pnpm-lock.yaml"), now, now);
    utimesSync(join(root, "package-lock.json"), now + 60, now + 60);

    expect(detectPackageManager(root)).toBe("npm");
  });
});

describe("detectSourceDir", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "registry-source-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it.each([
    {
      label: "root-source aliases",
      files: {
        "tsconfig.json": { compilerOptions: { paths: { "@/*": ["./*"] } } },
      },
      expected: ".",
    },
    {
      label: "aliases from Vite tsconfig.app.json",
      files: {
        "tsconfig.app.json": { compilerOptions: { paths: { "@/*": ["./src/*"] } } },
      },
      expected: "src",
    },
    {
      label: "aliases through local extends",
      files: {
        "tsconfig.base.json": { compilerOptions: { paths: { "@/*": ["./app/*"] } } },
        "tsconfig.json": { extends: "./tsconfig.base.json" },
      },
      expected: "app",
    },
    {
      label: "aliases through a package-name base",
      files: {
        "node_modules/@fixture/tsconfig/package.json": {
          name: "@fixture/tsconfig",
          tsconfig: "./base.json",
        },
        "node_modules/@fixture/tsconfig/base.json": {
          compilerOptions: { baseUrl: "../../../src", paths: { "@/*": ["*"] } },
        },
        "tsconfig.json": { extends: "@fixture/tsconfig" },
      },
      expected: "src",
    },
  ])("detects $label", ({ files, expected }) => {
    for (const [fileName, content] of Object.entries(files)) {
      const path = join(root, fileName);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify(content));
    }

    expect(detectSourceDir(root)).toBe(expected);
  });
});
