import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PROJECT_ROOT_HEADER } from "@diffgazer/core/api/protocol";
import { ok } from "@diffgazer/core/result";
import type { GitStatus } from "@diffgazer/core/schemas/git";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireValue } from "../../testing/assertions.js";

const { mockCreateGitService, mockGitService } = vi.hoisted(() => {
  const service = {
    getStatus: vi.fn(),
    getDiff: vi.fn(),
    isGitInstalled: vi.fn(),
    getHeadCommit: vi.fn(),
    getStatusHash: vi.fn(),
  };
  return {
    mockCreateGitService: vi.fn(() => service),
    mockGitService: service,
  };
});

// Boundary mock: git service wraps git CLI subprocess calls; router mapping stays real.
vi.mock("../../shared/lib/git/service.js", () => ({
  createGitService: mockCreateGitService,
}));

const cleanStatus: GitStatus = {
  isGitRepo: true,
  branch: "main",
  remoteBranch: null,
  ahead: 0,
  behind: 0,
  files: { staged: [], unstaged: [], untracked: [] },
  hasChanges: false,
  conflicted: [],
};

let tempHome: string;
let project: string;
let projectRealpath: string;

beforeEach(async () => {
  tempHome = await mkdtemp(join(tmpdir(), "diffgazer-git-router-home-"));
  project = await mkdtemp(join(tmpdir(), "diffgazer-git-router-proj-"));
  await mkdir(join(project, ".git"));
  await mkdir(join(project, "src"));
  projectRealpath = await realpath(project);
  process.env.DIFFGAZER_HOME = tempHome;
  process.env.DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT = "1";
  vi.resetModules();
  vi.resetAllMocks();
  mockCreateGitService.mockReturnValue(mockGitService);
  mockGitService.isGitInstalled.mockResolvedValue(true);
  mockGitService.getStatus.mockResolvedValue(ok(cleanStatus));
  mockGitService.getDiff.mockResolvedValue(ok("diff --git a/src/app.ts b/src/app.ts\n"));
  mockGitService.getHeadCommit.mockResolvedValue(ok("abc123"));
  mockGitService.getStatusHash.mockResolvedValue({ kind: "full", hash: "status" });
});

afterEach(async () => {
  delete process.env.DIFFGAZER_HOME;
  delete process.env.DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT;
  await rm(tempHome, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 });
  await rm(project, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 });
});

async function createGitApp(): Promise<Hono> {
  const { gitRouter } = await import("./router.js");
  return new Hono().route("/api/git", gitRouter);
}

async function trustProject(projectRoot: string): Promise<void> {
  const { getStore } = await import("../../shared/lib/config/store.js");
  const projectFile = getStore().ensureProjectFile(projectRoot);
  await getStore().saveTrust({
    projectId: requireValue(projectFile.projectId, "project id"),
    repoRoot: projectRoot,
    trustedAt: "2024-01-01T00:00:00.000Z",
    capabilities: { readFiles: true, runCommands: false },
    trustMode: "persistent",
  });
}

function requestOptions(): RequestInit {
  return { headers: { [PROJECT_ROOT_HEADER]: project } };
}

describe("git router", () => {
  it("rejects an escaping status path", async () => {
    await trustProject(project);
    const app = await createGitApp();

    const response = await app.request("/api/git/status?path=../escape", requestOptions());
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_PATH");
    expect(mockCreateGitService).not.toHaveBeenCalled();
  });

  it("rejects an invalid diff mode through query validation", async () => {
    await trustProject(project);
    const app = await createGitApp();

    const response = await app.request("/api/git/diff?mode=garbage", requestOptions());
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("maps a non-repository status response to NOT_GIT_REPO", async () => {
    mockGitService.getStatus.mockResolvedValue(ok({ ...cleanStatus, isGitRepo: false }));
    await trustProject(project);
    const app = await createGitApp();

    const response = await app.request("/api/git/status", requestOptions());
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("NOT_GIT_REPO");
  });

  it("maps a missing git binary to GIT_NOT_FOUND", async () => {
    mockGitService.isGitInstalled.mockResolvedValue(false);
    await trustProject(project);
    const app = await createGitApp();

    const response = await app.request("/api/git/status", requestOptions());
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("GIT_NOT_FOUND");
  });

  it("returns status JSON and passes the path query to the git service", async () => {
    mockGitService.getStatus.mockResolvedValue(
      ok({
        ...cleanStatus,
        files: {
          staged: [],
          unstaged: [{ path: "app.ts", indexStatus: " ", workTreeStatus: "M" }],
          untracked: [],
        },
        hasChanges: true,
      }),
    );
    await trustProject(project);
    const app = await createGitApp();

    const response = await app.request("/api/git/status?path=src", requestOptions());
    const body = (await response.json()) as GitStatus;

    expect(response.status).toBe(200);
    expect(body.isGitRepo).toBe(true);
    expect(body.hasChanges).toBe(true);
    expect(body.files.unstaged[0]?.path).toBe("app.ts");
    expect(mockCreateGitService).toHaveBeenCalledWith({ cwd: join(projectRealpath, "src") });
  });

  it("returns diff JSON and the resolved mode", async () => {
    await trustProject(project);
    const app = await createGitApp();

    const response = await app.request("/api/git/diff?mode=staged&path=src", requestOptions());
    const body = (await response.json()) as { diff: string; mode: string };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      diff: "diff --git a/src/app.ts b/src/app.ts\n",
      mode: "staged",
    });
    expect(mockGitService.getDiff).toHaveBeenCalledWith("staged");
    expect(mockCreateGitService).toHaveBeenCalledWith({ cwd: join(projectRealpath, "src") });
  });
});
