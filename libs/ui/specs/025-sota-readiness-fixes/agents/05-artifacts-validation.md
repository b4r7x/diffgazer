# Agent 05: Artifacts, Validation, and Final Local Gates

Model: `gpt-5.5`
Reasoning: medium
Mode: implementation after Agents 01-04

## Objective

Regenerate affected artifacts, add validation coverage that catches the audited failures, and run final local gates after source/doc changes land.

## Write Ownership

Primary:

- `libs/ui/registry/registry.json`
- `libs/ui/public/r/*.json`
- `libs/ui/docs/generated/**/*.json`
- `libs/keys/registry/registry.json`
- `libs/keys/public/r/*.json`
- `libs/keys/docs/generated/**/*.json`
- `cli/add/src/generated/*.json`
- `apps/docs/scripts/*.test.ts`
- `apps/docs/scripts/*.mjs`
- `scripts/monorepo/*.mjs`
- `turbo.json`
- `pnpm-lock.yaml` only if package changes require it

Coordinate before touching:

- source component/runtime files
- docs content files
- package manifests owned by Agent 04

## Requirements

- Run only after Agents 01-04 finish.
- Read `spec.md` and `P2-001`.
- You are not alone in the codebase. Do not revert user or other-agent edits.
- Regenerate artifacts from current source/docs.
- Add validation tests only where source tests cannot catch generated/copy-first drift.
- Do not create `.bak` or temporary committed files.

## Acceptance Criteria

- Generated docs/public registry artifacts reflect current source and docs.
- Artifact validation catches missing source-copy dependencies or stale mirrors where practical.
- Final local gates pass or failures are reported with precise cause.

## Verification

Run:

- `pnpm --filter @diffgazer/ui validate:registry`
- `pnpm run validate:artifacts`
- focused generated/docs tests touched by this agent
- any broader command that is feasible in the environment

