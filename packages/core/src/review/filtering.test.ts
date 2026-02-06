import { describe, it, expect } from "vitest";
import {
  issueMatchesPattern,
  filterIssuesByPattern,
  filterIssuesBySeverity,
  filterIssues,
} from "./filtering.js";
import type { ReviewIssue } from "@stargazer/schemas/review";

const makeIssue = (overrides: Partial<ReviewIssue>): ReviewIssue => ({
  id: "1",
  severity: "medium",
  category: "correctness",
  title: "Test Issue",
  file: "src/test.ts",
  line_start: 10,
  line_end: 15,
  rationale: "Test rationale",
  recommendation: "Fix it",
  suggested_patch: null,
  confidence: 0.8,
  symptom: "Test symptom",
  whyItMatters: "Test why",
  evidence: [],
  ...overrides,
});

describe("issueMatchesPattern", () => {
  it("matches title case-insensitively", () => {
    const issue = makeIssue({ title: "SQL Injection" });
    expect(issueMatchesPattern(issue, "sql")).toBe(true);
    expect(issueMatchesPattern(issue, "SQL")).toBe(true);
    expect(issueMatchesPattern(issue, "injection")).toBe(true);
  });

  it("matches category", () => {
    const issue = makeIssue({ category: "security" });
    expect(issueMatchesPattern(issue, "security")).toBe(true);
  });

  it("matches file path", () => {
    const issue = makeIssue({ file: "auth/login.ts" });
    expect(issueMatchesPattern(issue, "auth")).toBe(true);
    expect(issueMatchesPattern(issue, "login")).toBe(true);
  });

  it("matches rationale", () => {
    const issue = makeIssue({ rationale: "Buffer overflow detected" });
    expect(issueMatchesPattern(issue, "overflow")).toBe(true);
  });

  it("returns false for no match", () => {
    const issue = makeIssue({});
    expect(issueMatchesPattern(issue, "nonexistent")).toBe(false);
  });
});

describe("filterIssuesByPattern", () => {
  const issues = [
    makeIssue({ id: "1", title: "SQL Issue", category: "security" }),
    makeIssue({ id: "2", title: "Memory Leak", category: "performance" }),
    makeIssue({ id: "3", title: "Type Error", file: "auth/user.ts" }),
  ];

  it("returns all issues when no filter", () => {
    const result = filterIssuesByPattern(issues, null, []);
    expect(result).toEqual(issues);
  });

  it("moves matching issues to front with activeFilter", () => {
    const result = filterIssuesByPattern(issues, "security", []);
    expect(result[0].id).toBe("1");
    expect(result.length).toBe(3);
  });

  it("excludes issues matching ignored patterns", () => {
    const result = filterIssuesByPattern(issues, null, ["memory"]);
    expect(result.length).toBe(2);
    expect(result.find((i) => i.id === "2")).toBeUndefined();
  });

  it("applies both activeFilter and ignoredPatterns", () => {
    const result = filterIssuesByPattern(issues, "auth", ["sql"]);
    expect(result.length).toBe(2);
    expect(result[0].id).toBe("3"); // auth match moved to front
    expect(result.find((i) => i.id === "1")).toBeUndefined(); // sql ignored
  });
});

describe("filterIssuesBySeverity", () => {
  const issues = [
    makeIssue({ id: "1", severity: "blocker" }),
    makeIssue({ id: "2", severity: "high" }),
    makeIssue({ id: "3", severity: "medium" }),
    makeIssue({ id: "4", severity: "blocker" }),
  ];

  it("returns all issues for 'all' filter", () => {
    const result = filterIssuesBySeverity(issues, "all");
    expect(result).toEqual(issues);
  });

  it("filters to specific severity", () => {
    const result = filterIssuesBySeverity(issues, "blocker");
    expect(result.length).toBe(2);
    expect(result.every((i) => i.severity === "blocker")).toBe(true);
  });

  it("returns empty array when no matches", () => {
    const result = filterIssuesBySeverity(issues, "nit");
    expect(result).toEqual([]);
  });
});

describe("filterIssues", () => {
  const issues = [
    makeIssue({ id: "1", title: "SQL Issue", severity: "blocker", category: "security" }),
    makeIssue({ id: "2", title: "Memory Leak", severity: "high", category: "performance" }),
    makeIssue({ id: "3", title: "Type Error", severity: "medium" }),
  ];

  it("applies all filters", () => {
    const result = filterIssues(issues, {
      activeFilter: "sql",
      ignoredPatterns: [],
      severityFilter: "blocker",
    });
    expect(result.length).toBe(1);
    expect(result[0].id).toBe("1");
  });

  it("uses defaults when options not provided", () => {
    const result = filterIssues(issues, {});
    expect(result).toEqual(issues);
  });
});
