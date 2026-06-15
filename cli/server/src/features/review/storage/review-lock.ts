const reviewLocks = new Map<string, Promise<unknown>>();

export function withReviewLock<T>(reviewId: string, fn: () => Promise<T>): Promise<T> {
  const prev = reviewLocks.get(reviewId) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  reviewLocks.set(reviewId, next);
  next.then(
    () => {
      if (reviewLocks.get(reviewId) === next) reviewLocks.delete(reviewId);
    },
    () => {
      if (reviewLocks.get(reviewId) === next) reviewLocks.delete(reviewId);
    },
  );
  return next;
}
