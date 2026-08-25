import type { Lens, SelectableLensId } from "@diffgazer/core/schemas/review";
import {
  CORRECTNESS_SEVERITY_RUBRIC,
  CORRECTNESS_SYSTEM_PROMPT,
  PERFORMANCE_SEVERITY_RUBRIC,
  PERFORMANCE_SYSTEM_PROMPT,
  SECURITY_SEVERITY_RUBRIC,
  SECURITY_SYSTEM_PROMPT,
  SIMPLICITY_SEVERITY_RUBRIC,
  SIMPLICITY_SYSTEM_PROMPT,
  SYNTHESIS_SEVERITY_RUBRIC,
  SYNTHESIS_SYSTEM_PROMPT,
  TESTS_SEVERITY_RUBRIC,
  TESTS_SYSTEM_PROMPT,
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

/**
 * The engine-only cross-batch pass. Never selectable: it is dispatched by the
 * orchestrator, once, after the lens fold of a review that ran in >1 batch.
 */
export const SYNTHESIS_LENS: Lens = {
  id: "synthesis",
  name: "Synthesis",
  description: "Connects findings across batches of a split diff",
  systemPrompt: SYNTHESIS_SYSTEM_PROMPT,
  severityRubric: SYNTHESIS_SEVERITY_RUBRIC,
};

const LENSES: Record<SelectableLensId, Lens> = {
  correctness: correctnessLens,
  security: securityLens,
  performance: performanceLens,
  simplicity: simplicityLens,
  tests: testsLens,
};

export function getLenses(ids: SelectableLensId[]): Lens[] {
  return ids.map((id) => LENSES[id]);
}
