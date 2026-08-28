import { PROJECT_ROOT_HEADER } from "@diffgazer/core/api/protocol";
import { describe, expect, it, vi } from "vitest";
import {
  configureSetup,
  createReviewApp,
  installProviderWorkProbe,
  REVIEW_A,
  REVIEW_B,
  ROUTE_BOUNDARY_TIMEOUT_MS,
  requestOptions,
  saveReview,
  setupReviewRouterHarness,
  trustProject,
  writeBlockedV1ReviewState,
} from "./testing/router-harness.js";

const harness = setupReviewRouterHarness();

describe("review router project boundaries", () => {
  it(
    "lists reviews when the query project matches the trusted request project",
    async () => {
      await trustProject(harness.projectA);
      await saveReview(REVIEW_A, harness.projectA);
      await saveReview(REVIEW_B, harness.projectB);
      const app = await createReviewApp();

      const response = await app.request(
        `/api/review/reviews?projectPath=${encodeURIComponent(harness.projectA)}`,
        requestOptions(harness.projectA),
      );
      const body = (await response.json()) as { reviews: Array<{ id: string }> };

      expect(response.status).toBe(200);
      expect(body.reviews.map((review) => review.id)).toEqual([REVIEW_A]);
    },
    ROUTE_BOUNDARY_TIMEOUT_MS,
  );

  it("rejects a review list query for a different project", async () => {
    await trustProject(harness.projectA);
    await saveReview(REVIEW_A, harness.projectA);
    await saveReview(REVIEW_B, harness.projectB);
    const app = await createReviewApp();

    const response = await app.request(
      `/api/review/reviews?projectPath=${encodeURIComponent(harness.projectB)}`,
      requestOptions(harness.projectA),
    );

    expect(response.status).toBe(400);
  });

  it("does not read reviews from another project", async () => {
    await trustProject(harness.projectA);
    await saveReview(REVIEW_B, harness.projectB);
    const app = await createReviewApp();

    const readResponse = await app.request(
      `/api/review/reviews/${REVIEW_B}`,
      requestOptions(harness.projectA),
    );
    expect(readResponse.status).toBe(404);

    const { getReviewDetail } = await import("./storage/reviews.js");
    const stored = await getReviewDetail(REVIEW_B);
    expect(stored.ok).toBe(true);
  });

  it("omits the persisted diff from review detail responses", async () => {
    await trustProject(harness.projectA);
    await saveReview(REVIEW_A, harness.projectA);
    const app = await createReviewApp();

    const response = await app.request(
      `/api/review/reviews/${REVIEW_A}`,
      requestOptions(harness.projectA),
    );
    const body = (await response.json()) as { review: Record<string, unknown> };

    expect(response.status).toBe(200);
    expect(body.review).not.toHaveProperty("diff");

    const { getReviewDetail } = await import("./storage/reviews.js");
    const stored = await getReviewDetail(REVIEW_A);
    expect(stored.ok).toBe(true);
    if (stored.ok) expect(stored.value.review.diff).toBeDefined();
  });

  it.each([
    ["DELETE", `/api/review/reviews/${REVIEW_A}`],
    ["POST", `/api/review/reviews/${REVIEW_A}/drilldown`],
  ])("does not mount the retired %s %s endpoint", async (method, path) => {
    const app = await createReviewApp();

    const response = await app.request(path, {
      ...requestOptions(harness.projectA),
      method,
      headers: {
        ...requestOptions(harness.projectA).headers,
        "content-type": "application/json",
      },
      body: method === "POST" ? JSON.stringify({ issueId: "issue-1" }) : undefined,
    });

    expect(response.status).toBe(404);
  });
});

describe("blocked V1 review routes", () => {
  it.each([
    "valid",
    "corrupt",
  ] as const)("returns the fixed migration envelope before context or review work with %s recovery", async (recovery) => {
    const authorizeReviewExecution = installProviderWorkProbe();
    const createReviewSession = vi.fn();
    vi.doMock("./service.js", () => ({ createReviewSession }));
    await configureSetup(harness.projectA);
    await writeBlockedV1ReviewState(recovery);
    const app = await createReviewApp();

    const responses = await Promise.all([
      app.request("/api/review/context", requestOptions(harness.projectA)),
      app.request("/api/review/reviews", {
        method: "POST",
        headers: {
          [PROJECT_ROOT_HEADER]: harness.projectA,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mode: "unstaged" }),
      }),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "SECRETS_MIGRATION_FAILED",
          message: "Legacy configuration requires manual migration",
        },
      });
    }
    expect(authorizeReviewExecution).not.toHaveBeenCalled();
    expect(createReviewSession).not.toHaveBeenCalled();
  });
});

describe("review router param validation", () => {
  it("rejects a non-UUID review id on GET", async () => {
    await trustProject(harness.projectA);
    const app = await createReviewApp();

    const response = await app.request(
      "/api/review/reviews/not-a-uuid",
      requestOptions(harness.projectA),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
