/**
 * A malformed review id reaches the user two ways — the route guard redirects
 * home with `?error=invalid-review-id`, and the API answers a load with 400 —
 * so the copy has one owner instead of one per transport.
 */
export const INVALID_REVIEW_ID_COPY = {
  title: "Invalid Review ID",
  message: "The review ID format is invalid.",
} as const;
