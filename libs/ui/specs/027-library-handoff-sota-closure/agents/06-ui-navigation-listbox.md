# Agent 06: UI Navigation, Listbox, Menu, Sidebar, And Accordion

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

- `libs/ui/registry/hooks/use-listbox.ts`
- `libs/ui/registry/hooks/use-navigation.ts`
- `libs/ui/registry/hooks/use-typeahead-buffer.ts`
- `libs/ui/registry/ui/menu/**`
- `libs/ui/registry/ui/navigation-list/**`
- `libs/ui/registry/ui/sidebar/**`
- `libs/ui/registry/ui/accordion/**`
- `libs/ui/registry/ui/tabs/**`
- related tests and docs

Coordinate before touching:

- `libs/keys/src/hooks/use-navigation.ts`
- `libs/keys/src/utils/navigation-items.ts`
- `libs/ui/registry/ui/select/**`

## Issues

- `../issues/UI-004-navigation-listbox.md`
- relevant parts of `../issues/KYS-003-navigation-contract.md`

## Requirements

- Scope typeahead to the current composite.
- Avoid outer composite updates from nested inner composites.
- Use keys owner scoping consistently.
- Fix Accordion nested trigger navigation.
- Make sidebar value contract explicit and safe.
- Normalize disabled selected/highlighted behavior.
- Make boundary callbacks and typeahead behavior testable and documented.

## Tests

Add tests for:

- nested menu/listbox typeahead isolation;
- nested accordion isolation;
- sidebar item value contract;
- disabled selected/checked ARIA behavior;
- typeahead current-item/repeated-character behavior if supported;
- boundary event handoff.

## Verification

Run:

```bash
pnpm --filter @diffgazer/ui test -- use-listbox menu navigation-list sidebar accordion tabs
pnpm --filter @diffgazer/ui type-check
pnpm --filter @diffgazer/ui validate:registry
```
