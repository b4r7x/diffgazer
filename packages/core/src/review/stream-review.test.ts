import { describe, it, expect, vi } from "vitest";
import { buildReviewQueryParams } from "./stream-review.js";

describe("buildReviewQueryParams", () => {
  it("defaults mode to unstaged", () => {
    const params = buildReviewQueryParams({});

    expect(params.mode).toBe("unstaged");
  });

  it("uses provided mode", () => {
    const params = buildReviewQueryParams({ mode: "staged" });

    expect(params.mode).toBe("staged");
  });

  it("joins files with commas", () => {
    const params = buildReviewQueryParams({ files: ["a.ts", "b.ts"] });

    expect(params.files).toBe("a.ts,b.ts");
  });

  it("omits files when empty array", () => {
    const params = buildReviewQueryParams({ files: [] });

    expect(params.files).toBeUndefined();
  });

  it("omits files when undefined", () => {
    const params = buildReviewQueryParams({});

    expect(params.files).toBeUndefined();
  });

  it("joins lenses with commas", () => {
    const params = buildReviewQueryParams({ lenses: ["correctness", "security"] });

    expect(params.lenses).toBe("correctness,security");
  });

  it("omits lenses when empty array", () => {
    const params = buildReviewQueryParams({ lenses: [] });

    expect(params.lenses).toBeUndefined();
  });

  it("includes profile when provided", () => {
    const params = buildReviewQueryParams({ profile: "thorough" });

    expect(params.profile).toBe("thorough");
  });

  it("omits profile when undefined", () => {
    const params = buildReviewQueryParams({});

    expect(params.profile).toBeUndefined();
  });

  it("builds params with all options", () => {
    const params = buildReviewQueryParams({
      mode: "files",
      files: ["x.ts"],
      lenses: ["security"],
      profile: "quick",
    });

    expect(params).toEqual({
      mode: "files",
      files: "x.ts",
      lenses: "security",
      profile: "quick",
    });
  });
});
