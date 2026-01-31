import type { ReviewProfile, ProfileId } from "@repo/schemas/lens";

export const quickProfile: ReviewProfile = {
  id: "quick",
  name: "Quick Review",
  description: "Fast review focusing on critical correctness issues",
  lenses: ["correctness"],
  filter: { minSeverity: "high" },
};

export const strictProfile: ReviewProfile = {
  id: "strict",
  name: "Strict Review",
  description: "Comprehensive review covering correctness, security, and tests",
  lenses: ["correctness", "security", "tests"],
};

export const perfProfile: ReviewProfile = {
  id: "perf",
  name: "Performance Review",
  description: "Performance-focused review with correctness baseline",
  lenses: ["correctness", "performance"],
  filter: { minSeverity: "medium" },
};

export const securityProfile: ReviewProfile = {
  id: "security",
  name: "Security Audit",
  description: "Security-focused review for sensitive changes",
  lenses: ["security", "correctness"],
};

const PROFILES: Record<ProfileId, ReviewProfile> = {
  quick: quickProfile,
  strict: strictProfile,
  perf: perfProfile,
  security: securityProfile,
};

export function getProfile(id: ProfileId): ReviewProfile {
  return PROFILES[id];
}
