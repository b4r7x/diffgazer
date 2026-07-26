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

describe("resolveGitService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: git is installed
    mockExecFileAsync.mockResolvedValue({ stdout: "git version 2.40.0", stderr: "" });
  });

  it("rejects an unreachable basePath as INVALID_PATH", async () => {
    mockRealpath.mockRejectedValue(new Error("ENOENT"));

    const result = await resolveGitService("/nonexistent");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_PATH");
    }
  });

  it("accepts a project root that resolves on disk", async () => {
    mockRealpath.mockResolvedValue("/projects/myapp");

    const result = await resolveGitService("/projects/myapp");

    expect(result.ok).toBe(true);
  });

  it("returns GIT_NOT_FOUND when the git binary is unavailable", async () => {
    mockRealpath.mockResolvedValue("/projects/myapp");
    mockExecFileAsync.mockRejectedValue(new Error("ENOENT"));

    const result = await resolveGitService("/projects/myapp");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("GIT_NOT_FOUND");
    }
  });
});
