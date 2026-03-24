import { useState, useRef } from "react";

interface Step {
  name: string;
  status: string;
  substeps?: string[];
  duration?: number;
}

interface LogEntry {
  timestamp: string;
  message: string;
  variant?: "success" | "warning" | "error" | "info" | "neutral";
}

export interface ReviewStreamState {
  phase: "idle" | "connecting" | "streaming" | "complete" | "error";
  steps: Step[];
  logEntries: LogEntry[];
  error?: string;
}

const INITIAL_STATE: ReviewStreamState = {
  phase: "idle",
  steps: [],
  logEntries: [],
};

const MOCK_STEPS: Step[] = [
  { name: "Analyzing diff", status: "complete", duration: 1200 },
  { name: "Running security analysis", status: "complete", substeps: ["Checking dependencies", "Scanning patterns"], duration: 3400 },
  { name: "Running correctness analysis", status: "complete", substeps: ["Type checking", "Logic validation"], duration: 2800 },
  { name: "Generating report", status: "complete", duration: 800 },
];

const MOCK_LOG_ENTRIES: LogEntry[] = [
  { timestamp: "00:00.0", message: "Review started", variant: "info" },
  { timestamp: "00:01.2", message: "Diff parsed: 12 files, 340 lines changed", variant: "info" },
  { timestamp: "00:04.6", message: "Security scan complete: 1 finding", variant: "warning" },
  { timestamp: "00:07.4", message: "Correctness analysis complete: 3 findings" },
  { timestamp: "00:08.2", message: "Report generated", variant: "success" },
];

export function useReviewStream(): {
  state: ReviewStreamState;
  start: (mode: string) => void;
  cancel: () => void;
} {
  const [state, setState] = useState<ReviewStreamState>(INITIAL_STATE);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function start(_mode: string) {
    setState({ ...INITIAL_STATE, phase: "connecting" });

    // Stub: simulate SSE streaming with timeouts
    timerRef.current = setTimeout(() => {
      setState({
        phase: "streaming",
        steps: MOCK_STEPS.map((s, i) => ({
          ...s,
          status: i === 0 ? "running" : "pending",
        })),
        logEntries: [MOCK_LOG_ENTRIES[0]!],
      });

      timerRef.current = setTimeout(() => {
        setState({
          phase: "complete",
          steps: MOCK_STEPS,
          logEntries: MOCK_LOG_ENTRIES,
        });
      }, 2000);
    }, 500);
  }

  function cancel() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setState({ ...INITIAL_STATE, phase: "idle" });
  }

  return { state, start, cancel };
}
