import { useEffect, useRef, useState } from "react";

const COPY_FEEDBACK_MS = 2000;

type CopyFeedbackState = "idle" | "copied" | "failed";

type TimerRef = {
  current: ReturnType<typeof setTimeout> | null;
};

function clearFeedbackTimer(timerRef: TimerRef) {
  if (timerRef.current === null) return;
  clearTimeout(timerRef.current);
  timerRef.current = null;
}

export function useCopyFeedback() {
  const [feedback, setFeedback] = useState<CopyFeedbackState>("idle");
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => clearFeedbackTimer(copyTimerRef);
  }, []);

  const scheduleReset = () => {
    clearFeedbackTimer(copyTimerRef);
    copyTimerRef.current = setTimeout(() => {
      setFeedback("idle");
      copyTimerRef.current = null;
    }, COPY_FEEDBACK_MS);
  };

  const showCopied = () => {
    setFeedback("copied");
    scheduleReset();
  };

  const showFailed = () => {
    setFeedback("failed");
    scheduleReset();
  };

  return {
    copied: feedback === "copied",
    failed: feedback === "failed",
    showCopied,
    showFailed,
  };
}
