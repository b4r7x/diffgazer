import { type ChildProcess, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { access, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { PROJECT_ROOT_HEADER, SHUTDOWN_TOKEN_HEADER } from "@diffgazer/core/api/protocol";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireValue } from "../../testing/assertions.js";

const TEST_TOKEN = "test-settings-token";
const ROUTE_BOUNDARY_TIMEOUT_MS = 20_000;
const storeModuleUrl = new URL("../../shared/lib/config/store.ts", import.meta.url).href;

const projectIdentityWorker = `
import { access, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

const { createConfigStore } = await import(process.env.STORE_MODULE_URL);
const store = createConfigStore();
await writeFile(process.env.READY_PATH, "ready");
while (true) {
  try {
    await access(process.env.START_PATH);
    break;
  } catch {
    await delay(2);
  }
}
const project = store.ensureProjectFile(process.env.PROJECT_ROOT);
await writeFile(process.env.RESULT_PATH, JSON.stringify(project));
`;

let diffgazerHome: string;
let projectRootA: string;
let projectRootB: string;
let projectAliasA: string;

async function loadApp() {
  const { createApp } = await import("../../app.js");
  return createApp();
}

async function loadStore() {
  const { getStore } = await import("../../shared/lib/config/store.js");
  return getStore();
}

function trustForProject(projectId: string, repoRoot: string) {
  return {
    projectId,
    repoRoot,
    trustedAt: "2024-01-01T00:00:00.000Z",
    capabilities: { readFiles: true, runCommands: false },
    trustMode: "persistent" as const,
  };
}

const persistFailure = {
  ok: false as const,
  error: { code: "PERSIST_FAILED" as const, message: "Failed to persist test data" },
};

async function expectPersistFailure(response: Response): Promise<void> {
  expect(response.status).toBe(500);
  await expect(response.json()).resolves.toMatchObject({
    error: { code: "PERSIST_FAILED" },
  });
}

async function waitForPaths(filePaths: string[]): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (true) {
    try {
      await Promise.all(filePaths.map((filePath) => access(filePath)));
      return;
    } catch {
      if (Date.now() >= deadline) throw new Error("Timed out waiting for project identity workers");
      await delay(10);
    }
  }
}

function waitForExit(child: ChildProcess): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve, reject) => {
    let stderr = "";
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, stderr }));
  });
}

function readProjectId(filePath: string): string {
  const value: unknown = JSON.parse(readFileSync(filePath, "utf8"));
  if (
    typeof value !== "object" ||
    value === null ||
    !("projectId" in value) ||
    typeof value.projectId !== "string"
  ) {
    throw new Error(`Expected project identity in ${filePath}`);
  }
  return value.projectId;
}

describe("settings trust routes — server-scoped project", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let originalToken: string | undefined;

  beforeEach(() => {
    diffgazerHome = mkdtempSync(join(tmpdir(), "diffgazer-settings-home-"));
    projectRootA = mkdtempSync(join(tmpdir(), "diffgazer-settings-projA-"));
    projectRootB = mkdtempSync(join(tmpdir(), "diffgazer-settings-projB-"));
    mkdirSync(join(projectRootA, ".git"));
    mkdirSync(join(projectRootB, ".git"));
    projectAliasA = join(diffgazerHome, "project-a-alias");
    symlinkSync(projectRootA, projectAliasA, "dir");
    process.env.DIFFGAZER_HOME = diffgazerHome;
    process.env.DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT = "1";
    originalToken = process.env.DIFFGAZER_SHUTDOWN_TOKEN;
    process.env.DIFFGAZER_SHUTDOWN_TOKEN = TEST_TOKEN;
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.DIFFGAZER_HOME;
    delete process.env.DIFFGAZER_PROJECT_ROOT;
    delete process.env.DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT;
    if (originalToken === undefined) {
      delete process.env.DIFFGAZER_SHUTDOWN_TOKEN;
    } else {
      process.env.DIFFGAZER_SHUTDOWN_TOKEN = originalToken;
    }
    rmSync(diffgazerHome, { recursive: true, force: true });
    rmSync(projectRootA, { recursive: true, force: true });
    rmSync(projectRootB, { recursive: true, force: true });
    warnSpy.mockRestore();
  });

  it(
    "concurrent project initializers return the same durable identity",
    async () => {
      const barrierRoot = join(diffgazerHome, "project-identity-race");
      mkdirSync(barrierRoot);
      const startPath = join(barrierRoot, "start");
      const workerIds = ["a", "b"] as const;
      const children = workerIds.map((workerId) =>
        spawn(
          process.execPath,
          ["--import", "tsx", "--input-type=module", "--eval", projectIdentityWorker],
          {
            env: {
              ...process.env,
              PROJECT_ROOT: projectRootA,
              READY_PATH: join(barrierRoot, `${workerId}.ready`),
              RESULT_PATH: join(barrierRoot, `${workerId}.json`),
              START_PATH: startPath,
              STORE_MODULE_URL: storeModuleUrl,
            },
            stdio: ["ignore", "ignore", "pipe"],
          },
        ),
      );
      const exits = children.map(waitForExit);

      try {
        await waitForPaths(workerIds.map((workerId) => join(barrierRoot, `${workerId}.ready`)));
        await writeFile(startPath, "start");
        await expect(Promise.all(exits)).resolves.toEqual([
          { code: 0, stderr: "" },
          { code: 0, stderr: "" },
        ]);

        const callerIds = workerIds.map((workerId) =>
          readProjectId(join(barrierRoot, `${workerId}.json`)),
        );
        const durableId = readProjectId(join(projectRootA, ".diffgazer/project.json"));
        const [callerA, callerB] = callerIds;
        if (!callerA || !callerB) throw new Error("Expected two project identity results");

        expect(new Set(callerIds)).toEqual(new Set([durableId]));
        const store = await loadStore();
        await store.saveTrust(trustForProject(callerA, projectRootA));
        expect(store.getTrust(callerB)?.projectId).toBe(durableId);
      } finally {
        for (const child of children) {
          if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
        }
        await Promise.allSettled(exits);
      }
    },
    ROUTE_BOUNDARY_TIMEOUT_MS,
  );

  it(
    "GET /trust derives project from server, ignoring client projectId query",
    async () => {
      const store = await loadStore();
      const project = store.ensureProjectFile(projectRootA);
      expect(project.projectId).toBeTruthy();
      const trust = trustForProject(requireValue(project.projectId, "project A id"), projectRootA);
      await store.saveTrust(trust);

      const app = await loadApp();
      const res = await app.request(`/api/settings/trust?projectId=attacker-supplied-id`, {
        headers: {
          Host: "localhost:3000",
          [SHUTDOWN_TOKEN_HEADER]: TEST_TOKEN,
          [PROJECT_ROOT_HEADER]: projectRootA,
        },
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { trust: { projectId: string } };
      expect(body.trust.projectId).toBe(project.projectId);
    },
    ROUTE_BOUNDARY_TIMEOUT_MS,
  );

  it("GET /trust returns 404 when asking for a different project's trust", async () => {
    const store = await loadStore();
    // Ensure both projects have identity files so the route can resolve projectId
    store.ensureProjectFile(projectRootA);
    const projectB = store.ensureProjectFile(projectRootB);
    expect(projectB.projectId).toBeTruthy();
    const trust = trustForProject(requireValue(projectB.projectId, "project B id"), projectRootB);
    await store.saveTrust(trust);

    const app = await loadApp();
    // Client sends projectB's ID, but server resolves projectRootA
    const res = await app.request(`/api/settings/trust?projectId=${projectB.projectId}`, {
      headers: {
        Host: "localhost:3000",
        [SHUTDOWN_TOKEN_HEADER]: TEST_TOKEN,
        [PROJECT_ROOT_HEADER]: projectRootA,
      },
    });

    expect(res.status).toBe(404);
  });

  it("requires the shutdown token for trust reads even in standalone dev", async () => {
    delete process.env.DIFFGAZER_SHUTDOWN_TOKEN;
    const store = await loadStore();
    store.ensureProjectFile(projectRootA);

    const app = await loadApp();
    const res = await app.request("/api/settings/trust", {
      headers: {
        Host: "localhost:3000",
        [PROJECT_ROOT_HEADER]: projectRootA,
      },
    });

    expect(res.status).toBe(401);
  });

  it("POST /trust normalizes runCommands to false even when client sends true", async () => {
    const store = await loadStore();
    store.ensureProjectFile(projectRootA);

    const app = await loadApp();
    const res = await app.request("/api/settings/trust", {
      method: "POST",
      headers: {
        Host: "localhost:3000",
        "Content-Type": "application/json",
        [SHUTDOWN_TOKEN_HEADER]: TEST_TOKEN,
        [PROJECT_ROOT_HEADER]: projectRootA,
      },
      body: JSON.stringify({
        projectId: "client-supplied",
        repoRoot: "/client-supplied",
        trustedAt: new Date().toISOString(),
        capabilities: { readFiles: true, runCommands: true },
        trustMode: "persistent",
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { trust: { capabilities: { runCommands: boolean } } };
    expect(body.trust.capabilities.runCommands).toBe(false);
  });

  it("requires the shutdown token for trust writes even in standalone dev", async () => {
    delete process.env.DIFFGAZER_SHUTDOWN_TOKEN;
    const store = await loadStore();
    store.ensureProjectFile(projectRootA);

    const app = await loadApp();
    const res = await app.request("/api/settings/trust", {
      method: "POST",
      headers: {
        Host: "localhost:3000",
        "Content-Type": "application/json",
        [PROJECT_ROOT_HEADER]: projectRootA,
      },
      body: JSON.stringify({
        projectId: "client-supplied",
        repoRoot: "/client-supplied",
        trustedAt: new Date().toISOString(),
        capabilities: { readFiles: true, runCommands: false },
        trustMode: "persistent",
      }),
    });

    expect(res.status).toBe(401);
  });

  it("rejects empty defaultLenses persistence", async () => {
    const app = await loadApp();
    const res = await app.request("/api/settings", {
      method: "POST",
      headers: {
        Host: "localhost:3000",
        "Content-Type": "application/json",
        [SHUTDOWN_TOKEN_HEADER]: TEST_TOKEN,
      },
      body: JSON.stringify({ defaultLenses: [] }),
    });

    expect(res.status).toBe(400);
  });

  it("rejects clearing configured secrets storage", async () => {
    const store = await loadStore();
    await expect(store.updateSettings({ secretsStorage: "file" })).resolves.toMatchObject({
      ok: true,
    });
    const app = await loadApp();

    const response = await app.request("/api/settings", {
      method: "POST",
      headers: {
        Host: "localhost:3000",
        "Content-Type": "application/json",
        [SHUTDOWN_TOKEN_HEADER]: TEST_TOKEN,
      },
      body: JSON.stringify({ secretsStorage: null }),
    });

    expect(response.status).toBe(400);
    expect(store.getSettings().secretsStorage).toBe("file");
  });

  it("returns 500 when settings persistence fails", async () => {
    const store = await loadStore();
    vi.spyOn(store, "updateSettings").mockResolvedValue(persistFailure);
    const app = await loadApp();

    const response = await app.request("/api/settings", {
      method: "POST",
      headers: {
        Host: "localhost:3000",
        "Content-Type": "application/json",
        [SHUTDOWN_TOKEN_HEADER]: TEST_TOKEN,
      },
      body: JSON.stringify({ theme: "dark" }),
    });

    await expectPersistFailure(response);
  });

  it("returns 500 when trust persistence fails", async () => {
    const store = await loadStore();
    store.ensureProjectFile(projectRootA);
    vi.spyOn(store, "saveTrust").mockResolvedValue(persistFailure);
    const app = await loadApp();

    const response = await app.request("/api/settings/trust", {
      method: "POST",
      headers: {
        Host: "localhost:3000",
        "Content-Type": "application/json",
        [SHUTDOWN_TOKEN_HEADER]: TEST_TOKEN,
        [PROJECT_ROOT_HEADER]: projectRootA,
      },
      body: JSON.stringify({
        capabilities: { readFiles: true },
        trustMode: "persistent",
      }),
    });

    await expectPersistFailure(response);
  });

  it("returns 500 when trust removal persistence fails", async () => {
    const store = await loadStore();
    store.ensureProjectFile(projectRootA);
    vi.spyOn(store, "removeTrust").mockResolvedValue(persistFailure);
    const app = await loadApp();

    const response = await app.request("/api/settings/trust", {
      method: "DELETE",
      headers: {
        Host: "localhost:3000",
        [SHUTDOWN_TOKEN_HEADER]: TEST_TOKEN,
        [PROJECT_ROOT_HEADER]: projectRootA,
      },
    });

    await expectPersistFailure(response);
  });

  it.each([
    { sessionAccess: true, persistentAccess: false },
    { sessionAccess: false, persistentAccess: true },
  ])(
    "POST /trust replaces session readFiles=$sessionAccess with persistent readFiles=$persistentAccess everywhere",
    async ({ sessionAccess, persistentAccess }) => {
      const store = await loadStore();
      const project = store.ensureProjectFile(projectRootA);
      const projectId = requireValue(project.projectId, "project A id");
      await store.saveTrust({
        ...trustForProject(projectId, projectRootA),
        capabilities: { readFiles: sessionAccess, runCommands: false },
        trustMode: "session",
      });
      const app = await loadApp();

      const response = await app.request("/api/settings/trust", {
        method: "POST",
        headers: {
          Host: "localhost:3000",
          "Content-Type": "application/json",
          [SHUTDOWN_TOKEN_HEADER]: TEST_TOKEN,
          [PROJECT_ROOT_HEADER]: projectRootA,
        },
        body: JSON.stringify({
          capabilities: { readFiles: persistentAccess },
          trustMode: "persistent",
        }),
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        trust: {
          trustMode: "persistent",
          capabilities: { readFiles: persistentAccess },
        },
      });
      expect(store.getTrust(projectId)?.capabilities.readFiles).toBe(persistentAccess);
      const canonicalProjectRoot = realpathSync.native(projectRootA);
      expect(store.getProjectInfo(canonicalProjectRoot).trust).toMatchObject({
        capabilities: { readFiles: persistentAccess },
        repoRoot: canonicalProjectRoot,
      });
      const { hasRepoReadAccess } = await import("../../shared/middlewares/trust-guard.js");
      expect(hasRepoReadAccess(canonicalProjectRoot)).toBe(persistentAccess);
      const { createConfigStore } = await import("../../shared/lib/config/store.js");
      expect(createConfigStore().getTrust(projectId)?.capabilities.readFiles).toBe(
        persistentAccess,
      );
    },
    ROUTE_BOUNDARY_TIMEOUT_MS,
  );

  it("DELETE /trust aborts active review sessions for the project", async () => {
    const store = await loadStore();
    const project = store.ensureProjectFile(projectRootA);
    const projectAId = requireValue(project.projectId, "project A id");
    await store.saveTrust(trustForProject(projectAId, projectRootA));

    const sessions = await import("../review/stream/store.js");
    const session = sessions.createSession("trust-abort-review", {
      projectPath: realpathSync.native(projectRootA),
      headCommit: "abc123",
      statusHash: "hash123",
      statusHashKind: "full" as const,
      mode: "unstaged",
    });
    sessions.markReady(session.reviewId);
    const unrelatedSession = sessions.createSession("unrelated-trust-review", {
      projectPath: realpathSync.native(projectRootB),
      headCommit: "def456",
      statusHash: "hash456",
      statusHashKind: "full" as const,
      mode: "unstaged",
    });
    sessions.markReady(unrelatedSession.reviewId);

    const app = await loadApp();
    const res = await app.request("/api/settings/trust", {
      method: "DELETE",
      headers: {
        Host: "localhost:3000",
        [SHUTDOWN_TOKEN_HEADER]: TEST_TOKEN,
        [PROJECT_ROOT_HEADER]: projectAliasA,
      },
    });

    expect(res.status).toBe(200);
    expect(session.isComplete).toBe(true);
    expect(session.controller.signal.aborted).toBe(true);
    expect(unrelatedSession.isComplete).toBe(false);
    expect(unrelatedSession.controller.signal.aborted).toBe(false);
    sessions.deleteSession(session.reviewId);
    sessions.deleteSession(unrelatedSession.reviewId);
  });

  it("POST /trust through a symlink alias aborts only physical-project sessions on downgrade", async () => {
    const store = await loadStore();
    const project = store.ensureProjectFile(projectRootA);
    const projectAId = requireValue(project.projectId, "project A id");
    await store.saveTrust(trustForProject(projectAId, projectRootA));

    const sessions = await import("../review/stream/store.js");
    const projectSession = sessions.createSession("trust-downgrade-review", {
      projectPath: realpathSync.native(projectRootA),
      headCommit: "abc123",
      statusHash: "hash123",
      statusHashKind: "full" as const,
      mode: "unstaged",
    });
    const unrelatedSession = sessions.createSession("unrelated-downgrade-review", {
      projectPath: realpathSync.native(projectRootB),
      headCommit: "def456",
      statusHash: "hash456",
      statusHashKind: "full" as const,
      mode: "unstaged",
    });
    sessions.markReady(projectSession.reviewId);
    sessions.markReady(unrelatedSession.reviewId);

    const app = await loadApp();
    const res = await app.request("/api/settings/trust", {
      method: "POST",
      headers: {
        Host: "localhost:3000",
        "Content-Type": "application/json",
        [SHUTDOWN_TOKEN_HEADER]: TEST_TOKEN,
        [PROJECT_ROOT_HEADER]: projectAliasA,
      },
      body: JSON.stringify({
        capabilities: { readFiles: false, runCommands: false },
        trustMode: "persistent",
      }),
    });

    expect(res.status).toBe(200);
    expect(projectSession.controller.signal.aborted).toBe(true);
    expect(unrelatedSession.controller.signal.aborted).toBe(false);
    sessions.deleteSession(projectSession.reviewId);
    sessions.deleteSession(unrelatedSession.reviewId);
  });

  it("DELETE /trust derives project from server, cannot delete another project's trust", async () => {
    const store = await loadStore();
    const projectA = store.ensureProjectFile(projectRootA);
    const projectB = store.ensureProjectFile(projectRootB);
    expect(projectA.projectId).toBeTruthy();
    expect(projectB.projectId).toBeTruthy();
    const projectAId = requireValue(projectA.projectId, "project A id");
    const projectBId = requireValue(projectB.projectId, "project B id");
    await store.saveTrust(trustForProject(projectAId, projectRootA));
    await store.saveTrust(trustForProject(projectBId, projectRootB));

    const app = await loadApp();
    // Attempt to delete trust while server resolves to projectRootA
    const res = await app.request(`/api/settings/trust?projectId=${projectB.projectId}`, {
      method: "DELETE",
      headers: {
        Host: "localhost:3000",
        [SHUTDOWN_TOKEN_HEADER]: TEST_TOKEN,
        [PROJECT_ROOT_HEADER]: projectRootA,
      },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { removed: boolean };
    // Server removed projectA's trust (the resolved project), not projectB's
    expect(body.removed).toBe(true);
    // projectB's trust is still intact
    expect(store.getTrust(projectBId)).not.toBeNull();
    // projectA's trust was removed
    expect(store.getTrust(projectAId)).toBeNull();
  });
});
