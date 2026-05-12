# 05 — Web Adoption

> Implement only this brief. Do not run git add/commit/stage/stash.

## Goal

Make `apps/web` a cleaner proof that real Diffgazer UI is built from `libs/ui` and `libs/keys`, while keeping product-specific composition in the app.

## Required Skills

- `/code-audit`
- `/clean-code`
- `/code-quality`
- `/anti-slop`
- `/sota`
- `/react-senior-guide`
- `/react-useeffect`
- `/react-useref`
- `/react-anti-patterns`
- `/react-design-patterns`
- `/test-behavior-not-implementation`

## Required Reading

- `AGENTS.md`
- `apps/web/package.json`
- `apps/web/src/app/providers/index.tsx`
- `apps/web/src/hooks/use-footer-navigation.ts`
- `apps/web/src/utils/vertical-list-key.ts`
- `apps/web/src/features/review/hooks/use-issue-selection.ts`
- `apps/web/src/features/review/hooks/use-review-results-keyboard.ts`
- `apps/web/src/features/review/components/issue-list-pane.tsx`
- `apps/web/src/features/review/components/issue-preview-item.tsx`
- `apps/web/src/features/home/components/info-field.tsx`
- `apps/web/src/features/providers/hooks/use-model-dialog-keyboard.ts`
- `apps/web/src/features/providers/hooks/use-api-key-dialog-keyboard.ts`
- `apps/web/src/components/ui/**`

## Write Ownership

```text
apps/web/src/**
libs/keys/src/hooks/**
libs/keys/src/utils/**
libs/ui/registry/ui/**
libs/ui/registry/hooks/**
libs/ui/registry/component-docs/**
libs/ui/docs/content/**
```

## Required Behavior

### Part A: Move generic action-row/footer navigation out of web

Extract `useFooterNavigation` into `libs/keys` as a public generic hook, likely `useActionRowNavigation`.

Requirements:

- disabled/skipped actions,
- wrap/no-wrap,
- focus fallback,
- ownerDocument-safe focus,
- editable target guard,
- semantic callbacks such as `onNavigate`, `onAction`, `onNavigationBoundaryReached`.

Then update web consumers to use the library hook.

### Part B: Remove local vertical list key duplication

Replace `apps/web/src/utils/vertical-list-key.ts` with a `libs/keys` helper or existing direction utilities.

Apply in:

- history page,
- timeline list,
- review issue list.

### Part C: Review issue movement should use keys/UI navigation semantics

Avoid manual array-index selection movement where `NavigationList`/keys navigation already owns DOM order, disabled/skipped item behavior, and boundary semantics.

### Part D: Clean semantic UI usage

Fix known semantic/adoption issues:

- `IssuePreviewItem` must not render a focusable `<button>` when no action exists.
- Use public `Badge` where app hand-rolls generic badges.
- Use public `Kbd` for keyboard hints where appropriate.
- `InfoField` clickable state should render a real `button`/link or compose a public primitive, not `div role="button"` unless no semantic element can work.

### Part E: Keep product-specific adapters local

Do not move these into `libs/ui`:

- review progress adapters,
- severity breakdown/bar wrappers,
- API-key/provider selectors,
- storage/trust permissions content,
- route-scoped state,
- model-dialog domain coordination,
- history/review panes.

## Tests

Add or update tests for:

- action-row navigation in `libs/keys`,
- web footer/action navigation after migration,
- non-clickable issue preview not tabbable,
- `InfoField` semantics,
- ignored interactive targets in review progress keyboard handling,
- provider autofocus not stealing focus from active input/contenteditable,
- history zone movement and `keyboardEnabled={false}` behavior,
- full home/help/provider flow coverage where affected.

## Verification

```bash
pnpm --filter @diffgazer/keys test
pnpm --filter @diffgazer/keys type-check
pnpm --filter @diffgazer/ui test
pnpm --filter @diffgazer/ui type-check
pnpm --filter @diffgazer/web test
pnpm --filter @diffgazer/web type-check
pnpm --filter @diffgazer/web build
git diff --check
```

