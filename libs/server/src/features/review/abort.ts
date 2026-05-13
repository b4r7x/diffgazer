import type { ReviewAbort } from "./types.js";

export function reviewAbort(
  message: string,
  code: string,
  step?: ReviewAbort["step"],
): ReviewAbort {
  return { kind: "review_abort", message, code, step };
}

export function isReviewAbort(error: unknown): error is ReviewAbort {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as Partial<ReviewAbort>;
  return (
    candidate.kind === "review_abort" &&
    typeof candidate.message === "string" &&
    typeof candidate.code === "string"
  );
}
