import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PROJECT_ROOT_HEADER } from "@diffgazer/core/api/protocol";
import { requireValue } from "@diffgazer/core/testing/assertions";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertTempHome } from "../lib/testing/temp-home.js";
import { DEFAULT_BODY_LIMIT_KB } from "./body-limit.js";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";

let diffgazerHome: string;
let projectRoot: string;

// The routers call `getStore()` while serving, so the store singleton is reached through
// the module rather than a handle any single test holds.
async function drainConfigStore(): Promise<void> {
  const { getStore } = await import("../lib/config/store.js");
  await getStore().ready();
}

async function createReviewApp(): Promise<Hono> {
  const { configRouter } = await import("../../features/config/router.js");
  const { reviewRouter } = await import("../../features/review/router.js");
  return new Hono().route("/api/review", reviewRouter).route("/api/config", configRouter);
}

function jsonRequestWithBytes(byteLength: number): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "unstaged", payload: "x".repeat(byteLength) }),
  };
}

async function grantProjectTrust(): Promise<void> {
  const { getStore } = await import("../lib/config/store.js");
  const store = getStore();
  const project = store.ensureProjectFile(projectRoot);
  const projectId = requireValue(project.projectId, "project id");
  await store.saveTrust({
    projectId,
    repoRoot: projectRoot,
    trustedAt: "2024-01-01T00:00:00.000Z",
    capabilities: { readFiles: true, runCommands: false },
    trustMode: "persistent",
  });
}

describe("body limit route wiring", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    diffgazerHome = mkdtempSync(join(tmpdir(), "dg-body-limit-"));
    assertTempHome(diffgazerHome);
    projectRoot = realpathSync.native(mkdtempSync(join(tmpdir(), "dg-body-limit-project-")));
    mkdirSync(join(projectRoot, ".git"));
    process.env.DIFFGAZER_HOME = diffgazerHome;
    process.env.DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT = "1";
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

  it("uses the review-specific cap without changing the default JSON route cap", async () => {
    const app = await createReviewApp();
    await grantProjectTrust();

    const reviewAboveDefault = await app.request(
      "/api/review/reviews",
      jsonRequestWithBytes(DEFAULT_BODY_LIMIT_KB * 1024),
    );
    expect(reviewAboveDefault.status).not.toBe(413);

    const oversizedConfig = await app.request("/api/config/actions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [PROJECT_ROOT_HEADER]: projectRoot,
      },
      body: JSON.stringify({
        action: "create",
        input: {
          transportFamily: "hosted-api",
          productId: "gemini",
          endpoint: GEMINI_ENDPOINT,
          credential: { kind: "literal", value: "x".repeat(DEFAULT_BODY_LIMIT_KB * 1024) },
        },
      }),
    });
    const oversizedBody = (await oversizedConfig.json()) as { error: { code: string } };

    expect(oversizedConfig.status).toBe(413);
    expect(oversizedBody.error.code).toBe("PAYLOAD_TOO_LARGE");
  });
});
