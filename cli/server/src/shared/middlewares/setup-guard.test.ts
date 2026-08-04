import { READINESS_PRESENTATION, type ReadinessStatus } from "@diffgazer/core/schemas/config";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SetupVerdict } from "../lib/config/setup-status.js";

const { getSetupVerdict } = vi.hoisted(() => ({ getSetupVerdict: vi.fn() }));

vi.mock("../lib/config/setup-status.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/config/setup-status.js")>();
  return { ...actual, getSetupVerdict };
});

async function createApp(): Promise<Hono> {
  const { requireSetup } = await import("./setup-guard.js");
  const app = new Hono();
  app.use("/*", requireSetup);
  app.get("/test", (ctx) => ctx.json({ ok: true }));
  return app;
}

function verdictFor(
  status: ReadinessStatus,
  configurationId: string | null = "cfg-existing",
): SetupVerdict {
  const presentation = READINESS_PRESENTATION[status];
  return {
    configurationId,
    status,
    ready: status === "ready",
    action: presentation.action,
    explanation: presentation.explanation,
    remediation: { ...presentation.remediation },
  };
}

async function request(app: Hono): Promise<{ status: number; body: unknown }> {
  const response = await app.request("/test");
  return { status: response.status, body: await response.json() };
}

function expectBlocked(result: { status: number; body: unknown }, status: ReadinessStatus): void {
  expect(result.status).toBe(503);
  expect(result.body).toEqual({
    error: {
      code: "SETUP_REQUIRED",
      message: `Setup incomplete (${status}): ${READINESS_PRESENTATION[status].remediation.message}`,
    },
  });
}

describe("requireSetup", () => {
  beforeEach(() => {
    getSetupVerdict.mockReset();
  });

  it("passes requests when the selected configuration verdict is ready", async () => {
    getSetupVerdict.mockResolvedValue({ ok: true, value: verdictFor("ready") });
    const app = await createApp();

    const result = await request(app);

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true });
  });

  it("blocks with SETUP_REQUIRED when no configuration is selected (configure remediation)", async () => {
    getSetupVerdict.mockResolvedValue({ ok: true, value: verdictFor("unconfigured", null) });
    const app = await createApp();

    expectBlocked(await request(app), "unconfigured");
  });

  it("blocks with SETUP_REQUIRED while conformance evidence is pending (run-conformance remediation)", async () => {
    getSetupVerdict.mockResolvedValue({ ok: true, value: verdictFor("conformance-pending") });
    const app = await createApp();

    expectBlocked(await request(app), "conformance-pending");
  });

  it("blocks with SETUP_REQUIRED when the live readiness check was skipped (enable-live-probe remediation)", async () => {
    getSetupVerdict.mockResolvedValue({ ok: true, value: verdictFor("skipped") });
    const app = await createApp();

    expectBlocked(await request(app), "skipped");
  });

  it("blocks with SETUP_REQUIRED when the local server is unreachable (start-local-server remediation)", async () => {
    getSetupVerdict.mockResolvedValue({
      ok: true,
      value: verdictFor("local-endpoint-unreachable"),
    });
    const app = await createApp();

    expectBlocked(await request(app), "local-endpoint-unreachable");
  });

  it("blocks with SETUP_REQUIRED when the hosted service is unreachable (retry-connection remediation)", async () => {
    getSetupVerdict.mockResolvedValue({ ok: true, value: verdictFor("unreachable") });
    const app = await createApp();

    expectBlocked(await request(app), "unreachable");
  });

  it("blocks with SETUP_REQUIRED when the configuration is unsupported (review-support remediation)", async () => {
    getSetupVerdict.mockResolvedValue({ ok: true, value: verdictFor("unsupported") });
    const app = await createApp();

    expectBlocked(await request(app), "unsupported");
  });

  it("fails closed with a storage error when the verdict cannot be read", async () => {
    getSetupVerdict.mockResolvedValue({
      ok: false,
      error: { code: "PERSIST_FAILED", message: "Failed to read configuration" },
    });
    const app = await createApp();

    const result = await request(app);

    expect(result.status).toBe(500);
    expect(result.body).toEqual({
      error: {
        code: "PERSIST_FAILED",
        message:
          "Could not verify setup status. Failed to read configuration. Check secrets storage access and retry.",
      },
    });
  });

  it("exposes no configuration identity or secret detail in blocked responses", async () => {
    getSetupVerdict.mockResolvedValue({ ok: true, value: verdictFor("unsupported") });
    const app = await createApp();

    const response = await app.request("/test");
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(text).not.toContain("cfg-existing");
    expect(text).not.toContain("sk-test");
    expect(text).not.toContain("credentials");
  });
});
