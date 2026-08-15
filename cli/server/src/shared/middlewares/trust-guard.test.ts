import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PROJECT_ROOT_HEADER } from "@diffgazer/core/api/protocol";
import { requireValue } from "@diffgazer/core/testing/assertions";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertTempHome } from "../lib/testing/temp-home.js";

let diffgazerHome: string;
let projectRoot: string;

// The guard itself calls `getStore()` on the first request, so the store singleton is
// reached through the module rather than a handle any single test holds.
async function drainConfigStore(): Promise<void> {
  const { getStore } = await import("../lib/config/store.js");
  await getStore().ready();
}

async function createApp(): Promise<Hono> {
  const { requireRepoAccess } = await import("./trust-guard.js");
  const app = new Hono();
  app.use("/*", requireRepoAccess);
  app.get("/test", (ctx) => ctx.json({ ok: true }));
  return app;
}

async function saveTrust(readFiles: boolean): Promise<void> {
  const store = (await import("../lib/config/store.js")).getStore();
  const project = store.ensureProjectFile(projectRoot);
  await store.saveTrust({
    projectId: requireValue(project.projectId, "project id"),
    repoRoot: projectRoot,
    trustedAt: "2024-01-01T00:00:00.000Z",
    capabilities: { readFiles, runCommands: false },
    trustMode: "persistent",
  });
}

async function request(app: Hono): Promise<Response> {
  return app.request("/test", {
    headers: { [PROJECT_ROOT_HEADER]: projectRoot },
  });
}

const ACCESS_NOT_GRANTED_MESSAGE =
  "Repository access not granted. Update Trust & Permissions to continue.";
const REPO_ROOT_MISMATCH_MESSAGE =
  "Trust was granted for a different repository root. Re-grant trust for this directory.";

describe("requireRepoAccess", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    diffgazerHome = mkdtempSync(join(tmpdir(), "diffgazer-trust-home-"));
    assertTempHome(diffgazerHome);
    projectRoot = realpathSync.native(mkdtempSync(join(tmpdir(), "diffgazer-trust-project-")));
    mkdirSync(join(projectRoot, ".git"));
    process.env.DIFFGAZER_HOME = diffgazerHome;
    process.env.DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT = "1";
    // The config store dispatches persist*Async without awaiting; production keeps that
    // UX-friendly pattern, so the suite drains it below and silences what it still logs.
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.resetModules();
  });

  // Settle the store's queued persistence, then remove the temp dirs, and only then drop
  // DIFFGAZER_HOME: `paths.ts` re-reads it per call, so restoring it while a persist*Async
  // write is still pending re-points that write at the real ~/.diffgazer.
  afterEach(async () => {
    try {
      await drainConfigStore();
      rmSync(diffgazerHome, { recursive: true, force: true });
      rmSync(projectRoot, { recursive: true, force: true });
    } finally {
      delete process.env.DIFFGAZER_HOME;
      delete process.env.DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT;
      warnSpy.mockRestore();
    }
  });

  it("blocks requests when trust is missing", async () => {
    const app = await createApp();

    const response = await request(app);
    const body = (await response.json()) as { error: { code: string; message: string } };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("TRUST_REQUIRED");
    expect(body.error.message).toBe(ACCESS_NOT_GRANTED_MESSAGE);
  });

  it("blocks requests when readFiles has not been granted", async () => {
    await saveTrust(false);
    const app = await createApp();

    const response = await request(app);
    const body = (await response.json()) as { error: { code: string; message: string } };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("TRUST_REQUIRED");
    expect(body.error.message).toBe(ACCESS_NOT_GRANTED_MESSAGE);
  });

  it("passes requests when readFiles has been granted", async () => {
    await saveTrust(true);
    const app = await createApp();

    const response = await request(app);
    const body = (await response.json()) as { ok: boolean };

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
  });

  it("blocks requests when trust repoRoot does not match the resolved project root", async () => {
    const store = (await import("../lib/config/store.js")).getStore();
    const project = store.ensureProjectFile(projectRoot);
    await store.saveTrust({
      projectId: requireValue(project.projectId, "project id"),
      repoRoot: "/some/other/path",
      trustedAt: "2024-01-01T00:00:00.000Z",
      capabilities: { readFiles: true, runCommands: false },
      trustMode: "persistent",
    });
    const app = await createApp();

    const response = await request(app);
    const body = (await response.json()) as { error: { code: string; message: string } };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("TRUST_REQUIRED");
    expect(body.error.message).toBe(REPO_ROOT_MISMATCH_MESSAGE);
  });
});
