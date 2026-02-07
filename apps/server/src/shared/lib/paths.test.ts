import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { homedir } from "node:os";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

import {
  resolveProjectRoot,
  getGlobalStargazerDir,
} from "./paths.js";

const home = homedir();

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.STARGAZER_HOME;
});

describe("resolveProjectRoot", () => {
  it("should prioritize header over env and cwd", () => {
    const result = resolveProjectRoot({
      header: `${home}/from/header`,
      env: "/from/env",
      cwd: "/from/cwd",
    });
    expect(result).toBe(`${home}/from/header`);
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
      header: `  ${home}/spaced/path  `,
    });
    expect(result).toBe(`${home}/spaced/path`);
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

  it("should reject header paths outside user home without .git", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    expect(() =>
      resolveProjectRoot({ header: "/etc/passwd" })
    ).toThrow("Invalid project root");
  });

  it("should allow header paths outside home if they have .git", () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      return p === "/opt/repo/.git";
    });

    const result = resolveProjectRoot({ header: "/opt/repo" });
    expect(result).toBe("/opt/repo");
  });

  it("should allow header paths under user home", () => {
    const result = resolveProjectRoot({
      header: `${home}/projects/my-app`,
    });
    expect(result).toBe(`${home}/projects/my-app`);
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

