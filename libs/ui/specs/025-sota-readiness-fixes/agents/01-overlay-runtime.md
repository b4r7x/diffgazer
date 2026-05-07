# Agent 01: Overlay Runtime

Model: `gpt-5.5`
Reasoning: medium
Mode: implementation

## Objective

Fix P1 overlay behavior so modal overlays, nested portals, and focus restore are correct for Dialog and CommandPalette.

## Write Ownership

Primary:

- `libs/ui/registry/ui/shared/dialog-shell.tsx`
- `libs/ui/registry/ui/shared/portal.tsx`
- `libs/ui/registry/ui/dialog/dialog-content.tsx`
- `libs/ui/registry/ui/dialog/dialog.test.tsx`
- `libs/ui/registry/ui/command-palette/command-palette-content.tsx`
- `libs/ui/registry/ui/command-palette/command-palette.test.tsx`
- `libs/ui/registry/ui/shared/nested-overlay-escape.test.tsx`

Coordinate before touching:

- `libs/ui/registry/ui/select/select-content.tsx`
- generated `libs/ui/public/r/*.json`
- generated `libs/ui/docs/generated/**/*.json`

## Requirements

- Read `spec.md` and issue `P1-001`.
- You are not alone in the codebase. Do not revert user or other-agent edits.
- Do not use refs to prevent rerenders. DOM/focus/container refs are allowed.
- Fix closed-first Dialog portal containment.
- Fix CommandPalette nested portal containment.
- Fix CommandPalette focus restore ordering.
- Guard `DialogShell.showModal()` so it only runs for intended open/present state.
- Add focused regression tests.

## Acceptance Criteria

- Nested portals in Dialog and CommandPalette are scoped to the modal container.
- Focus restores after the native dialog is closed.
- Non-modal overlay behavior stays compatible.
- Focused overlay tests pass.

## Verification

Run the narrowest relevant tests first, then report any broader commands you ran or could not run.

