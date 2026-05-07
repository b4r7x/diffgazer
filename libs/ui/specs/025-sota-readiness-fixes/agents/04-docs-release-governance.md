# Agent 04: Docs and Release Governance

Model: `gpt-5.5`
Reasoning: medium
Mode: implementation

## Objective

Fix docs handoff, React peer wording, theme/package story, command gating, changesets, policy files, and `diffgazer` package lifecycle issues.

## Write Ownership

Primary:

- `.changeset/*.md`
- `PACKAGE_GOVERNANCE.md`
- `SECURITY.md`
- `SUPPORT.md`
- `cli/add/SECURITY.md`
- `cli/add/SUPPORT.md`
- `cli/add/README.md`
- `cli/add/package.json`
- `cli/diffgazer/SECURITY.md`
- `cli/diffgazer/SUPPORT.md`
- `cli/diffgazer/package.json`
- `libs/keys/SECURITY.md`
- `libs/keys/SUPPORT.md`
- `libs/keys/README.md`
- `libs/keys/docs/content/**/*.mdx`
- `libs/keys/package.json`
- `libs/ui/SECURITY.md`
- `libs/ui/SUPPORT.md`
- `libs/ui/README.md`
- `libs/ui/docs/content/**/*.mdx`
- `libs/ui/package.json`
- `apps/docs/package.json`
- `apps/docs/src/components/docs-mdx/blocks/install-command.tsx`
- `apps/docs/src/lib/docs-library.test.ts`
- `apps/docs/src/lib/docs-library.ts`

Coordinate before touching:

- generated `libs/ui/docs/generated/**/*.json`
- generated `libs/keys/docs/generated/**/*.json`
- `pnpm-lock.yaml`

## Requirements

- Read `spec.md`, `P1-004`, and `P1-005`.
- You are not alone in the codebase. Do not revert user or other-agent edits.
- Hosted registry/deploy remains future non-blocker.
- Public npm commands must be gated until publication.
- Use exact React peer floor wording where relevant: React `>=19.2.0`.
- Update theme and CommandPalette docs to match current implementation.
- Ensure package-included policy files are present and intended to be tracked.
- Update changesets to include all public package changes that remain.
- Make docs preview deterministic or clearly document the `npx` network dependency.
- Make `diffgazer` package lifecycle self-contained or route through correct dependency build.

## Acceptance Criteria

- No stale public install command promises.
- No stale theme/React peer/CommandPalette API docs.
- Changeset status covers changed public packages.
- Policy files are tracked-intended and included consistently.
- `diffgazer` prepack/build path is clean for release handoff.

## Verification

Run docs tests or static checks you touch, plus changeset status if possible.

