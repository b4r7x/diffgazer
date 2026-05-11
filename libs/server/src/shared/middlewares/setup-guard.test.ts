import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Hono } from "hono";
import { PROJECT_ROOT_HEADER } from "../lib/paths.js";

let diffgazerHome: string;
let projectRoot: string;

async function createApp(): Promise<Hono> {
  const { requireSetup } = await import("./setup-guard.js");
  const app = new Hono();
  app.use("/*", requireSetup);
  app.get("/test", (ctx) => ctx.json({ ok: true }));
  return app;
}

async function configureReadySetup(): Promise<void> {
  const store = await import("../lib/config/store.js");
  store.updateSettings({ secretsStorage: "file" });
  store.saveProviderCredentials({
    provider: "gemini",
    apiKey: "sk-test",
    model: "gemini-2.5-flash",
  });
  const project = store.getProjectInfo(projectRoot);
  store.saveTrust({
    projectId: project.projectId,
    repoRoot: projectRoot,
    trustedAt: "2024-01-01T00:00:00.000Z",
    capabilities: { readFiles: true, runCommands: false },
    trustMode: "persistent",
  });
}

async function request(app: Hono): Promise<Response> {
  return app.request("/test", {
    headers: { [PROJECT_ROOT_HEADER]: projectRoot },
  });
}

describe("requireSetup", () => {
  beforeEach(() => {
    diffgazerHome = mkdtempSync(join(tmpdir(), "diffgazer-setup-home-"));
    projectRoot = mkdtempSync(join(tmpdir(), "diffgazer-setup-project-"));
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

  it("blocks requests until setup has storage, provider, model, and trust", async () => {
    const app = await createApp();

    const response = await request(app);
    const body = await response.json() as {
      error: { code: string; message: string };
    };

    expect(response.status).toBe(503);
    expect(body.error.code).toBe("SETUP_REQUIRED");
    expect(body.error.message).toContain("secretsStorage");
    expect(body.error.message).toContain("provider");
    expect(body.error.message).toContain("model");
    expect(body.error.message).toContain("trust");
  });

  it("passes requests once setup is ready", async () => {
    await configureReadySetup();
    const app = await createApp();

    const response = await request(app);
    const body = await response.json() as { ok: boolean };

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
  });
});
