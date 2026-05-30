// Single source of truth for the environment-variable names the monorepo
// scripts read. These names are a user-facing contract: they appear in skip
// messages and failure hints, so keeping the literals here prevents drift
// between the `process.env` access and the strings that document them.
export const ENV = {
  smokeAllowNetwork: "DIFFGAZER_SMOKE_ALLOW_NETWORK",
  smokeStrictSkips: "DIFFGAZER_SMOKE_STRICT_SKIPS",
  shadcnCommand: "DIFFGAZER_SHADCN_COMMAND",
  requireTrackedPolicy: "DIFFGAZER_REQUIRE_TRACKED_POLICY",
  benchReviewPipeline: "DIFFGAZER_BENCH_REVIEW",
  ci: "CI",
};
