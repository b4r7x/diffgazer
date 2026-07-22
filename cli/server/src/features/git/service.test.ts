import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRealpath, mockExecFileAsync } = vi.hoisted(() => ({
  mockRealpath: vi.fn(),
  mockExecFileAsync: vi.fn(),
}));

// Boundary mock: node:fs/promises is the Node.js filesystem boundary; tests stub realpath to simulate symlink resolution outcomes deterministically.
vi.mock("node:fs/promises", () => ({
  realpath: mockRealpath,
}));

// Boundary mock: node:child_process is the Node.js external-process boundary; resolveGitService probes for the `git` binary, so tests stub execFile to control the probe result.
vi.mock("node:child_process", () => {
  const execFileFn = Object.assign((..._args: unknown[]) => ({}), {
    [Symbol.for("nodejs.util.promisify.custom")]: mockExecFileAsync,
  });
  return { execFile: execFileFn };
});

import { resolveGitService } from "./service.js";

describe("resolveGitService (path traversal prevention)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: git is installed
    mockExecFileAsync.mockResolvedValue({ stdout: "git version 2.40.0", stderr: "" });
  });

  it("rejects a parent-directory traversal path with INVALID_PATH", async () => {
    const result = await resolveGitService({
      basePath: "/projects/myapp",
      relativePath: "../etc/passwd",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_PATH");
    }
    expect(mockRealpath).not.toHaveBeenCalled();
    expect(mockExecFileAsync).not.toHaveBeenCalled();
  });

  it("rejects symlinks that escape the base via realpath", async () => {
    mockRealpath
      .mockResolvedValueOnce("/projects/myapp") // basePath realpath
      .mockResolvedValueOnce("/etc/secrets"); // targetPath realpath (symlink escape)

    const result = await resolveGitService({
      basePath: "/projects/myapp",
      relativePath: "symlink-to-etc",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_PATH");
    }
  });

  it("rejects unreachable basePath as INVALID_PATH", async () => {
    mockRealpath.mockRejectedValue(new Error("ENOENT"));

    const result = await resolveGitService({
      basePath: "/nonexistent",
      relativePath: "sub",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_PATH");
    }
  });

  it("accepts a relative path that resolves inside the project", async () => {
    mockRealpath
      .mockResolvedValueOnce("/projects/myapp")
      .mockResolvedValueOnce("/projects/myapp/src/lib");

    const result = await resolveGitService({
      basePath: "/projects/myapp",
      relativePath: "src/lib",
    });

    expect(result.ok).toBe(true);
  });

  it("accepts embedded dots inside a relative path segment", async () => {
    mockRealpath
      .mockResolvedValueOnce("/projects/myapp")
      .mockResolvedValueOnce("/projects/myapp/src/foo..bar.ts");

    const result = await resolveGitService({
      basePath: "/projects/myapp",
      relativePath: "src/foo..bar.ts",
    });

    expect(result.ok).toBe(true);
  });

  it("accepts a basePath alone with no relativePath", async () => {
    mockRealpath.mockResolvedValue("/projects/myapp");

    const result = await resolveGitService({
      basePath: "/projects/myapp",
    });

    expect(result.ok).toBe(true);
  });

  it("returns GIT_NOT_FOUND when the git binary is unavailable", async () => {
    mockRealpath.mockResolvedValue("/projects/myapp");
    mockExecFileAsync.mockRejectedValue(new Error("ENOENT"));

    const result = await resolveGitService({
      basePath: "/projects/myapp",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("GIT_NOT_FOUND");
    }
  });
});
