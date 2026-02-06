import type { ProfileId, ReviewProfile } from "@stargazer/schemas/lens";

const PROFILES: Record<ProfileId, ReviewProfile> = {
  quick: {
    id: "quick",
    name: "Quick Review",
    description: "Fast review focusing on critical correctness issues",
    lenses: ["correctness"],
    filter: { minSeverity: "high" },
  },
  strict: {
    id: "strict",
    name: "Strict Review",
    description: "Comprehensive review covering correctness, security, and tests",
    lenses: ["correctness", "security", "tests"],
  },
  perf: {
    id: "perf",
    name: "Performance Review",
    description: "Performance-focused review with correctness baseline",
    lenses: ["correctness", "performance"],
    filter: { minSeverity: "medium" },
  },
  security: {
    id: "security",
    name: "Security Audit",
    description: "Security-focused review for sensitive changes",
    lenses: ["security", "correctness"],
  },
};

export function getProfile(id: ProfileId): ReviewProfile {
  return PROFILES[id];
}

export { PROFILES };
