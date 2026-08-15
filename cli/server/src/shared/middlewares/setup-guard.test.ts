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

  it.each([
    "conformance-pending",
    "skipped",
    "conformance-failed",
    "local-conformance-failed",
  ] as const)("passes %s through so admission can attempt or fast-fail the review", async (status) => {
    getSetupVerdict.mockResolvedValue({ ok: true, value: verdictFor(status) });
    const app = await createApp();

    const result = await request(app);

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true });
  });

  it("blocks with SETUP_REQUIRED when the configuration is unsupported (review-support remediation)", async () => {
    getSetupVerdict.mockResolvedValue({ ok: true, value: verdictFor("unsupported") });
    const app = await createApp();

    expectBlocked(await request(app), "unsupported");
  });

  it.each([
    "credential-invalid",
    "model-missing",
    "acknowledgement-required",
  ] as const)("still blocks %s, which no review can resolve for itself", async (status) => {
    getSetupVerdict.mockResolvedValue({ ok: true, value: verdictFor(status) });
    const app = await createApp();

    expectBlocked(await request(app), status);
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

  it("returns a fixed manual-migration response when V1 startup is blocked", async () => {
    getSetupVerdict.mockResolvedValue({
      ok: false,
      error: {
        code: "SECRETS_MIGRATION_FAILED",
        message: "attacker-controlled migration detail /private/credential/path",
      },
    });
    const app = await createApp();

    const result = await request(app);

    expect(result).toEqual({
      status: 503,
      body: {
        error: {
          code: "SECRETS_MIGRATION_FAILED",
          message: "Legacy configuration requires manual migration",
        },
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
