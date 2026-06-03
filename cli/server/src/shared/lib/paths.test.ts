import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getGlobalDiffgazerDir, getGlobalModelsDevCatalogPath, resolveProjectRoot } from "./paths.js";

let tempRoot: string;

beforeEach(async () => {
  tempRoot = await mkdtemp(path.join(tmpdir(), "diffgazer-paths-"));
  delete process.env.DIFFGAZER_HOME;
});

afterEach(async () => {
  delete process.env.DIFFGAZER_HOME;
  await rm(tempRoot, { recursive: true, force: true });
});

describe("resolveProjectRoot", () => {
  it("prioritizes header, then env, then cwd", () => {
    const home = homedir();

    expect(resolveProjectRoot({
      header: `${home}/from/header`,
      env: path.join(tempRoot, "env"),
      cwd: path.join(tempRoot, "cwd"),
    })).toBe(`${home}/from/header`);

    expect(resolveProjectRoot({
      header: null,
      env: path.join(tempRoot, "env"),
      cwd: path.join(tempRoot, "cwd"),
    })).toBe(path.join(tempRoot, "env"));
  });

  it("walks up from cwd to the nearest git root", async () => {
    const repoRoot = path.join(tempRoot, "repo");
    const nested = path.join(repoRoot, "src", "deep");
    await mkdir(path.join(repoRoot, ".git"), { recursive: true });
    await mkdir(nested, { recursive: true });

    expect(resolveProjectRoot({ header: null, env: null, cwd: nested })).toBe(repoRoot);
  });

  it("returns normalized cwd when no git root exists", async () => {
    const cwd = path.join(tempRoot, "no-git", "child");
    await mkdir(cwd, { recursive: true });

    expect(resolveProjectRoot({ header: null, env: null, cwd })).toBe(cwd);
  });

  it("trims blank inputs and falls back to cwd", async () => {
    const cwd = path.join(tempRoot, "fallback");
    await mkdir(cwd, { recursive: true });

    expect(resolveProjectRoot({ header: "  ", env: "", cwd: `  ${cwd}  ` })).toBe(cwd);
  });

  it("rejects header paths outside the home directory unless they are git repositories", async () => {
    const repoRoot = path.join(tempRoot, "external-repo");
    await mkdir(path.join(repoRoot, ".git"), { recursive: true });

    expect(() => resolveProjectRoot({ header: path.join(tempRoot, "external") })).toThrow(
      "Invalid project root",
    );
    expect(resolveProjectRoot({ header: repoRoot })).toBe(repoRoot);
  });
});

describe("getGlobalDiffgazerDir", () => {
  it("uses DIFFGAZER_HOME when set and otherwise defaults under the user home", () => {
    process.env.DIFFGAZER_HOME = `  ${tempRoot}  `;
    expect(getGlobalDiffgazerDir()).toBe(tempRoot);

    delete process.env.DIFFGAZER_HOME;
    expect(getGlobalDiffgazerDir()).toBe(path.join(homedir(), ".diffgazer"));
  });
});

describe("getGlobalModelsDevCatalogPath", () => {
  it("resolves models-dev.json under the global diffgazer dir", () => {
    process.env.DIFFGAZER_HOME = tempRoot;
    expect(getGlobalModelsDevCatalogPath()).toBe(path.join(tempRoot, "models-dev.json"));
  });

  it("defaults under the user home when DIFFGAZER_HOME is unset", () => {
    delete process.env.DIFFGAZER_HOME;
    expect(getGlobalModelsDevCatalogPath()).toBe(
      path.join(homedir(), ".diffgazer", "models-dev.json"),
    );
  });
});
