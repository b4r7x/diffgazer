import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectPackageManager, detectSourceDir } from "../cli/detect.js";

describe("detectPackageManager", () => {
  let root: string;
  let originalUserAgent: string | undefined;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "registry-detect-"));
    originalUserAgent = process.env.npm_config_user_agent;
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

  for (const fixture of [
    {
      name: "root-source aliases",
      files: {
        "tsconfig.json": { compilerOptions: { paths: { "@/*": ["./*"] } } },
      },
      expected: ".",
    },
    {
      name: "aliases from Vite tsconfig.app.json",
      files: {
        "tsconfig.app.json": { compilerOptions: { paths: { "@/*": ["./src/*"] } } },
      },
      expected: "src",
    },
    {
      name: "aliases through local extends",
      files: {
        "tsconfig.base.json": { compilerOptions: { paths: { "@/*": ["./app/*"] } } },
        "tsconfig.json": { extends: "./tsconfig.base.json" },
      },
      expected: "app",
    },
  ]) {
    it(`detects ${fixture.name}`, () => {
      for (const [fileName, content] of Object.entries(fixture.files)) {
        writeFileSync(join(root, fileName), JSON.stringify(content));
      }

      expect(detectSourceDir(root)).toBe(fixture.expected);
    });
  }
});
