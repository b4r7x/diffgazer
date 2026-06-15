import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { detectPackageManager, detectSourceDir } from "./detect.js";

describe("detectPackageManager", () => {
  let root: string;
  let originalUserAgent: string | undefined;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "registry-detect-"));
    originalUserAgent = process.env.npm_config_user_agent;
    // Boundary mock: console.warn — detectPackageManager emits expected ambiguity
    // warnings via cli/terminal (which writes to console.warn). Silence them
    // so the test runner output stays focused on real failures.
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    if (originalUserAgent === undefined) delete process.env.npm_config_user_agent;
    else process.env.npm_config_user_agent = originalUserAgent;
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  it("prefers packageManager over one-off executor user agent", () => {
    writeFileSync(join(root, "package.json"), JSON.stringify({ packageManager: "pnpm@10.0.0" }));
    process.env.npm_config_user_agent = "npm/10.0.0 node/v22";

    expect(detectPackageManager(root)).toBe("pnpm");
  });

  it("does not crash on malformed package.json and falls back to lockfile detection", () => {
    writeFileSync(join(root, "package.json"), "{ not valid json");
    writeFileSync(join(root, "package-lock.json"), "{}");
    process.env.npm_config_user_agent = "pnpm/10.0.0 node/v22";

    expect(detectPackageManager(root)).toBe("npm");
  });

  it("prefers lockfiles over one-off executor user agent when packageManager is missing", () => {
    writeFileSync(join(root, "package.json"), "{}");
    writeFileSync(join(root, "yarn.lock"), "");
    process.env.npm_config_user_agent = "npm/10.0.0 node/v22";

    expect(detectPackageManager(root)).toBe("yarn");
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
  ])("detects $label", ({ files, expected }) => {
    for (const [fileName, content] of Object.entries(files)) {
      writeFileSync(join(root, fileName), JSON.stringify(content));
    }

    expect(detectSourceDir(root)).toBe(expected);
  });
});
