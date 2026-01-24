import { describe, it, expect } from "vitest";
import {
  LensIdSchema,
  SeverityRubricSchema,
  LensSchema,
  ProfileIdSchema,
  SeverityFilterSchema,
  ReviewProfileSchema,
  DrilldownResultSchema,
  LensErrorCodeSchema,
  LensErrorSchema,
  LENS_IDS,
  PROFILE_IDS,
  LENS_SPECIFIC_CODES,
  type Lens,
  type ReviewProfile,
} from "./lens.js";

describe("LensIdSchema", () => {
  it.each([...LENS_IDS])(
    "accepts valid lens id: %s",
    (id) => {
      const result = LensIdSchema.safeParse(id);
      expect(result.success).toBe(true);
    }
  );

  it.each(["invalid", "bugs", "quality", "", "CORRECTNESS"])(
    "rejects invalid lens id: %s",
    (id) => {
      const result = LensIdSchema.safeParse(id);
      expect(result.success).toBe(false);
    }
  );
});

describe("SeverityRubricSchema", () => {
  it("accepts valid severity rubric with all levels", () => {
    const result = SeverityRubricSchema.safeParse({
      blocker: "Critical bugs that prevent deployment",
      high: "Serious bugs that affect functionality",
      medium: "Moderate issues that should be fixed",
      low: "Minor issues for consideration",
      nit: "Style or preference suggestions",
    });
    expect(result.success).toBe(true);
  });

  it("accepts rubric with empty strings", () => {
    const result = SeverityRubricSchema.safeParse({
      blocker: "",
      high: "",
      medium: "",
      low: "",
      nit: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects rubric with missing severity levels", () => {
    expect(SeverityRubricSchema.safeParse({
      blocker: "test",
      high: "test",
      medium: "test",
      low: "test",
    }).success).toBe(false);
  });

  it("rejects rubric with invalid types", () => {
    expect(SeverityRubricSchema.safeParse({
      blocker: 1,
      high: "test",
      medium: "test",
      low: "test",
      nit: "test",
    }).success).toBe(false);
  });

  it("allows extra fields due to Zod passthrough behavior", () => {
    const result = SeverityRubricSchema.safeParse({
      blocker: "test",
      high: "test",
      medium: "test",
      low: "test",
      nit: "test",
      critical: "extra field",
    });
    expect(result.success).toBe(true);
  });
});

describe("LensSchema", () => {
  it("accepts valid lens configuration", () => {
    const result = LensSchema.safeParse({
      id: "correctness",
      name: "Correctness",
      description: "Checks for bugs and logic errors",
      systemPrompt: "You are a code reviewer focused on correctness",
      severityRubric: {
        blocker: "Critical bugs",
        high: "Serious bugs",
        medium: "Moderate issues",
        low: "Minor issues",
        nit: "Suggestions",
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts all valid lens ids", () => {
    LENS_IDS.forEach((id) => {
      const result = LensSchema.safeParse({
        id,
        name: `${id} lens`,
        description: "Test description",
        systemPrompt: "Test prompt",
        severityRubric: {
          blocker: "test",
          high: "test",
          medium: "test",
          low: "test",
          nit: "test",
        },
      });
      expect(result.success).toBe(true);
    });
  });

  it("rejects lens with invalid id", () => {
    const result = LensSchema.safeParse({
      id: "invalid",
      name: "Invalid Lens",
      description: "Test",
      systemPrompt: "Test",
      severityRubric: {
        blocker: "test",
        high: "test",
        medium: "test",
        low: "test",
        nit: "test",
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects lens with missing required fields", () => {
    expect(LensSchema.safeParse({
      id: "correctness",
      name: "Correctness",
    }).success).toBe(false);
  });

  it("provides correct type inference", () => {
    const lens: Lens = {
      id: "security",
      name: "Security",
      description: "Security checks",
      systemPrompt: "Check for security issues",
      severityRubric: {
        blocker: "test",
        high: "test",
        medium: "test",
        low: "test",
        nit: "test",
      },
    };
    expect(LensSchema.safeParse(lens).success).toBe(true);
  });
});

describe("ProfileIdSchema", () => {
  it.each([...PROFILE_IDS])(
    "accepts valid profile id: %s",
    (id) => {
      const result = ProfileIdSchema.safeParse(id);
      expect(result.success).toBe(true);
    }
  );

  it.each(["invalid", "standard", "custom", "", "QUICK"])(
    "rejects invalid profile id: %s",
    (id) => {
      const result = ProfileIdSchema.safeParse(id);
      expect(result.success).toBe(false);
    }
  );
});

describe("SeverityFilterSchema", () => {
  it.each(["blocker", "high", "medium", "low", "nit"])(
    "accepts valid severity filter: %s",
    (severity) => {
      const result = SeverityFilterSchema.safeParse({
        minSeverity: severity,
      });
      expect(result.success).toBe(true);
    }
  );

  it("rejects invalid severity", () => {
    const result = SeverityFilterSchema.safeParse({
      minSeverity: "critical",
    });
    expect(result.success).toBe(false);
  });

  it("rejects filter without minSeverity", () => {
    const result = SeverityFilterSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("ReviewProfileSchema", () => {
  it("accepts valid profile without filter", () => {
    const result = ReviewProfileSchema.safeParse({
      id: "quick",
      name: "Quick Review",
      description: "Fast review focusing on critical issues",
      lenses: ["correctness"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid profile with filter", () => {
    const result = ReviewProfileSchema.safeParse({
      id: "strict",
      name: "Strict Review",
      description: "Comprehensive review",
      lenses: ["correctness", "security", "tests"],
      filter: {
        minSeverity: "low",
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts profile with all lenses", () => {
    const result = ReviewProfileSchema.safeParse({
      id: "strict",
      name: "Complete Review",
      description: "All checks",
      lenses: ["correctness", "security", "performance", "simplicity", "tests"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts profile with single lens", () => {
    const result = ReviewProfileSchema.safeParse({
      id: "security",
      name: "Security Only",
      description: "Security checks",
      lenses: ["security"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts profile with empty lenses array", () => {
    const result = ReviewProfileSchema.safeParse({
      id: "quick",
      name: "No Lenses",
      description: "Empty profile",
      lenses: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects profile with invalid lens id", () => {
    const result = ReviewProfileSchema.safeParse({
      id: "quick",
      name: "Test",
      description: "Test",
      lenses: ["invalid"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects profile with invalid profile id", () => {
    const result = ReviewProfileSchema.safeParse({
      id: "custom",
      name: "Custom",
      description: "Test",
      lenses: ["correctness"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects profile with missing required fields", () => {
    expect(ReviewProfileSchema.safeParse({
      id: "quick",
      name: "Test",
    }).success).toBe(false);
  });

  it("provides correct type inference", () => {
    const profile: ReviewProfile = {
      id: "perf",
      name: "Performance",
      description: "Performance review",
      lenses: ["correctness", "performance"],
      filter: {
        minSeverity: "medium",
      },
    };
    expect(ReviewProfileSchema.safeParse(profile).success).toBe(true);
  });
});

describe("DrilldownResultSchema", () => {
  it("accepts valid drilldown result with all fields", () => {
    const result = DrilldownResultSchema.safeParse({
      issueId: "issue-123",
      issue: {
        id: "issue-123",
        severity: "high",
        category: "correctness",
        title: "Null pointer dereference",
        file: "src/app.ts",
        line_start: 10,
        line_end: 15,
        rationale: "Variable may be null",
        recommendation: "Add null check",
        suggested_patch: "+  if (value !== null) {\n     doSomething(value);\n+  }",
        confidence: 0.85,
      },
      detailedAnalysis: "The code dereferences a potentially null value",
      rootCause: "Missing null validation",
      impact: "Application crash at runtime",
      suggestedFix: "Add null check before usage",
      patch: "diff --git a/file.ts",
      relatedIssues: ["issue-124", "issue-125"],
      references: ["https://docs.example.com/null-safety"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts drilldown with null patch", () => {
    const result = DrilldownResultSchema.safeParse({
      issueId: "issue-123",
      issue: {
        id: "issue-123",
        severity: "low",
        category: "style",
        title: "Style issue",
        file: "src/app.ts",
        line_start: null,
        line_end: null,
        rationale: "Test",
        recommendation: "Test",
        suggested_patch: null,
        confidence: 0.9,
      },
      detailedAnalysis: "Test",
      rootCause: "Test",
      impact: "Test",
      suggestedFix: "Test",
      patch: null,
      relatedIssues: [],
      references: [],
    });
    expect(result.success).toBe(true);
  });

  it("accepts drilldown with empty related issues and references", () => {
    const result = DrilldownResultSchema.safeParse({
      issueId: "issue-123",
      issue: {
        id: "issue-123",
        severity: "medium",
        category: "performance",
        title: "Performance issue",
        file: "src/utils.ts",
        line_start: 5,
        line_end: 5,
        rationale: "Test",
        recommendation: "Test",
        suggested_patch: null,
        confidence: 0.7,
      },
      detailedAnalysis: "Test",
      rootCause: "Test",
      impact: "Test",
      suggestedFix: "Test",
      patch: null,
      relatedIssues: [],
      references: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects drilldown with missing required fields", () => {
    expect(DrilldownResultSchema.safeParse({
      issueId: "issue-123",
      detailedAnalysis: "Test",
    }).success).toBe(false);
  });

  it("rejects drilldown with invalid issue structure", () => {
    const result = DrilldownResultSchema.safeParse({
      issueId: "issue-123",
      issue: {
        id: "issue-123",
        severity: "invalid",
        category: "correctness",
      },
      detailedAnalysis: "Test",
      rootCause: "Test",
      impact: "Test",
      suggestedFix: "Test",
      patch: null,
      relatedIssues: [],
      references: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("LensErrorCodeSchema", () => {
  it.each([
    ...LENS_SPECIFIC_CODES,
    "INTERNAL_ERROR",
    "API_KEY_MISSING",
    "RATE_LIMITED",
  ] as const)("accepts valid error code: %s", (code) => {
    const result = LensErrorCodeSchema.safeParse(code);
    expect(result.success).toBe(true);
  });

  it("rejects invalid error code", () => {
    const result = LensErrorCodeSchema.safeParse("INVALID_CODE");
    expect(result.success).toBe(false);
  });
});

describe("LensErrorSchema", () => {
  it("accepts error with message and code", () => {
    const result = LensErrorSchema.safeParse({
      message: "No diff provided",
      code: "NO_DIFF",
    });
    expect(result.success).toBe(true);
  });

  it("accepts error with all specific codes", () => {
    LENS_SPECIFIC_CODES.forEach((code) => {
      const result = LensErrorSchema.safeParse({
        message: `Error: ${code}`,
        code,
      });
      expect(result.success).toBe(true);
    });
  });

  it("accepts error with shared error codes", () => {
    expect(LensErrorSchema.safeParse({
      message: "Internal error",
      code: "INTERNAL_ERROR",
    }).success).toBe(true);

    expect(LensErrorSchema.safeParse({
      message: "API key missing",
      code: "API_KEY_MISSING",
    }).success).toBe(true);

    expect(LensErrorSchema.safeParse({
      message: "Rate limited",
      code: "RATE_LIMITED",
    }).success).toBe(true);
  });

  it("rejects error with missing required fields", () => {
    expect(LensErrorSchema.safeParse({ message: "Error" }).success).toBe(false);
    expect(LensErrorSchema.safeParse({ code: "NO_DIFF" }).success).toBe(false);
  });

  it("rejects error with invalid code", () => {
    const result = LensErrorSchema.safeParse({
      message: "Error",
      code: "INVALID_CODE",
    });
    expect(result.success).toBe(false);
  });
});
