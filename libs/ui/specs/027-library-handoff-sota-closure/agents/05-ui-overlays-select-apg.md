# Agent 05: UI Overlays, Dialog, Select, And APG Behavior

Model: Opus 4.7
Mode: implementation

## Required Skills

Load before work:

- `$sota`
- `$code-audit`
- `architecture`
- `clean-code`
- `code-quality`
- `anti-slop`
- `test-behavior-not-implementation`
- `typescript-expert`
- `superpowers:test-driven-development`
- `superpowers:verification-before-completion`

## Write Ownership

Primary:

- `libs/ui/registry/ui/shared/dialog-shell.tsx`
- `libs/ui/registry/ui/shared/portal.tsx`
- `libs/ui/registry/ui/shared/dialog.css`
- `libs/ui/registry/ui/dialog/**`
- `libs/ui/registry/ui/select/**`
- `libs/ui/registry/ui/popover/**`
- `libs/ui/registry/ui/command-palette/**`
- overlay/select/popover/dialog tests

Coordinate before touching:

- `libs/ui/registry/hooks/use-listbox.ts`
- `libs/ui/registry/registry.json`
- generated public registry artifacts

## Issues

- `../issues/UI-003-overlays-select-apg.md`

## Requirements

- Keep select/popover/command portals contained correctly inside modal dialogs.
- Prevent unlabeled modal dialogs from being a valid public path.
- Make searchable Select semantics correct and documented.
- Align menu popover focus behavior with `aria-haspopup="menu"`.
- Wire `dialog.css` correctly for copy/CLI/shadcn/package modes.
- Preserve nested overlay Escape behavior and focus restore.

## Tests

Add tests for:

- select inside dialog portals into modal container;
- dialog requires accessible name or supplies one through supported public props;
- searchable select active descendant/focus semantics;
- popover menu focus on open;
- direct registry item includes required CSS/import/metadata.

## Verification

Run:

```bash
pnpm --filter @diffgazer/ui test -- dialog popover select command-palette nested-overlay
pnpm --filter @diffgazer/ui type-check
pnpm --filter @diffgazer/ui validate:registry
```

Report any APG tradeoff explicitly.
