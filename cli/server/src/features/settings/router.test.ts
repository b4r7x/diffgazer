import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PROJECT_ROOT_HEADER, SHUTDOWN_TOKEN_HEADER } from "@diffgazer/core/api/protocol";
import {
  acceptProviderConsent,
  LEGACY_V1_HAS_API_KEY_PROPERTY,
} from "@diffgazer/core/schemas/config";
import { requireValue } from "@diffgazer/core/testing/assertions";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfigStore } from "../../shared/lib/config/store.js";
import { assertTempHome } from "../../shared/lib/testing/temp-home.js";
import type { ActiveSession } from "../review/stream/store.js";

const TEST_TOKEN = "test-settings-token";
const ROUTE_BOUNDARY_TIMEOUT_MS = 20_000;

let diffgazerHome: string;
let projectRootA: string;
let projectRootB: string;
let projectAliasA: string;
const loadedStores = new Set<ConfigStore>();

async function loadApp() {
  const { createApp } = await import("../../app.js");
  const app = createApp();
  await (await loadStore()).ready();
  return app;
}

async function loadStore() {
  const { getStore } = await import("../../shared/lib/config/store.js");
  const store = getStore();
  loadedStores.add(store);
  return store;
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

function expectTerminalTrustRevocation(session: ActiveSession): void {
  expect(session.controller.signal.aborted).toBe(true);
  expect(session.controller.signal.reason).toBe("trust_revoked");
  const terminal = session.events.at(-1);
  expect(terminal?.type).toBe("error");
  if (terminal?.type === "error") {
    expect(terminal.error.message).toContain("trust was revoked");
  }
}

function writeBlockedV1Settings(recovery: "valid" | "corrupt"): void {
  const configPath = join(diffgazerHome, "config.json");
  const secretsPath = join(diffgazerHome, "secrets.json");
  const priorConfig = Buffer.from(
    `${JSON.stringify({
      schemaVersion: 2,
      settings: { theme: "auto" },
      selectedConfigurationId: null,
      configurations: [],
    })}\n`,
  );
  writeFileSync(
    configPath,
    `${JSON.stringify({
      settings: { secretsStorage: "file" },
      providers: [
        {
          provider: "gemini",
          [LEGACY_V1_HAS_API_KEY_PROPERTY]: false,
          isActive: true,
          model: "gemini-2.5-flash",
        },
      ],
    })}\n`,
    { mode: 0o600 },
  );
  writeFileSync(secretsPath, '{"providers":{"gemini":"settings-secret-sentinel"}}\n', {
    mode: 0o600,
  });
  writeFileSync(
    `${secretsPath}.recovery`,
    recovery === "valid"
      ? `${JSON.stringify({
          version: 2,
          previousConfig: { existed: true, base64: priorConfig.toString("base64") },
          previousSecrets: { existed: false, base64: null },
        })}\n`
      : "corrupt-settings-recovery-sentinel",
    { mode: 0o600 },
  );
}

describe("settings trust routes — server-scoped project", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let originalToken: string | undefined;

  beforeEach(() => {
    loadedStores.clear();
    diffgazerHome = mkdtempSync(join(tmpdir(), "diffgazer-settings-home-"));
    assertTempHome(diffgazerHome);
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

  afterEach(async () => {
    try {
      for (const store of loadedStores) await store.ready();
      rmSync(diffgazerHome, { recursive: true, force: true });
      rmSync(projectRootA, { recursive: true, force: true });
      rmSync(projectRootB, { recursive: true, force: true });
    } finally {
      loadedStores.clear();
      delete process.env.DIFFGAZER_HOME;
      delete process.env.DIFFGAZER_PROJECT_ROOT;
      delete process.env.DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT;
      if (originalToken === undefined) {
        delete process.env.DIFFGAZER_SHUTDOWN_TOKEN;
      } else {
        process.env.DIFFGAZER_SHUTDOWN_TOKEN = originalToken;
      }
      warnSpy.mockRestore();
    }
  });

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

  it("GET /trust reports a never-visited project as 404, not a server error", async () => {
    const app = await loadApp();

    const res = await app.request("/api/settings/trust", {
      headers: {
        Host: "localhost:3000",
        [SHUTDOWN_TOKEN_HEADER]: TEST_TOKEN,
        [PROJECT_ROOT_HEADER]: projectRootA,
      },
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("DELETE /trust reports nothing removed for a never-visited project", async () => {
    const app = await loadApp();

    const res = await app.request("/api/settings/trust", {
      method: "DELETE",
      headers: {
        Host: "localhost:3000",
        [SHUTDOWN_TOKEN_HEADER]: TEST_TOKEN,
        [PROJECT_ROOT_HEADER]: projectRootA,
      },
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ removed: false });
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

  it("persists the per-call token cap and refuses one outside the supported range", async () => {
    const app = await loadApp();
    const headers = {
      Host: "localhost:3000",
      "Content-Type": "application/json",
      [SHUTDOWN_TOKEN_HEADER]: TEST_TOKEN,
    };

    const write = await app.request("/api/settings", {
      method: "POST",
      headers,
      body: JSON.stringify({ effectiveCallTokenCap: 65_536 }),
    });
    expect(write.status).toBe(200);
    const read = await app.request("/api/settings", { headers });
    await expect(read.json()).resolves.toMatchObject({ effectiveCallTokenCap: 65_536 });

    const rejected = await app.request("/api/settings", {
      method: "POST",
      headers,
      body: JSON.stringify({ effectiveCallTokenCap: 4_096 }),
    });
    expect(rejected.status).toBe(400);
  });

  it("refuses the engine-only synthesis lens as a persisted default", async () => {
    const app = await loadApp();
    const res = await app.request("/api/settings", {
      method: "POST",
      headers: {
        Host: "localhost:3000",
        "Content-Type": "application/json",
        [SHUTDOWN_TOKEN_HEADER]: TEST_TOKEN,
      },
      body: JSON.stringify({ defaultLenses: ["correctness", "synthesis"] }),
    });

    expect(res.status).toBe(400);
  });

  it("persists the global provider consent and serves it back", async () => {
    const app = await loadApp();
    const providerConsent = acceptProviderConsent("2026-08-18T10:00:00.000Z");
    const headers = {
      Host: "localhost:3000",
      "Content-Type": "application/json",
      [SHUTDOWN_TOKEN_HEADER]: TEST_TOKEN,
    };

    const write = await app.request("/api/settings", {
      method: "POST",
      headers,
      body: JSON.stringify({ providerConsent }),
    });
    expect(write.status).toBe(200);
    const read = await app.request("/api/settings", { headers });
    await expect(read.json()).resolves.toMatchObject({ providerConsent });

    const rejected = await app.request("/api/settings", {
      method: "POST",
      headers,
      body: JSON.stringify({
        providerConsent: { version: 0, acceptedAt: "2026-08-18T10:00:00.000Z" },
      }),
    });
    expect(rejected.status).toBe(400);
  });

  it.each([
    "valid",
    "corrupt",
  ] as const)("returns the fixed migration envelope for settings read and write with %s recovery", async (recovery) => {
    const store = await loadStore();
    await expect(store.updateSettings({ theme: "auto" })).resolves.toMatchObject({ ok: true });
    const app = await loadApp();
    writeBlockedV1Settings(recovery);

    const responses = await Promise.all([
      app.request("/api/settings", {
        headers: {
          Host: "localhost:3000",
          [SHUTDOWN_TOKEN_HEADER]: TEST_TOKEN,
        },
      }),
      app.request("/api/settings", {
        method: "POST",
        headers: {
          Host: "localhost:3000",
          "Content-Type": "application/json",
          [SHUTDOWN_TOKEN_HEADER]: TEST_TOKEN,
        },
        body: JSON.stringify({ theme: "dark" }),
      }),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "SECRETS_MIGRATION_FAILED",
          message: "Legacy configuration requires manual migration",
        },
      });
    }
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
    // The store owns this rule, so its crafted remediation must reach the wire
    // instead of a generic schema rejection.
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("STORAGE_NOT_CONFIGURED");
    expect(body.error.message).toContain("cannot be cleared after configuration");
    await expect(store.readSettings()).resolves.toMatchObject({
      ok: true,
      value: { secretsStorage: "file" },
    });
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
    { previousAccess: true, updatedAccess: false },
    { previousAccess: false, updatedAccess: true },
  ])(
    "POST /trust replaces persistent readFiles=$previousAccess with persistent readFiles=$updatedAccess everywhere",
    async ({ previousAccess, updatedAccess }) => {
      const store = await loadStore();
      const project = store.ensureProjectFile(projectRootA);
      const projectId = requireValue(project.projectId, "project A id");
      await store.saveTrust({
        ...trustForProject(projectId, projectRootA),
        capabilities: { readFiles: previousAccess, runCommands: false },
        trustMode: "persistent",
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
          capabilities: { readFiles: updatedAccess },
          trustMode: "persistent",
        }),
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        trust: {
          trustMode: "persistent",
          capabilities: { readFiles: updatedAccess },
        },
      });
      expect(store.getTrust(projectId)?.capabilities.readFiles).toBe(updatedAccess);
      const canonicalProjectRoot = realpathSync.native(projectRootA);
      expect(store.getProjectInfo(canonicalProjectRoot).trust).toMatchObject({
        capabilities: { readFiles: updatedAccess },
        repoRoot: canonicalProjectRoot,
      });
      const { hasRepoReadAccess } = await import("../../shared/middlewares/trust-guard.js");
      expect(hasRepoReadAccess(canonicalProjectRoot)).toBe(updatedAccess);
      const { createConfigStore } = await import("../../shared/lib/config/store.js");
      const restarted = createConfigStore();
      loadedStores.add(restarted);
      expect(restarted.getTrust(projectId)?.capabilities.readFiles).toBe(updatedAccess);
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
    expectTerminalTrustRevocation(session);
    expect(unrelatedSession.isComplete).toBe(false);
    expect(unrelatedSession.controller.signal.aborted).toBe(false);
    sessions.deleteSessionForTests(session.reviewId);
    sessions.deleteSessionForTests(unrelatedSession.reviewId);
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
    expectTerminalTrustRevocation(projectSession);
    expect(unrelatedSession.controller.signal.aborted).toBe(false);
    sessions.deleteSessionForTests(projectSession.reviewId);
    sessions.deleteSessionForTests(unrelatedSession.reviewId);
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
    expect(store.getTrust(projectBId)).not.toBeNull();
    expect(store.getTrust(projectAId)).toBeNull();
  });
});
