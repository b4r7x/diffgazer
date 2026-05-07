# RDY-009: Artifact And shadcn Validation Need Stronger Release Gates

Area: Artifact generation and validation

Severity: Medium

Priority: P2

Effort: M

## Problem

Artifact validation passes, but it does not directly validate every package export target or automate a clean shadcn namespace install using local UI and keys registries.

## Evidence

- `scripts/monorepo/validate-artifacts.mjs` validates artifact fingerprints and copied artifact parity.
- Package smoke indirectly checks exports, but export target checks are not part of artifact validation.
- `libs/ui/docs/content/utils/shadcn-namespace.mdx:21` documents local shadcn registry validation, but no enforced smoke script was found for serving `libs/ui/public/r` and `libs/keys/public/r` and installing namespaced items.

## User Impact

Registry or export drift can survive artifact validation until a later smoke stage. shadcn namespace regressions can stay manual-only.

## Fix

Add a non-mutating export/dist validator and a clean shadcn namespace smoke script.

## Acceptance Criteria

- Every non-CSS package export has existing JS and `.d.ts` targets.
- Every CSS export target exists.
- Registry-derived expected exports match actual package exports, including hidden-item policy.
- Local shadcn smoke installs `@ui/accordion` or `@ui/select` plus `@diffgazer-keys/navigation` dependencies and type-checks/builds.

## Verification

Run `pnpm --filter @diffgazer/ui build`, `pnpm run validate:artifacts`, `pnpm run smoke:packages`, and the new local shadcn consumer smoke.

