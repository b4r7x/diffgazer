# Agent D2: Docs API CSS Truth

Model: `gpt-5.5`
Reasoning: medium
Mode: implementation

## Objective

Make public docs and examples match the current API, composition contract, install/package state, theme tokens, and CSS story.

## Write Ownership

Primary:

- `libs/ui/docs/content/**/*.mdx`
- `libs/ui/registry/component-docs/*.ts`
- `libs/ui/registry/examples/**/*.tsx`
- `apps/docs/src/features/theme/components/*.tsx`
- `apps/docs/src/index.css`
- `apps/docs/src/components/docs-mdx/blocks/example.tsx`
- `apps/docs/src/lib/docs-library.test.ts`
- `apps/docs/src/lib/docs-library.ts`
- `cli/diffgazer/README.md`
- `libs/ui/README.md`
- `libs/keys/README.md`
- `cli/add/README.md`

Coordinate before touching:

- generated docs/public registry artifacts
- package manifests

## Requirements

- Read `spec.md`, `P1-006`, `P1-003`, `P1-004`, and `P2-002`.
- Remove broad wrapper claims such as "no matter how deep" for metadata-scanned components.
- Update examples to preferred props: `onValueChange`, `highlightedId`, `onHighlightChange`.
- Fix missing component page example references or make missing examples fail validation.
- Update compound guide for current Toast, Stepper, and direct-child item collector limits.
- Update theme docs/widgets to match `libs/ui/styles/theme.css`.
- Remove docs app direct dependency on hidden `dialog.css` if possible; otherwise document the seed/materialized CSS split clearly and add validation.
- Normalize `diffgazer` install docs/readme to actual npm state and publication gates.
- Add or update docs/static tests for stale wrapper claims, deprecated examples, missing examples, public command gating, and stale theme tokens.
- Document Yarn PnP stance for Tailwind package mode.

## Acceptance Criteria

- No stale deep-wrapper claim in docs/generated docs.
- Public examples do not teach deprecated props except explicit compatibility/deprecation docs.
- No missing top examples render silently.
- Theme docs/widgets match canonical current tokens.
- `diffgazer` docs/readme are consistent with package reality.
- Public install commands are local-first or explicitly publish-gated.

## Verification

Run docs tests touched by this change and provide `rg` checks for stale phrases/props.

