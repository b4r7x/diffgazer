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
  const store = (await import("../lib/config/store.js")).getStore();
  const project = store.ensureProjectFile(projectRoot);
  await store.saveTrust({
    projectId: project.projectId!,
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
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    diffgazerHome = mkdtempSync(join(tmpdir(), "diffgazer-trust-home-"));
    projectRoot = mkdtempSync(join(tmpdir(), "diffgazer-trust-project-"));
    mkdirSync(join(projectRoot, ".git"));
    process.env.DIFFGAZER_HOME = diffgazerHome;
    process.env.DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT = "1";
    // Suppress fire-and-forget persistence warnings emitted after teardown removes the temp dir.
    // The config store dispatches persist*Async without awaiting, so a pending write can land
    // after rmSync; production keeps this UX-friendly fire-and-forget pattern unchanged.
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.DIFFGAZER_HOME;
    delete process.env.DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT;
    rmSync(diffgazerHome, { recursive: true, force: true });
    rmSync(projectRoot, { recursive: true, force: true });
    warnSpy.mockRestore();
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

  it("blocks requests when trust repoRoot does not match the resolved project root", async () => {
    const store = (await import("../lib/config/store.js")).getStore();
    const project = store.ensureProjectFile(projectRoot);
    await store.saveTrust({
      projectId: project.projectId!,
      repoRoot: "/some/other/path",
      trustedAt: "2024-01-01T00:00:00.000Z",
      capabilities: { readFiles: true, runCommands: false },
      trustMode: "persistent",
    });
    const app = await createApp();

    const response = await request(app);
    const body = await response.json() as { error: { code: string } };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("TRUST_REQUIRED");
  });
});
