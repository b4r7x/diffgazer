import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import { reviews } from "./reviews.js";
import * as activeSessionsModule from "../../storage/active-sessions.js";
import * as storageModule from "../../storage/index.js";
import { ok, err, createError } from "@repo/core";
import type { SavedTriageReview } from "@repo/schemas";

vi.mock("../../storage/active-sessions.js");
vi.mock("../../storage/index.js", async () => {
  const actual = await vi.importActual("../../storage/index.js");
  return {
    ...actual,
    getTriageReview: vi.fn(),
  };
});

describe("GET /:id/status", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route("/reviews", reviews);
    vi.clearAllMocks();
  });

  it("returns sessionActive=true when active session exists", async () => {
    const reviewId = "550e8400-e29b-41d4-a716-446655440000";
    const startedAt = new Date("2024-01-15T10:30:00Z");

    vi.mocked(activeSessionsModule.getSession).mockReturnValue({
      reviewId,
      projectPath: "/test/project",
      headCommit: "abc123",
      statusHash: "M  test.ts",
      mode: "staged",
      startedAt,
      events: [],
      isComplete: false,
      isReady: true,
      subscribers: new Set(),
    });

    vi.mocked(storageModule.getTriageReview).mockResolvedValue(
      err(createError("NOT_FOUND", "Review not found"))
    );

    const res = await app.request(`/reviews/${reviewId}/status`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json).toEqual({
      sessionActive: true,
      reviewSaved: false,
      isComplete: false,
      startedAt: "2024-01-15T10:30:00.000Z",
    });
  });

  it("returns reviewSaved=true when saved review exists but no session", async () => {
    const reviewId = "550e8400-e29b-41d4-a716-446655440001";
    const createdAt = "2024-01-14T15:45:00Z";

    vi.mocked(activeSessionsModule.getSession).mockReturnValue(undefined);

    const mockReview: SavedTriageReview = {
      metadata: {
        id: reviewId,
        projectPath: "/test/project",
        createdAt,
        mode: "unstaged",
        branch: "main",
        profile: null,
        lenses: [],
        issueCount: 0,
        blockerCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        nitCount: 0,
        fileCount: 1,
      },
      result: {
        issues: [],
        summary: "Test review",
      },
      gitContext: {
        branch: "main",
        commit: "abc123",
        fileCount: 1,
        additions: 10,
        deletions: 5,
      },
      drilldowns: [],
    };

    vi.mocked(storageModule.getTriageReview).mockResolvedValue(ok(mockReview));

    const res = await app.request(`/reviews/${reviewId}/status`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json).toEqual({
      sessionActive: false,
      reviewSaved: true,
      isComplete: true,
      startedAt: createdAt,
    });
  });

  it("returns all false when neither session nor review exists", async () => {
    const reviewId = "550e8400-e29b-41d4-a716-446655440002";

    vi.mocked(activeSessionsModule.getSession).mockReturnValue(undefined);

    vi.mocked(storageModule.getTriageReview).mockResolvedValue(
      err(createError("NOT_FOUND", "Review not found"))
    );

    const res = await app.request(`/reviews/${reviewId}/status`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json).toEqual({
      sessionActive: false,
      reviewSaved: false,
      isComplete: false,
    });
  });

  it("returns 400 for invalid UUID format", async () => {
    const res = await app.request("/reviews/not-a-uuid/status");
    expect(res.status).toBe(400);
    // HTTPException from Hono returns plain text when no error handler is registered
    const text = await res.text();
    expect(text).toContain("Invalid");
  });

  it("returns correct startedAt timestamp from session", async () => {
    const reviewId = "550e8400-e29b-41d4-a716-446655440003";
    const startedAt = new Date("2024-01-20T14:22:33Z");

    vi.mocked(activeSessionsModule.getSession).mockReturnValue({
      reviewId,
      projectPath: "/test/project",
      headCommit: "abc123",
      statusHash: "M  test.ts",
      mode: "staged",
      startedAt,
      events: [],
      isComplete: true,
      isReady: true,
      subscribers: new Set(),
    });

    vi.mocked(storageModule.getTriageReview).mockResolvedValue(
      err(createError("NOT_FOUND", "Review not found"))
    );

    const res = await app.request(`/reviews/${reviewId}/status`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.startedAt).toBe("2024-01-20T14:22:33.000Z");
  });

  it("returns correct startedAt from saved review metadata", async () => {
    const reviewId = "550e8400-e29b-41d4-a716-446655440004";
    const createdAt = "2024-01-18T09:15:22Z";

    vi.mocked(activeSessionsModule.getSession).mockReturnValue(undefined);

    const mockReview: SavedTriageReview = {
      metadata: {
        id: reviewId,
        projectPath: "/test/project",
        createdAt,
        mode: "staged",
        branch: "feature/test",
        profile: null,
        lenses: ["correctness"],
        issueCount: 1,
        blockerCount: 0,
        highCount: 1,
        mediumCount: 0,
        lowCount: 0,
        nitCount: 0,
        fileCount: 1,
      },
      result: {
        issues: [],
        summary: "Test review",
      },
      gitContext: {
        branch: "feature/test",
        commit: "def456",
        fileCount: 1,
        additions: 20,
        deletions: 10,
      },
      drilldowns: [],
    };

    vi.mocked(storageModule.getTriageReview).mockResolvedValue(ok(mockReview));

    const res = await app.request(`/reviews/${reviewId}/status`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.startedAt).toBe(createdAt);
  });

  it("prioritizes session over saved review when both exist", async () => {
    const reviewId = "550e8400-e29b-41d4-a716-446655440005";
    const sessionStartedAt = new Date("2024-01-21T11:00:00Z");
    const reviewCreatedAt = "2024-01-20T10:00:00Z";

    vi.mocked(activeSessionsModule.getSession).mockReturnValue({
      reviewId,
      projectPath: "/test/project",
      headCommit: "abc123",
      statusHash: "M  test.ts",
      mode: "staged",
      startedAt: sessionStartedAt,
      events: [],
      isComplete: false,
      isReady: true,
      subscribers: new Set(),
    });

    const mockReview: SavedTriageReview = {
      metadata: {
        id: reviewId,
        projectPath: "/test/project",
        createdAt: reviewCreatedAt,
        mode: "unstaged",
        branch: "main",
        profile: null,
        lenses: [],
        issueCount: 0,
        blockerCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        nitCount: 0,
        fileCount: 1,
      },
      result: {
        issues: [],
        summary: "Test review",
      },
      gitContext: {
        branch: "main",
        commit: "ghi789",
        fileCount: 1,
        additions: 5,
        deletions: 2,
      },
      drilldowns: [],
    };

    vi.mocked(storageModule.getTriageReview).mockResolvedValue(ok(mockReview));

    const res = await app.request(`/reviews/${reviewId}/status`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.sessionActive).toBe(true);
    expect(json.reviewSaved).toBe(true);
    expect(json.startedAt).toBe(sessionStartedAt.toISOString());
  });
});
