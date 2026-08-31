import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createReviewApp,
  REVIEW_A,
  REVIEW_B,
  REVIEW_C,
  REVIEW_D,
  requestOptions,
  saveReview,
  setupReviewRouterHarness,
  trustProject,
} from "../testing/router-harness.js";

const harness = setupReviewRouterHarness();

describe("GET /api/review/reviews pagination", () => {
  it("continues without duplicates after a newer insert and deletion of the cursor review", async () => {
    await trustProject(harness.projectA);
    await saveReview(REVIEW_A, harness.projectA);
    await saveReview(REVIEW_B, harness.projectA);
    await saveReview(REVIEW_C, harness.projectA);
    const app = await createReviewApp();

    const firstResponse = await app.request(
      "/api/review/reviews?limit=2",
      requestOptions(harness.projectA),
    );
    const first = (await firstResponse.json()) as {
      reviews: Array<{ id: string }>;
      nextCursor: string | null;
    };

    expect(firstResponse.status).toBe(200);
    expect(first.reviews.map((review) => review.id)).toEqual([REVIEW_C, REVIEW_B]);
    expect(first.nextCursor).toMatch(/^dg1_[A-Za-z0-9_-]+$/);
    expect(first.nextCursor).not.toBe(REVIEW_B);

    await saveReview(REVIEW_D, harness.projectA);
    await unlink(join(harness.tempHome, "triage-reviews", `${REVIEW_B}.json`));
    const secondResponse = await app.request(
      `/api/review/reviews?limit=2&cursor=${first.nextCursor}`,
      requestOptions(harness.projectA),
    );
    const second = (await secondResponse.json()) as {
      reviews: Array<{ id: string }>;
      nextCursor: string | null;
    };

    expect(secondResponse.status).toBe(200);
    expect(second.reviews.map((review) => review.id)).toEqual([REVIEW_A]);
    expect(second.nextCursor).toBeNull();
    // Concatenated, not set-compared: a Set would hide the duplicate this test is named for.
    expect([...first.reviews, ...second.reviews].map((review) => review.id)).toEqual([
      REVIEW_C,
      REVIEW_B,
      REVIEW_A,
    ]);

    const refreshedResponse = await app.request(
      "/api/review/reviews?limit=2",
      requestOptions(harness.projectA),
    );
    const refreshed = (await refreshedResponse.json()) as { reviews: Array<{ id: string }> };
    expect(refreshed.reviews.map((review) => review.id)).toEqual([REVIEW_D, REVIEW_C]);
  });

  it("rejects malformed cursors and out-of-range limits", async () => {
    await trustProject(harness.projectA);
    const app = await createReviewApp();

    const [legacyCursorResponse, malformedCursorResponse, semanticCursorResponse, limitResponse] =
      await Promise.all([
        app.request(`/api/review/reviews?cursor=${REVIEW_A}`, requestOptions(harness.projectA)),
        app.request("/api/review/reviews?cursor=not-a-uuid", requestOptions(harness.projectA)),
        app.request("/api/review/reviews?cursor=dg1_bm90LWpzb24", requestOptions(harness.projectA)),
        app.request("/api/review/reviews?limit=101", requestOptions(harness.projectA)),
      ]);

    expect(legacyCursorResponse.status).toBe(400);
    expect(malformedCursorResponse.status).toBe(400);
    expect(semanticCursorResponse.status).toBe(400);
    expect(limitResponse.status).toBe(400);
  });
});
