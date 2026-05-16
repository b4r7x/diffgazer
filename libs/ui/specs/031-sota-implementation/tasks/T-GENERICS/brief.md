# Task T-GENERICS — Generic value unions for selection primitives + action-row generic

**Source findings:** NEW-035, NEW-036
**Severity:** Medium DX (Critical-DX for useActionRowNavigation)
**Phase:** 4
**Blocks:** T-WEB-CLEANUP (if you want web to benefit immediately)
**Blocked by:** none

## Goal
Two DX gaps in public TypeScript:

1. **NEW-036 (High DX):** Tabs/Select/RadioGroup/ToggleGroup/Menu/useNavigation/useScopedNavigation/useListbox accept `string` for value/id with no parent↔child cross-narrowing. Add `<T extends string = string>` so `<Tabs<"a"|"b">>` forces `TabsTrigger value` to be one of those literals.

2. **NEW-035 (Critical DX):** `useActionRowNavigation` has loose `actionCount: number` + `disabledActions: readonly boolean[]` + `onAction: (index: number) => void` — no type relation. Refactor to `<Actions extends readonly unknown[]>` so length and index narrow together.

## Files to touch (allowlist)

### NEW-036 (literal union generics)
- `libs/ui/registry/ui/tabs/tabs.tsx` + TabsList/TabsTrigger/TabsContent
- `libs/ui/registry/ui/select/select.tsx` + child components
- `libs/ui/registry/ui/radio/radio-group.tsx` + RadioGroupItem
- `libs/ui/registry/ui/toggle-group/toggle-group.tsx` + ToggleGroupItem
- `libs/ui/registry/ui/menu/menu.tsx` + MenuItem
- `libs/keys/src/hooks/use-navigation.ts`
- `libs/keys/src/hooks/use-scoped-navigation.ts`
- `libs/ui/registry/hooks/use-listbox.ts`
- All corresponding `*.test.tsx` files (add at least one test showing narrowing works)
- Regenerated `libs/ui/public/r/*.json` and `libs/keys/public/r/*.json` for touched items

### NEW-035 (useActionRowNavigation generic)
- `libs/keys/src/hooks/use-action-row-navigation.ts`
- `libs/keys/src/hooks/use-action-row-navigation.test.ts`
- Regenerated `libs/keys/public/r/action-row-navigation.json`
- Any consumer in libs/ui or apps/web that uses the hook — verify signature compatibility (may need T-WEB-CLEANUP follow-up)

## Files NOT to touch
- Other hooks
- Other components
- DOM-level value encoding (value still stringifies via `el.dataset.value` — that's fine)

## Acceptance criteria

### NEW-036
- [ ] Each component listed has `<T extends string = string>` generic
- [ ] Type-only test: `<Tabs<"a"|"b">>` rejects `<TabsTrigger value="c">` at compile time
- [ ] Default behavior unchanged for consumers using string
- [ ] All existing tests pass

### NEW-035
- [ ] `useActionRowNavigation<Actions extends readonly unknown[]>(options)` signature
- [ ] `disabledActions?: { readonly [K in keyof Actions]: boolean }` (tuple-mapped, not loose array)
- [ ] `onAction: (index: keyof Actions & number) => void`
- [ ] Type-only test: passing `actions: [a, b, c]` and `disabledActions: [true, false]` errors at compile time (length mismatch)
- [ ] Backwards-compatible default: if no generic supplied, accepts loose `boolean[]` / `(index: number) => void`
- [ ] All existing tests pass

### General
- [ ] No runtime change (only types)
- [ ] `pnpm --filter @diffgazer/ui test:types && pnpm --filter @diffgazer/keys test:types` passes
- [ ] No breakages in apps/web

## Verification commands
```bash
cd /Users/voitz/Projects/diffgazer-workspace
pnpm --filter @diffgazer/ui test:types
pnpm --filter @diffgazer/keys test:types
pnpm --filter @diffgazer/ui type-check
pnpm --filter @diffgazer/keys type-check
pnpm --filter @diffgazer/web type-check
DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test
```

## Notes & references
- Spec 029 §NEW-035, NEW-036
- vitest `--typecheck` runs type-level tests via `.test-d.ts` or inline `expect(typeof ...)` calls — see existing patterns in tests

## Non-goals
- Do not change DOM data attribute encoding
- Do not add runtime validation of value union
- Do not break the default-string fallback
