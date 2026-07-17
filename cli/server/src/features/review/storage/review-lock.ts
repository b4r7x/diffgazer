import { createKeyedLock } from "./keyed-lock.js";

const reviewLocks = new Map<string, Promise<unknown>>();
const lockReview = createKeyedLock(reviewLocks);

export function withReviewLock<T>(reviewId: string, fn: () => Promise<T>): Promise<T> {
  return lockReview(reviewId, fn);
}
