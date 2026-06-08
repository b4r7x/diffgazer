import type { ReviewIssue } from "@diffgazer/core/schemas/review";

export interface SavedReviewData {
  issues: ReviewIssue[];
  reviewId: string;
  durationMs: number | undefined;
}

export type ReviewScreenPhase =
  | { kind: "streaming" }
  | { kind: "loading-saved" }
  | { kind: "saved"; saved: SavedReviewData };

export interface SelectReviewScreenPhaseInput {
  reviewId: string | undefined;
  savedIsLoading: boolean;
  savedData:
    | {
        review: {
          metadata: { id: string; durationMs?: number | null };
          result: { issues: ReviewIssue[] };
        };
      }
    | undefined;
}

export function selectReviewScreenPhase(input: SelectReviewScreenPhaseInput): ReviewScreenPhase {
  if (!input.reviewId) return { kind: "streaming" };
  if (input.savedIsLoading) return { kind: "loading-saved" };
  if (input.savedData) {
    const { review } = input.savedData;
    return {
      kind: "saved",
      saved: {
        issues: review.result.issues,
        reviewId: review.metadata.id,
        durationMs: review.metadata.durationMs ?? undefined,
      },
    };
  }
  return { kind: "streaming" };
}
