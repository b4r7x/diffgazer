import type {
  ActiveReviewSession,
  CreateReviewResponse,
  ReviewIssue,
  ReviewMetadata,
} from "../schemas/review/index.js";

export function makeIssue(overrides: Partial<ReviewIssue> = {}): ReviewIssue {
  return {
    id: "issue-1",
    severity: "high",
    category: "correctness",
    title: "Test issue",
    file: "src/index.ts",
    line_start: 10,
    line_end: 15,
    rationale: "test rationale",
    recommendation: "test recommendation",
    suggested_patch: null,
    confidence: 0.9,
    symptom: "test symptom",
    whyItMatters: "test explanation",
    evidence: [],
    ...overrides,
  };
}

export function makeReviewMetadata(overrides: Partial<ReviewMetadata> = {}): ReviewMetadata {
  return {
    id: "review-1",
    projectPath: "/repo",
    createdAt: "2026-02-09T12:00:00.000Z",
    mode: "unstaged",
    branch: "main",
    profile: null,
    lenses: [],
    issueCount: 0,
    blockerCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    nitCount: 0,
    fileCount: 1,
    durationMs: 1200,
    ...overrides,
  };
}

export function makeActiveReviewSession(
  overrides: Partial<ActiveReviewSession> = {},
): ActiveReviewSession {
  return {
    reviewId: "11111111-1111-4111-8111-111111111111",
    mode: "unstaged",
    startedAt: "2026-01-01T00:00:00.000Z",
    headCommit: "abc123",
    statusHash: "hash123",
    ...overrides,
  };
}

type CreateReviewResponseOverrides = Partial<Omit<CreateReviewResponse, "session">> & {
  session?: Partial<ActiveReviewSession>;
};

export function makeCreateReviewResponse(
  overrides: CreateReviewResponseOverrides = {},
): CreateReviewResponse {
  const reviewId =
    overrides.reviewId ?? overrides.session?.reviewId ?? "11111111-1111-4111-8111-111111111111";

  return {
    reviewId,
    session: makeActiveReviewSession({ ...overrides.session, reviewId }),
  };
}
