# Agent 09: Test Quality And Behavior Coverage

Model: Opus 4.7
Mode: implementation

## Required Skills

Load before work:

- `$sota`
- `$code-audit`
- `test-behavior-not-implementation`
- `architecture`
- `clean-code`
- `code-quality`
- `anti-slop`
- `typescript-expert`
- `superpowers:test-driven-development`
- `superpowers:verification-before-completion`

## Write Ownership

Primary:

- `libs/keys/src/**/*.test.ts`
- `libs/keys/src/**/*.test.tsx`
- `libs/ui/registry/**/*.test.ts`
- `libs/ui/registry/**/*.test.tsx`
- `apps/web/src/**/*.test.ts`
- `apps/web/src/**/*.test.tsx`

Coordinate before touching:

- source files, unless a tiny accessibility fixture change is needed to make a behavior test possible

## Issues

Test coverage concerns from all issue files, especially:

- `../issues/KYS-001-scope-registration.md`
- `../issues/KYS-002-focus-zone-targets.md`
- `../issues/UI-003-overlays-select-apg.md`
- `../issues/UI-004-navigation-listbox.md`

## Requirements

- Replace implementation-coupled tests with user-visible behavior where practical.
- Prefer `userEvent.keyboard` and real focus targets over `fireEvent.keyDown` on arbitrary nodes for public keyboard behavior.
- Remove internal module mocks of `@diffgazer/keys` where they prevent real integration coverage.
- Avoid assertions on Tailwind classes unless the class is public API.
- Keep tests focused. Do not add redundant snapshots.

Known test quality targets:

- `apps/web/src/features/review/hooks/use-review-progress-keyboard.test.ts`
- `apps/web/src/features/providers/hooks/use-model-dialog-keyboard.test.ts`
- `apps/web/src/features/providers/hooks/use-api-key-dialog-keyboard.test.tsx`
- `apps/web/src/features/providers/hooks/use-providers-keyboard.test.tsx`
- `libs/keys/src/hooks/use-focus-restore.test.ts`
- `libs/keys/src/hooks/use-focus-zone.test.ts`
- `libs/ui/registry/ui/tabs/tabs.test.tsx`
- `libs/ui/registry/ui/command-palette/command-palette.test.tsx`
- `libs/ui/registry/ui/sidebar/sidebar.test.tsx`

## Verification

Run relevant package tests after changes:

```bash
pnpm --filter @diffgazer/keys test
pnpm --filter @diffgazer/ui test
pnpm --filter @diffgazer/web test
```

Report any intentionally retained implementation-level test and why it is necessary.
