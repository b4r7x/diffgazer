# Agent 08: Web Primitive Adoption And Product Boundary Cleanup

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

- `apps/web/src/features/providers/components/model-select-dialog/**`
- `apps/web/src/features/providers/hooks/use-model-dialog-keyboard.ts`
- `apps/web/src/features/providers/components/provider-list.tsx`
- `apps/web/src/features/settings/components/analysis/**`
- `apps/web/src/components/shared/trust-permissions-content.tsx`
- `apps/web/src/components/ui/card-layout.tsx`
- `apps/web/src/components/ui/ascii-logo.tsx`
- `apps/web/src/features/history/components/history-insights-pane.tsx`
- `apps/web/src/features/providers/components/provider-details.tsx`
- `apps/web/src/features/review/components/issue-details-pane.tsx`
- adjacent web tests

Coordinate before touching:

- `libs/ui/registry/**`
- `libs/keys/src/**`

## Issues

- `../issues/UI-006-primitive-boundary-web-adoption.md`
- web usage parts of `../issues/KYS-002-focus-zone-targets.md`
- web usage parts of `../issues/UI-004-navigation-listbox.md`

## Requirements

- Replace local generic behavior with library primitives after Agents 01-06 stabilize APIs.
- Do not move product components into libraries.
- Prefer `Select`/`Listbox`/`RadioGroup` primitives for model picker if they now support required behavior.
- Move duplicated CheckboxGroup Enter behavior into primitive if Agent 04 exposes it; otherwise centralize app logic minimally.
- Use `SearchInput`, `EmptyState`, `SectionHeader`, `Card`, `Logo`, `KeyValue`, `DiffView`, and `CodeBlock` where appropriate.
- Keep route state, provider business logic, trust workflows, review progress, and severity mapping app-local.

## Tests

Update behavior tests for:

- model picker search/filter/select/footer keyboard behavior;
- analysis/trust checkbox keyboard activation;
- provider list search/filter/list behavior;
- history insights rendering;
- review details tabs/diff/code display;
- header logo.

## Verification

Run:

```bash
pnpm --filter @diffgazer/web test -- model provider analysis trust history review theme
pnpm --filter @diffgazer/web type-check
```

Report any web areas intentionally left app-local.
