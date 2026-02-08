import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

const mockGetProjectRoot = vi.fn().mockReturnValue("/test/project");
const mockGetProjectInfo = vi.fn();

vi.mock("../lib/http/request.js", () => ({
  getProjectRoot: mockGetProjectRoot,
}));

vi.mock("../lib/config/store.js", () => ({
  getProjectInfo: mockGetProjectInfo,
}));

const { requireRepoAccess } = await import("./trust-guard.js");

describe("requireRepoAccess", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    app.use("/*", requireRepoAccess);
    app.get("/test", (c) => c.json({ ok: true }));
  });

  it("should block when trust is missing", async () => {
    mockGetProjectInfo.mockReturnValue({ trust: null });

    const res = await app.request("/test");

    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.error.code).toBe("TRUST_REQUIRED");
  });

  it("should block when readFiles is false", async () => {
    mockGetProjectInfo.mockReturnValue({
      trust: { capabilities: { readFiles: false } },
    });

    const res = await app.request("/test");

    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.error.code).toBe("TRUST_REQUIRED");
  });

  it("should pass when readFiles is true", async () => {
    mockGetProjectInfo.mockReturnValue({
      trust: { capabilities: { readFiles: true } },
    });

    const res = await app.request("/test");

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
  });
});
