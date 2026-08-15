import { describe, expect, expectTypeOf, it } from "vitest";
import {
  ActiveReviewSessionSchema,
  CreateReviewResponseSchema,
  ReviewIssueSchema,
  type ReviewMetadata,
  ReviewMetadataSchema,
} from "../schemas/review/index.js";
import {
  makeActiveReviewSession,
  makeCreateReviewResponse,
  makeIssue,
  makeReviewMetadata,
} from "./factories.js";

describe("default factory output", () => {
  it("produces review metadata the history response schema admits", () => {
    expect(ReviewMetadataSchema.safeParse(makeReviewMetadata()).success).toBe(true);
    expectTypeOf(makeReviewMetadata()).toEqualTypeOf<ReviewMetadata>();
  });

  it("ignores an explicit undefined override instead of returning invalid metadata", () => {
    const metadata = makeReviewMetadata({
      // @ts-expect-error -- required metadata fields cannot be overridden with undefined.
      branch: undefined,
    });

    expect(metadata.branch).toBe("main");
    expect(ReviewMetadataSchema.safeParse(metadata).success).toBe(true);
  });

  it("produces an issue, session, and create response their schemas admit", () => {
    expect(ReviewIssueSchema.safeParse(makeIssue()).success).toBe(true);
    expect(ActiveReviewSessionSchema.safeParse(makeActiveReviewSession()).success).toBe(true);
    expect(CreateReviewResponseSchema.safeParse(makeCreateReviewResponse()).success).toBe(true);
  });
});
