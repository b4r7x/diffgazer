import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Hono } from "hono";
import { PROJECT_ROOT_HEADER } from "../lib/paths.js";

let diffgazerHome: string;
let projectRoot: string;

async function createApp(): Promise<Hono> {
  const { requireRepoAccess } = await import("./trust-guard.js");
  const app = new Hono();
  app.use("/*", requireRepoAccess);
  app.get("/test", (ctx) => ctx.json({ ok: true }));
  return app;
}

async function saveTrust(readFiles: boolean): Promise<void> {
  const store = await import("../lib/config/store.js");
  const project = store.getProjectInfo(projectRoot);
  store.saveTrust({
    projectId: project.projectId,
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

describe("requireRepoAccess", () => {
  beforeEach(() => {
    diffgazerHome = mkdtempSync(join(tmpdir(), "diffgazer-trust-home-"));
    projectRoot = mkdtempSync(join(tmpdir(), "diffgazer-trust-project-"));
    mkdirSync(join(projectRoot, ".git"));
    process.env.DIFFGAZER_HOME = diffgazerHome;
    vi.resetModules();
  });

  afterEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    delete process.env.DIFFGAZER_HOME;
    rmSync(diffgazerHome, { recursive: true, force: true });
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it("blocks requests when trust is missing", async () => {
    const app = await createApp();

    const response = await request(app);
    const body = await response.json() as { error: { code: string } };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("TRUST_REQUIRED");
  });

  it("blocks requests when readFiles has not been granted", async () => {
    await saveTrust(false);
    const app = await createApp();

    const response = await request(app);
    const body = await response.json() as { error: { code: string } };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("TRUST_REQUIRED");
  });

  it("passes requests when readFiles has been granted", async () => {
    await saveTrust(true);
    const app = await createApp();

    const response = await request(app);
    const body = await response.json() as { ok: boolean };

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
  });
});
