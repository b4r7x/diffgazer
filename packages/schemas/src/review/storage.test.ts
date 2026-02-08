import { describe, it, expect } from "vitest";
import { ReviewMetadataSchema } from "./storage.js";

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

  it("uses mode field when provided", () => {
    const result = ReviewMetadataSchema.parse({
      ...baseMetadata,
      mode: "staged",
    });

    expect(result.mode).toBe("staged");
  });

  it("derives mode from staged=true when mode is missing", () => {
    const result = ReviewMetadataSchema.parse({
      ...baseMetadata,
      staged: true,
    });

    expect(result.mode).toBe("staged");
  });

  it("derives mode from staged=false when mode is missing", () => {
    const result = ReviewMetadataSchema.parse({
      ...baseMetadata,
      staged: false,
    });

    expect(result.mode).toBe("unstaged");
  });

  it("defaults to unstaged when both mode and staged are missing", () => {
    const result = ReviewMetadataSchema.parse({
      ...baseMetadata,
    });

    expect(result.mode).toBe("unstaged");
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
