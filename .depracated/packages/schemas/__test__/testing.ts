export const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
export const VALID_UUID_2 = "550e8400-e29b-41d4-a716-446655440001";
export const VALID_TIMESTAMP = "2024-01-01T00:00:00.000Z";

export function createBaseMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_UUID,
    role: "user" as const,
    content: "Hello, world!",
    createdAt: VALID_TIMESTAMP,
    ...overrides,
  };
}

export function createSessionMetadata(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_UUID,
    projectPath: "/home/user/project",
    createdAt: VALID_TIMESTAMP,
    updatedAt: VALID_TIMESTAMP,
    messageCount: 0,
    ...overrides,
  };
}

export function createValidIssue(overrides: Record<string, unknown> = {}) {
  return {
    severity: "warning" as const,
    category: "logic" as const,
    file: "src/index.ts",
    line: 42,
    title: "Test Issue",
    description: "This is a test issue description",
    suggestion: "Consider fixing this",
    ...overrides,
  };
}

export function createReviewHistoryMetadata(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_UUID,
    projectPath: "/home/user/project",
    createdAt: VALID_TIMESTAMP,
    staged: true,
    branch: "main",
    overallScore: 8,
    issueCount: 0,
    criticalCount: 0,
    warningCount: 0,
    ...overrides,
  };
}

export function createReviewResult(overrides: Record<string, unknown> = {}) {
  return {
    summary: "Good code overall",
    issues: [createValidIssue()],
    overallScore: 8,
    ...overrides,
  };
}

export function createGitContext(overrides: Record<string, unknown> = {}) {
  return {
    branch: "main",
    fileCount: 1,
    ...overrides,
  };
}
