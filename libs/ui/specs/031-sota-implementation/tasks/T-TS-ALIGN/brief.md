# Task T-TS-ALIGN — Align libs/ui + libs/registry tsconfigs + fix core React peer

**Source findings:** TS-001
**Severity:** Medium
**Phase:** 3
**Blocks:** none
**Blocked by:** none

## Goal
- `libs/ui/tsconfig.json` is the weakest config in the repo. Missing: `noUncheckedIndexedAccess`, `isolatedModules`, `declarationMap`, `verbatimModuleSyntax`, `noImplicitOverride`, `noFallthroughCasesInSwitch`.
- `libs/registry/tsconfig.json` uses `Node16` instead of `NodeNext`, missing `verbatimModuleSyntax`, `declarationMap`, `noImplicitOverride`, `isolatedModules`.
- `@diffgazer/core` declares React peer as `^18.0.0 || ^19.0.0` — inconsistent with `>=19.2.0` everywhere else; core actually requires React 19 features.
- `apps/docs` toolchain drift: typescript 5.7.2 vs 5.9.3 globally.

Bring libs/ui and libs/registry inline with `libs/core/tsconfig/base.json`. Fix core peer floor. Optionally align apps/docs (but apps may have their own reasons for slower upgrades — verify before bumping).

## Files to touch (allowlist)
- `libs/ui/tsconfig.json` (extend or match base.json strictness flags)
- `libs/registry/tsconfig.json` (migrate Node16 → NodeNext, add missing flags)
- `libs/core/package.json` (`peerDependencies.react` → `>=19.2.0`)
- `apps/docs/package.json` (bump typescript if compatible; otherwise note in Report under follow-ups)

## Files NOT to touch
- Source code (fixing TS errors that surface from stricter flags is in scope, but minimal)
- Other package tsconfigs that are already aligned

## Acceptance criteria
- [ ] `libs/ui/tsconfig.json` has: `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`, `noFallthroughCasesInSwitch: true`, `verbatimModuleSyntax: true`, `isolatedModules: true`, `declarationMap: true`
- [ ] `libs/registry/tsconfig.json` has: `moduleResolution: NodeNext`, `module: NodeNext`, plus all the same strictness flags
- [ ] `libs/core/package.json` `peerDependencies.react` is `>=19.2.0` (matching ui and keys)
- [ ] All packages still type-check: `pnpm exec turbo run type-check`
- [ ] All tests pass
- [ ] If stricter flags surface real bugs in libs/ui or libs/registry source, fix them (minimal touch — usually `array[i]!` → `if (!array[i]) continue;`)

## Verification commands
```bash
cd /Users/voitz/Projects/diffgazer-workspace
DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check
DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test
diff <(jq -S '.compilerOptions' libs/core/tsconfig/base.json) <(jq -S '.compilerOptions' libs/ui/tsconfig.json) | head -30
diff <(jq -S '.compilerOptions' libs/core/tsconfig/base.json) <(jq -S '.compilerOptions' libs/registry/tsconfig.json) | head -30
```

## Notes & references
- Spec 029 §TS-001
- `libs/core/tsconfig/base.json` is the canonical baseline
- `exactOptionalPropertyTypes` is an open question (not enabled anywhere yet) — do NOT enable in this task

## Non-goals
- Do not enable `exactOptionalPropertyTypes` (separate decision)
- Do not migrate apps/docs/tsconfig.json structure (just bump TS version if compatible)
- Do not refactor source code beyond minimal fixes for new strictness flags
- Do not add TS project references / `composite: true`
