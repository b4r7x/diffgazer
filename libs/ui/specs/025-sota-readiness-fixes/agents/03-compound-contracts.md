# Agent 03: Compound Contracts

Model: `gpt-5.5`
Reasoning: medium
Mode: implementation

## Objective

Make compound component composition support explicit, tested, and honest. Avoid overengineering while removing false wrapper-support claims.

## Write Ownership

Primary:

- `libs/ui/registry/component-docs/command-palette.ts`
- `libs/ui/registry/component-docs/select.ts`
- `libs/ui/registry/component-docs/tabs.ts`
- `libs/ui/registry/component-docs/menu.ts`
- `libs/ui/registry/component-docs/navigation-list.ts`
- `libs/ui/registry/component-docs/radio.ts`
- `libs/ui/registry/component-docs/toggle-group.ts`
- `libs/ui/registry/ui/tabs/tabs.test.tsx`
- `libs/ui/registry/ui/select/select.test.tsx`
- `libs/ui/registry/ui/command-palette/command-palette.test.tsx`
- `libs/ui/registry/ui/menu/menu.test.tsx`
- `libs/ui/registry/ui/navigation-list/navigation-list.test.tsx`
- `libs/ui/registry/ui/radio/radio.test.tsx`
- `libs/ui/registry/ui/toggle-group/toggle-group.test.tsx`

Coordinate before touching:

- runtime component implementations unless a direct-child contract is currently broken
- generated `libs/ui/public/r/*.json`
- generated `libs/ui/docs/generated/**/*.json`

## Requirements

- Read `spec.md` and issue `P1-003`.
- You are not alone in the codebase. Do not revert user or other-agent edits.
- Current release contract is direct compound children plus static/namespaced parts. Custom item UI goes inside the item component.
- Remove or rewrite docs that imply opaque wrapper-generated items are supported.
- Add tests for supported direct compound usage and static/namespaced part usage where missing.
- Do not reintroduce effect-based item registration just to support wrapper discovery.

## Acceptance Criteria

- Docs no longer overpromise wrapper support.
- Tests prove supported direct/namespaced compound usage.
- Unsupported opaque wrapper-generated items are not silently advertised as supported.
- No broad runtime rewrite or new collection abstraction unless absolutely necessary.

## Verification

Run focused tests for touched compound components and report results.

