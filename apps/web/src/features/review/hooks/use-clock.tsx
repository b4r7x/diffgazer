import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

/**
 * One wall clock per review screen. The metrics timer, the pinned tail row and
 * the liveness notice all print seconds off this single tick, so two readings of
 * the same moment can never disagree by a second on screen.
 *
 * The tick is a provider rather than a hook at the screen root on purpose: only
 * the components that read the clock re-render once a second, not the agent
 * board, the progress list and every log row.
 */
const ReviewClockContext = createContext<number | null>(null);

export function ReviewClockProvider({
  running,
  children,
}: {
  running: boolean;
  children: ReactNode;
}) {
  const [now, setNow] = useState(() => Date.now());

  // Stopping the tick is how a finished run keeps its final elapsed time on
  // screen instead of counting on past its own end.
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(interval);
  }, [running]);

  return <ReviewClockContext value={now}>{children}</ReviewClockContext>;
}

/** Epoch ms of the current review tick. */
export function useReviewClock(): number {
  const now = useContext(ReviewClockContext);
  if (now === null) {
    throw new Error("useReviewClock must be used within a ReviewClockProvider");
  }
  return now;
}
