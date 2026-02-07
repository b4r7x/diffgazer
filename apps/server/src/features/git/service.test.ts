import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRealpath, mockExecFileAsync } = vi.hoisted(() => ({
  mockRealpath: vi.fn(),
  mockExecFileAsync: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  realpath: mockRealpath,
}));

vi.mock("node:child_process", () => {
  const execFileFn = Object.assign(
    (..._args: unknown[]) => ({}),
    { [Symbol.for("nodejs.util.promisify.custom")]: mockExecFileAsync },
  );
  return { execFile: execFileFn };
});

import { resolveGitService } from "./service.js";

describe("resolveGitService (path traversal prevention)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: git is installed
    mockExecFileAsync.mockResolvedValue({ stdout: "git version 2.40.0", stderr: "" });
  });

  it("should reject paths with .. traversal", async () => {
    const result = await resolveGitService({
      basePath: "/projects/myapp",
      relativePath: "../etc/passwd",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_PATH");
    }
  });

  it("should reject absolute paths", async () => {
    const result = await resolveGitService({
      basePath: "/projects/myapp",
      relativePath: "/etc/passwd",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_PATH");
    }
  });

  it("should reject Windows-style absolute paths", async () => {
    const result = await resolveGitService({
      basePath: "/projects/myapp",
      relativePath: "C:\\Windows\\System32",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_PATH");
    }
  });

  it("should reject paths with null bytes", async () => {
    const result = await resolveGitService({
      basePath: "/projects/myapp",
      relativePath: "file\0.txt",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_PATH");
    }
  });

  it("should reject backslash paths", async () => {
    const result = await resolveGitService({
      basePath: "/projects/myapp",
      relativePath: "\\etc\\passwd",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_PATH");
    }
  });

  it("should reject symlink escape (realpath resolves outside base)", async () => {
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

  it("should reject when basePath realpath fails", async () => {
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

  it("should accept valid relative paths within project", async () => {
    mockRealpath
      .mockResolvedValueOnce("/projects/myapp")
      .mockResolvedValueOnce("/projects/myapp/src/lib");

    const result = await resolveGitService({
      basePath: "/projects/myapp",
      relativePath: "src/lib",
    });

    expect(result.ok).toBe(true);
  });

  it("should accept basePath without relativePath", async () => {
    mockRealpath.mockResolvedValue("/projects/myapp");

    const result = await resolveGitService({
      basePath: "/projects/myapp",
    });

    expect(result.ok).toBe(true);
  });

  it("should return GIT_NOT_FOUND when git is not installed", async () => {
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
