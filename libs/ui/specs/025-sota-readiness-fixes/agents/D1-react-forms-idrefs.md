# Agent D1: React Forms and IDREF Closure

Model: `gpt-5.5`
Reasoning: medium
Mode: implementation

## Objective

Close the remaining React lifecycle, form validity, Radio semantics, and active-descendant blockers without a broad form-control rewrite.

## Write Ownership

Primary:

- `libs/ui/registry/hooks/use-presence.ts`
- `libs/ui/registry/hooks/testing/use-presence.test.ts`
- `libs/ui/registry/ui/dialog/dialog.tsx`
- `libs/ui/registry/ui/dialog/dialog-context.tsx`
- `libs/ui/registry/ui/dialog/dialog-content.tsx`
- `libs/ui/registry/ui/dialog/dialog-title.tsx`
- `libs/ui/registry/ui/dialog/dialog.test.tsx`
- `libs/ui/registry/ui/select/select.tsx`
- `libs/ui/registry/ui/select/select-context.tsx`
- `libs/ui/registry/ui/select/select-content.tsx`
- `libs/ui/registry/ui/select/select-search.tsx`
- `libs/ui/registry/ui/select/select-trigger.tsx`
- `libs/ui/registry/ui/select/use-select-state.ts`
- `libs/ui/registry/ui/select/select.test.tsx`
- `libs/ui/registry/ui/radio/radio.tsx`
- `libs/ui/registry/ui/radio/radio-group.tsx`
- `libs/ui/registry/ui/radio/radio-group-context.tsx`
- `libs/ui/registry/ui/radio/radio-group-item.tsx`
- `libs/ui/registry/ui/radio/radio.test.tsx`
- `libs/ui/registry/ui/command-palette/use-command-palette-state.ts`
- `libs/ui/registry/ui/command-palette/command-palette-input.tsx`
- `libs/ui/registry/ui/command-palette/command-palette.test.tsx`

Coordinate before touching:

- generated docs/public registry artifacts
- package manifests

## Requirements

- Read `spec.md`, `P1-006`, and `P1-002`.
- You are not alone in the codebase. Do not revert user or other-agent edits.
- Remove render-phase state sync from `usePresence`.
- Remove Dialog render output dependency on mounted-title refs.
- Make required Select/Radio validation work with and without `name`; unnamed controls must validate but not submit FormData.
- Keep hidden native controls as mirrors only where needed; visible controls must expose invalid/focus semantics.
- Remove invalid `aria-required` from individual `role="radio"` items; keep required semantics on the group.
- Ensure Select and CommandPalette only emit `aria-activedescendant` for mounted, enabled, visible options.
- Add behavior-focused tests.

## Acceptance Criteria

- No production render-phase `setState` in `usePresence`.
- No render-affecting title ref read in Dialog.
- Required unnamed Select and RadioGroup fail validation, focus visible controls, and do not add FormData.
- Required named Select and RadioGroup still submit correct FormData.
- Radio items do not emit invalid required ARIA.
- Stale controlled active-descendant values are omitted.

## Verification

Run focused tests for presence, dialog, select, radio, command palette, and `@diffgazer/ui type-check`.

