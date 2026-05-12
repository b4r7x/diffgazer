# 04 — Public API And Accessibility

> Implement only this brief. Do not run git add/commit/stage/stash.

## Goal

Normalize public API and accessibility contracts before first public release.

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
- `libs/keys/src/hooks/use-navigation.ts`
- `libs/keys/src/hooks/use-scoped-navigation.ts`
- `libs/ui/registry/hooks/use-listbox.ts`
- `libs/ui/registry/ui/menu/menu.tsx`
- `libs/ui/registry/ui/navigation-list/navigation-list.tsx`
- `libs/ui/registry/ui/checkbox/checkbox-group.tsx`
- `libs/ui/registry/ui/radio/radio-group.tsx`
- `libs/ui/registry/ui/toggle-group/toggle-group.tsx`
- `libs/ui/registry/ui/field/field.tsx`
- `libs/ui/registry/ui/block-bar/block-bar.tsx`
- `libs/ui/registry/ui/sidebar/sidebar.tsx`
- `libs/ui/registry/lib/focus.ts`

## Write Ownership

```text
libs/keys/src/hooks/use-navigation.ts
libs/keys/src/hooks/use-scoped-navigation.ts
libs/keys/src/**/*.test.ts
libs/keys/src/**/*.test.tsx
libs/ui/registry/hooks/use-listbox.ts
libs/ui/registry/ui/menu/**
libs/ui/registry/ui/navigation-list/**
libs/ui/registry/ui/checkbox/**
libs/ui/registry/ui/radio/**
libs/ui/registry/ui/toggle-group/**
libs/ui/registry/ui/field/**
libs/ui/registry/ui/block-bar/**
libs/ui/registry/ui/sidebar/**
libs/ui/registry/lib/focus.ts
libs/ui/registry/component-docs/**
libs/ui/docs/content/**
apps/web/src/**
```

## Required Behavior

### Part A: Highlight state round-trips null

Any public API that accepts `highlighted?: string | null` must expose callbacks/actions that can clear it:

```typescript
onHighlightChange?: (value: string | null) => void;
highlight(value: string | null): void;
```

Apply consistently across:

- `useNavigation`
- `useScopedNavigation`
- `useListbox`
- `Menu`
- `NavigationList`
- `CheckboxGroup`
- `RadioGroup`
- any other public highlighted state API

Update app consumers and examples. Do not add deprecated aliases.

### Part B: ToggleGroup boundary API

Add `onNavigationBoundaryReached(direction, event, key)` to `ToggleGroup`, matching `RadioGroup`/`CheckboxGroup` semantics.

### Part C: CheckboxGroup Enter activation

Centralize reusable Enter activation in `CheckboxGroup` or explicitly remove app-local Enter shortcuts and document why Enter is unsupported. Recommended behavior:

- Enter toggles the focused/highlighted enabled item.
- Space continues to work through native/item semantics.
- Disabled item is a no-op.
- Consumer `onKeyDown` with `preventDefault()` can block group behavior.

### Part D: Field ARIA merge

`Field.Control` must merge external `aria-labelledby` with the field label id rather than replacing or ignoring either.

### Part E: BlockBar accessible name

`BlockBar` must not render unnamed `role="meter"`.

Accept one of:

- visible `label`,
- `aria-label`,
- `aria-labelledby`.

Enforce by type/docs/tests where practical.

### Part F: Focus utilities ownership

Generic focusable/tabbable/focus helpers belong in `libs/keys`. `libs/ui` should not publish generic focus utilities unless they are UI-specific wrappers. Move, hide, or rename `libs/ui/registry/lib/focus.ts` accordingly.

### Part G: Sidebar naming decision

Decide whether `Sidebar` remains a documented collapsed-state exception or changes to positive `open/defaultOpen/onOpenChange` before release. If changed, update all source/docs/tests/examples with no compatibility aliases.

## Tests

Add or update behavior tests for:

- controlled `highlighted={null}`,
- clearing highlight after close/item removal/reset,
- `ToggleGroup` boundary with `wrap={false}`,
- `CheckboxGroup` Enter activation and disabled item no-op,
- `Field` merged ARIA labels,
- `BlockBar` accessible name,
- focus utility ownership/export behavior.

## Verification

```bash
pnpm --filter @diffgazer/keys test
pnpm --filter @diffgazer/keys type-check
pnpm --filter @diffgazer/ui test
pnpm --filter @diffgazer/ui type-check
pnpm --filter @diffgazer/web test
pnpm --filter @diffgazer/web type-check
pnpm run prepare:artifacts
pnpm run validate:artifacts:check
git diff --check
```

