import { createContext, type RefObject, useContext } from "react";

/**
 * While a review run is streaming, q cancels the run instead of quitting the
 * app — the TUI grammar. The progress screen parks its cancel here and the
 * shell's quit shortcut consults it before shutting the server down. The
 * default empty ref keeps the hand-off a no-op wherever the shell is absent.
 */
const StreamingReviewContext = createContext<RefObject<(() => void) | null>>({ current: null });

export const StreamingReviewProvider = StreamingReviewContext.Provider;

export function useStreamingReviewCancelRef(): RefObject<(() => void) | null> {
  return useContext(StreamingReviewContext);
}
