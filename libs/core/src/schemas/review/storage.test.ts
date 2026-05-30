import { describe, it, expect } from "vitest";
import { ReviewMetadataSchema } from "./storage";

describe("ReviewMetadataSchema transform — mode backwards compat", () => {
  const baseMetadata = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    projectPath: "/home/user/project",
    createdAt: "2025-01-15T10:00:00Z",
    branch: "main",
    profile: null,
    lenses: ["correctness"],
    issueCount: 5,
    fileCount: 3,
  };

  it.each<{
    name: string;
    overrides: Record<string, unknown>;
    expectedMode: "staged" | "unstaged";
  }>([
    {
      name: "explicit mode wins",
      overrides: { mode: "staged" },
      expectedMode: "staged",
    },
    {
      name: "legacy staged=true derives mode",
      overrides: { staged: true },
      expectedMode: "staged",
    },
    {
      name: "legacy staged=false derives mode",
      overrides: { staged: false },
      expectedMode: "unstaged",
    },
    {
      name: "missing both fields defaults to unstaged",
      overrides: {},
      expectedMode: "unstaged",
    },
  ])("derives mode: $name → $expectedMode", ({ overrides, expectedMode }) => {
    const result = ReviewMetadataSchema.parse({ ...baseMetadata, ...overrides });

    expect(result.mode).toBe(expectedMode);
  });

  it("applies default counts for missing severity fields", () => {
    const result = ReviewMetadataSchema.parse({
      ...baseMetadata,
    });

    expect(result.blockerCount).toBe(0);
    expect(result.highCount).toBe(0);
    expect(result.mediumCount).toBe(0);
    expect(result.lowCount).toBe(0);
    expect(result.nitCount).toBe(0);
  });
});
