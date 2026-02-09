import type { Lens, LensId } from "@diffgazer/schemas/review";
import {
  CORRECTNESS_SYSTEM_PROMPT,
  CORRECTNESS_SEVERITY_RUBRIC,
  SECURITY_SYSTEM_PROMPT,
  SECURITY_SEVERITY_RUBRIC,
  PERFORMANCE_SYSTEM_PROMPT,
  PERFORMANCE_SEVERITY_RUBRIC,
  SIMPLICITY_SYSTEM_PROMPT,
  SIMPLICITY_SEVERITY_RUBRIC,
  TESTS_SYSTEM_PROMPT,
  TESTS_SEVERITY_RUBRIC,
} from "./prompts.js";

const correctnessLens: Lens = {
  id: "correctness",
  name: "Correctness",
  description: "Analyzes code for logical errors, edge cases, and potential bugs",
  systemPrompt: CORRECTNESS_SYSTEM_PROMPT,
  severityRubric: CORRECTNESS_SEVERITY_RUBRIC,
};

const securityLens: Lens = {
  id: "security",
  name: "Security",
  description: "Identifies security vulnerabilities, injection risks, and auth issues",
  systemPrompt: SECURITY_SYSTEM_PROMPT,
  severityRubric: SECURITY_SEVERITY_RUBRIC,
};

const performanceLens: Lens = {
  id: "performance",
  name: "Performance",
  description: "Detects performance issues, memory leaks, and inefficiencies",
  systemPrompt: PERFORMANCE_SYSTEM_PROMPT,
  severityRubric: PERFORMANCE_SEVERITY_RUBRIC,
};

const simplicityLens: Lens = {
  id: "simplicity",
  name: "Simplicity",
  description: "Reviews code for unnecessary complexity and maintainability issues",
  systemPrompt: SIMPLICITY_SYSTEM_PROMPT,
  severityRubric: SIMPLICITY_SEVERITY_RUBRIC,
};

const testsLens: Lens = {
  id: "tests",
  name: "Tests",
  description: "Evaluates test coverage, quality, and testing best practices",
  systemPrompt: TESTS_SYSTEM_PROMPT,
  severityRubric: TESTS_SEVERITY_RUBRIC,
};

const LENSES: Record<LensId, Lens> = {
  correctness: correctnessLens,
  security: securityLens,
  performance: performanceLens,
  simplicity: simplicityLens,
  tests: testsLens,
};

export function getLenses(ids: LensId[]): Lens[] {
  return ids.map((id) => LENSES[id]);
}

