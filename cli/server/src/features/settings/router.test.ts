import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SHUTDOWN_TOKEN_HEADER } from "@diffgazer/core/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PROJECT_ROOT_HEADER } from "../../shared/lib/paths.js";
import { requireValue } from "../../testing/assertions.js";

const TEST_TOKEN = "test-settings-token";

let diffgazerHome: string;
let projectRootA: string;
let projectRootB: string;

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

describe("settings trust routes — server-scoped project", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let originalToken: string | undefined;

  beforeEach(() => {
    diffgazerHome = mkdtempSync(join(tmpdir(), "diffgazer-settings-home-"));
    projectRootA = mkdtempSync(join(tmpdir(), "diffgazer-settings-projA-"));
    projectRootB = mkdtempSync(join(tmpdir(), "diffgazer-settings-projB-"));
    mkdirSync(join(projectRootA, ".git"));
    mkdirSync(join(projectRootB, ".git"));
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

  it("GET /trust derives project from server, ignoring client projectId query", async () => {
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
  });

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

  it("GET /trust/list only returns the server-resolved project's trust", async () => {
    const store = await loadStore();
    const projectA = store.ensureProjectFile(projectRootA);
    const projectB = store.ensureProjectFile(projectRootB);
    expect(projectA.projectId).toBeTruthy();
    expect(projectB.projectId).toBeTruthy();
    await store.saveTrust(
      trustForProject(requireValue(projectA.projectId, "project A id"), projectRootA),
    );
    await store.saveTrust(
      trustForProject(requireValue(projectB.projectId, "project B id"), projectRootB),
    );

    const app = await loadApp();
    const res = await app.request("/api/settings/trust/list", {
      headers: {
        Host: "localhost:3000",
        [SHUTDOWN_TOKEN_HEADER]: TEST_TOKEN,
        [PROJECT_ROOT_HEADER]: projectRootA,
      },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { projects: Array<{ projectId: string }> };
    expect(body.projects).toHaveLength(1);
    expect(body.projects[0]?.projectId).toBe(projectA.projectId);
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
