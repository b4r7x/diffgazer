import { useState } from "react";
import { useReviewStream } from "./use-review-stream.js";

export type ReviewPhase = "idle" | "streaming" | "summary" | "results";

interface Issue {
  id: string;
  severity: string;
  filePath: string;
  title: string;
  description: string;
  code?: string;
  startLine?: number;
  fixPlan?: string;
  category?: string;
}

interface Summary {
  total: number;
  bySeverity: Record<string, number>;
  duration: number;
}

export interface ReviewLifecycleState {
  phase: ReviewPhase;
  reviewId?: string;
  issues: Issue[];
  summary?: Summary;
  steps: Array<{ name: string; status: string; substeps?: string[]; duration?: number }>;
  logEntries: Array<{ timestamp: string; message: string; variant?: "success" | "warning" | "error" | "info" | "neutral" }>;
}

const MOCK_ISSUES: Issue[] = [
  {
    id: "issue-1",
    severity: "high",
    filePath: "src/auth/session.ts",
    title: "Missing token expiry check",
    description: "The session validation function does not check whether the JWT has expired before granting access. An attacker with a stolen expired token could still authenticate.",
    code: "function validateSession(token: string) {\n  const decoded = jwt.decode(token);\n  return decoded !== null;\n}",
    startLine: 42,
    fixPlan: "Add an expiry check after decoding: verify `decoded.exp` is greater than `Date.now() / 1000`. Return false if expired.",
    category: "security",
  },
  {
    id: "issue-2",
    severity: "medium",
    filePath: "src/api/handlers.ts",
    title: "Unhandled promise rejection in error path",
    description: "The catch block in the request handler swallows the error without logging or re-throwing, making failures silent and hard to debug.",
    code: "try {\n  await processRequest(req);\n} catch (e) {\n  res.status(500).json({ error: 'Internal error' });\n}",
    startLine: 78,
    fixPlan: "Log the error before sending the response. Consider using a structured logger and including a correlation ID.",
    category: "correctness",
  },
  {
    id: "issue-3",
    severity: "low",
    filePath: "src/utils/format.ts",
    title: "Unused import",
    description: "The `lodash` import is no longer referenced after the recent refactor to native array methods.",
    category: "cleanup",
  },
  {
    id: "issue-4",
    severity: "nit",
    filePath: "src/components/header.tsx",
    title: "Inconsistent naming convention",
    description: "The prop `isOpen` follows a different naming pattern than other boolean props in this component which use the `show` prefix.",
    category: "style",
  },
];

const MOCK_SUMMARY: Summary = {
  total: 4,
  bySeverity: { high: 1, medium: 1, low: 1, nit: 1 },
  duration: 8200,
};

export function useReviewLifecycle(): {
  state: ReviewLifecycleState;
  start: (mode: string) => void;
  goToSummary: () => void;
  goToResults: () => void;
  reset: () => void;
} {
  const [phase, setPhase] = useState<ReviewPhase>("idle");
  const [reviewId, setReviewId] = useState<string | undefined>();
  const stream = useReviewStream();

  function start(mode: string) {
    setPhase("streaming");
    setReviewId(`review-${Date.now()}`);
    stream.start(mode);
  }

  function goToSummary() {
    setPhase("summary");
  }

  function goToResults() {
    setPhase("results");
  }

  function reset() {
    setPhase("idle");
    setReviewId(undefined);
    stream.cancel();
  }

  const state: ReviewLifecycleState = {
    phase,
    reviewId,
    issues: phase === "results" || phase === "summary" ? MOCK_ISSUES : [],
    summary: phase === "summary" || phase === "results" ? MOCK_SUMMARY : undefined,
    steps: stream.state.steps,
    logEntries: stream.state.logEntries,
  };

  return { state, start, goToSummary, goToResults, reset };
}
