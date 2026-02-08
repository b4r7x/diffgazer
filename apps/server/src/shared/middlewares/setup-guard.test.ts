import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

const mockGetProjectRoot = vi.fn().mockReturnValue("/test/project");
const mockGetSetupStatus = vi.fn();

vi.mock("../lib/http/request.js", () => ({
  getProjectRoot: mockGetProjectRoot,
}));

vi.mock("../../features/config/service.js", () => ({
  getSetupStatus: mockGetSetupStatus,
}));

const { requireSetup } = await import("./setup-guard.js");

describe("requireSetup", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    app.use("/*", requireSetup);
    app.get("/test", (c) => c.json({ ok: true }));
  });

  it("should block when setup is not ready", async () => {
    mockGetSetupStatus.mockReturnValue({
      isReady: false,
      missing: ["provider"],
    });

    const res = await app.request("/test");

    expect(res.status).toBe(503);
    const body = await res.json() as any;
    expect(body.error.code).toBe("SETUP_REQUIRED");
  });

  it("should include missing items in error message", async () => {
    mockGetSetupStatus.mockReturnValue({
      isReady: false,
      missing: ["provider", "model", "trust"],
    });

    const res = await app.request("/test");

    const body = await res.json() as any;
    expect(body.error.message).toContain("provider");
    expect(body.error.message).toContain("model");
    expect(body.error.message).toContain("trust");
  });

  it("should pass when setup is ready", async () => {
    mockGetSetupStatus.mockReturnValue({
      isReady: true,
      missing: [],
    });

    const res = await app.request("/test");

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
  });
});
