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
  it("detects root-source aliases", () => {
    const root = mkdtempSync(join(tmpdir(), "registry-source-"));
    try {
      writeFileSync(join(root, "tsconfig.json"), JSON.stringify({
        compilerOptions: { paths: { "@/*": ["./*"] } },
      }));

      expect(detectSourceDir(root)).toBe(".");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("detects aliases from Vite tsconfig.app.json", () => {
    const root = mkdtempSync(join(tmpdir(), "registry-source-"));
    try {
      writeFileSync(join(root, "tsconfig.app.json"), JSON.stringify({
        compilerOptions: { paths: { "@/*": ["./src/*"] } },
      }));

      expect(detectSourceDir(root)).toBe("src");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("detects aliases through local extends", () => {
    const root = mkdtempSync(join(tmpdir(), "registry-source-"));
    try {
      writeFileSync(join(root, "tsconfig.base.json"), JSON.stringify({
        compilerOptions: { paths: { "@/*": ["./app/*"] } },
      }));
      writeFileSync(join(root, "tsconfig.json"), JSON.stringify({
        extends: "./tsconfig.base.json",
      }));

      expect(detectSourceDir(root)).toBe("app");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
