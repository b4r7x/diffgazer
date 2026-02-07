import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

import {
  resolveProjectRoot,
  getGlobalStargazerDir,
  getGlobalConfigPath,
  getGlobalSecretsPath,
  getGlobalTrustPath,
  getGlobalOpenRouterModelsPath,
  getProjectStargazerDir,
  getProjectInfoPath,
} from "./paths.js";

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.STARGAZER_HOME;
});

describe("resolveProjectRoot", () => {
  it("should prioritize header over env and cwd", () => {
    const result = resolveProjectRoot({
      header: "/from/header",
      env: "/from/env",
      cwd: "/from/cwd",
    });
    expect(result).toBe("/from/header");
  });

  it("should use env when no header", () => {
    const result = resolveProjectRoot({
      header: null,
      env: "/from/env",
      cwd: "/from/cwd",
    });
    expect(result).toBe("/from/env");
  });

  it("should use cwd and find git root when no header or env", () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      return p === "/project/.git";
    });

    const result = resolveProjectRoot({
      header: null,
      env: null,
      cwd: "/project/src/deep",
    });
    expect(result).toBe("/project");
  });

  it("should return normalized cwd when no git root found", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = resolveProjectRoot({
      header: null,
      env: null,
      cwd: "/no/git/here",
    });
    expect(result).toBe("/no/git/here");
  });

  it("should trim whitespace from inputs", () => {
    const result = resolveProjectRoot({
      header: "  /spaced/path  ",
    });
    expect(result).toBe("/spaced/path");
  });

  it("should skip empty strings for header and env", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = resolveProjectRoot({
      header: "  ",
      env: "",
      cwd: "/fallback",
    });
    expect(result).toBe("/fallback");
  });
});

describe("getGlobalStargazerDir", () => {
  it("should use STARGAZER_HOME env var when set", () => {
    process.env.STARGAZER_HOME = "/custom/home";
    expect(getGlobalStargazerDir()).toBe("/custom/home");
  });

  it("should default to ~/.stargazer", () => {
    const { homedir } = require("node:os");
    expect(getGlobalStargazerDir()).toBe(path.join(homedir(), ".stargazer"));
  });
});

describe("path helpers", () => {
  it("getGlobalConfigPath returns config.json in global dir", () => {
    process.env.STARGAZER_HOME = "/sg";
    expect(getGlobalConfigPath()).toBe("/sg/config.json");
  });

  it("getGlobalSecretsPath returns secrets.json in global dir", () => {
    process.env.STARGAZER_HOME = "/sg";
    expect(getGlobalSecretsPath()).toBe("/sg/secrets.json");
  });

  it("getGlobalTrustPath returns trust.json in global dir", () => {
    process.env.STARGAZER_HOME = "/sg";
    expect(getGlobalTrustPath()).toBe("/sg/trust.json");
  });

  it("getGlobalOpenRouterModelsPath returns openrouter-models.json", () => {
    process.env.STARGAZER_HOME = "/sg";
    expect(getGlobalOpenRouterModelsPath()).toBe("/sg/openrouter-models.json");
  });

  it("getProjectStargazerDir returns .stargazer in project root", () => {
    expect(getProjectStargazerDir("/my/project")).toBe("/my/project/.stargazer");
  });

  it("getProjectInfoPath returns project.json in .stargazer", () => {
    expect(getProjectInfoPath("/my/project")).toBe(
      "/my/project/.stargazer/project.json",
    );
  });
});
