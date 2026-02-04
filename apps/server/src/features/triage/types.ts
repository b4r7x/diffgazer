import type { DrilldownResult, SavedTriageReview, TriageReviewMetadata } from "@repo/schemas";

export interface TriageReviewsResponse {
  reviews: TriageReviewMetadata[];
  warnings?: string[];
}

export interface TriageReviewResponse {
  review: SavedTriageReview;
}

export interface DrilldownResponse {
  drilldown: DrilldownResult;
}
